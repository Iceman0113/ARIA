import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { getSupabase, getTenantId } from './supabase.js';

// ── Entry CRUD ────────────────────────────────────────────────────

export async function upsertEntry({ type, key, value, resolved }) {
  const sb = getSupabase();
  if (!sb) return fallbackUpsert({ type, key, value, resolved });

  const tenantId = await getTenantId();
  if (!tenantId) return { error: 'Tenant not found — did you run schema.sql?' };

  const { error } = await sb.from('aria_memory').upsert(
    { tenant_id: tenantId, type, key, value, resolved: resolved ?? false, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,type,key' },
  );

  if (error) return { error: error.message };
  return { saved: true, key, type };
}

export async function resolveIssue(key) {
  const sb = getSupabase();
  if (!sb) return { resolved: false, error: 'No Supabase connection' };

  const tenantId = await getTenantId();
  if (!tenantId) return { resolved: false, error: 'Tenant not found' };

  const { error } = await sb
    .from('aria_memory')
    .update({ resolved: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('key', key)
    .eq('type', 'issue');

  return error ? { resolved: false, error: error.message } : { resolved: true };
}

export async function deleteEntry(key) {
  const sb = getSupabase();
  if (!sb) return { deleted: false };

  const tenantId = await getTenantId();
  if (!tenantId) return { deleted: false };

  const { error } = await sb.from('aria_memory').delete().eq('tenant_id', tenantId).eq('key', key);
  return error ? { deleted: false } : { deleted: true };
}

// ── Session storage ───────────────────────────────────────────────

export async function addSession({ summary, keyPoints, messageCount }) {
  const sb = getSupabase();
  if (!sb) return;

  const tenantId = await getTenantId();
  if (!tenantId) return;

  await sb.from('session_summaries').insert({
    tenant_id: tenantId,
    summary,
    key_points: keyPoints || [],
    message_count: messageCount,
  });
}

// ── Context builder for system prompt ────────────────────────────

export async function buildMemoryBlock() {
  const sb = getSupabase();
  if (!sb) return '';

  const tenantId = await getTenantId();
  if (!tenantId) return '';

  const [{ data: entries }, { data: sessions }] = await Promise.all([
    sb.from('aria_memory').select('*').eq('tenant_id', tenantId).eq('resolved', false),
    sb.from('session_summaries').select('*').eq('tenant_id', tenantId)
      .order('session_date', { ascending: false }).limit(1),
  ]);

  if (!entries?.length && !sessions?.length) return '';

  const byType = (type) => (entries || []).filter(e => e.type === type);
  const goals       = byType('goal');
  const decisions   = byType('decision');
  const issues      = byType('issue');
  const context     = byType('context');
  const preferences = byType('preference');
  const recentSession = sessions?.[0];

  const lines = ['YOUR PERSISTENT MEMORY:', '─────────────────────────────'];

  if (goals.length)       lines.push(`GOALS: ${goals.map(e => e.value).join(' · ')}`);
  if (context.length)     lines.push(`CONTEXT: ${context.map(e => e.value).join(' · ')}`);
  if (decisions.length)   lines.push(`DECISIONS: ${decisions.map(e => `${e.updated_at?.slice(0, 10)}: ${e.value}`).join(' · ')}`);
  if (issues.length)      lines.push(`KNOWN ISSUES: ${issues.map(e => e.value).join(' · ')}`);
  if (preferences.length) lines.push(`PREFERENCES: ${preferences.map(e => e.value).join(' · ')}`);

  if (recentSession) {
    const date = new Date(recentSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    lines.push(`LAST SESSION (${date}): ${recentSession.summary}`);
  }

  lines.push('─────────────────────────────');
  lines.push('Reference this naturally. Update memory when you learn something new.');

  return lines.join('\n');
}

// ── Read for API / UI ─────────────────────────────────────────────

export async function getMemory() {
  const sb = getSupabase();
  if (!sb) return { entries: [], sessions: [] };

  const tenantId = await getTenantId();
  if (!tenantId) return { entries: [], sessions: [] };

  const [{ data: entries }, { data: sessions }] = await Promise.all([
    sb.from('aria_memory').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    sb.from('session_summaries').select('*').eq('tenant_id', tenantId)
      .order('session_date', { ascending: false }).limit(20),
  ]);

  return { entries: entries || [], sessions: sessions || [] };
}

// ── JSON fallback (when Supabase not configured) ──────────────────

const MEMORY_FILE = './aria-memory.json';
const DEFAULTS = () => ({ version: 1, lastUpdated: null, entries: [], sessions: [] });

function loadFile() {
  try {
    if (!existsSync(MEMORY_FILE)) return DEFAULTS();
    return JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'));
  } catch { return DEFAULTS(); }
}

function saveFile(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Memory save error:', err.message);
  }
}

function fallbackUpsert({ type, key, value, resolved }) {
  const data = loadFile();
  const now = new Date().toISOString();
  const existing = data.entries.find(e => e.type === type && e.key === key);

  if (existing) {
    existing.value = value;
    existing.updatedAt = now;
    if (resolved !== undefined) existing.resolved = resolved;
  } else {
    data.entries.push({ id: randomUUID(), type, key, value, resolved: resolved ?? false, createdAt: now, updatedAt: now });
  }

  saveFile(data);
  return { saved: true, key, type };
}
