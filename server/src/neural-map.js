import { getSupabase, getTenantId } from './supabase.js';

const CANONICAL_AGENTS = [
  { id: 'scout',    label: 'Scout',    color: '#6BD08F', detail: 'Web intelligence. Targeted searches, page fetches, cross-referenced briefings.' },
  { id: 'hunter',   label: 'Hunter',   color: '#E08B5C', detail: 'B2B lead generation. Qualifies SMB prospects by funding, tech hiring, modernization.' },
  { id: 'creative', label: 'Creative', color: '#B97FE5', detail: 'B2B ad and social copywriter. LinkedIn/Meta/Google/email variations.' },
  { id: 'hermes',   label: 'Hermes',   color: '#E3CC68', detail: 'Long-running, memory-backed tasks via Nous Research Hermes CLI.' },
];

const HUB = {
  id: 'aria', type: 'hub', label: 'ARIA', color: '#C5FF4D', freshness: 1.0,
  detail: 'Adaptive Reasoning & Intelligent Automation — voice-first cofounder for Jack & Jewell Consulting.',
};

function computeFreshness(when) {
  if (!when) return 0.3;
  const ts = typeof when === 'string' ? new Date(when).getTime() : when.getTime();
  const ageHours = Math.max(0, (Date.now() - ts) / 3_600_000);
  if (ageHours < 1)   return 1.0;
  if (ageHours > 336) return 0.05;
  return Math.max(0.05, 1.0 - ageHours / 336);
}

function memoryRowToLeaf(row) {
  const slug = row.key || row.id;
  const parent = (row.source_agent || '').toLowerCase();
  const validParent = CANONICAL_AGENTS.find(a => a.id === parent)?.id || 'scout';
  return {
    id: slug,
    parent: validParent,
    type: 'leaf',
    label: row.label || row.summary?.slice(0, 48) || row.key || 'memory',
    freshness: computeFreshness(row.updated_at || row.created_at),
    detail: row.summary || row.body || '',
  };
}

function contactRowToLeaf(row) {
  return {
    id: `contact-${row.id || row.name}`,
    parent: 'hunter',
    type: 'leaf',
    label: row.name || row.company_name || 'lead',
    freshness: computeFreshness(row.updated_at || row.created_at),
    detail: row.notes || row.status || '',
  };
}

export async function buildNeuralMap() {
  const sb = getSupabase();
  const tenantId = await getTenantId().catch(() => null);

  const nodes = [HUB];
  const subagents = [...CANONICAL_AGENTS];

  if (sb && tenantId) {
    try {
      const { data, error } = await sb.from('spawned_agents').select('*').eq('tenant_id', tenantId).limit(50);
      if (!error && Array.isArray(data)) {
        for (const sa of data) {
          if (sa.status !== 'approved') continue;
          if (!sa.slug || subagents.some(a => a.id === sa.slug)) continue;
          subagents.push({
            id: sa.slug,
            label: sa.label || sa.slug,
            color: sa.color || '#6FA8DC',
            detail: sa.detail || '',
          });
        }
      }
    } catch {}
  }

  for (const sa of subagents) {
    nodes.push({ ...sa, type: 'category', freshness: 0.7 });
  }

  const leaves = [];
  if (sb && tenantId) {
    try {
      const { data, error } = await sb.from('aria_memory').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(20);
      if (!error && Array.isArray(data)) data.forEach(row => leaves.push(memoryRowToLeaf(row)));
    } catch {}
    try {
      const { data, error } = await sb.from('contacts').select('*').eq('tenant_id', tenantId).limit(12);
      if (!error && Array.isArray(data)) data.forEach(row => leaves.push(contactRowToLeaf(row)));
    } catch {}
  }
  leaves.forEach(l => nodes.push(l));

  for (const cat of subagents) {
    const childMax = leaves.filter(l => l.parent === cat.id).reduce((m, l) => Math.max(m, l.freshness), 0);
    const cn = nodes.find(n => n.id === cat.id);
    if (cn && childMax > 0) cn.freshness = childMax;
  }

  return { nodes, edges: [] };
}
