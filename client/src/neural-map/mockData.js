export const MOCK_DATA = {
  nodes: [
    { id: 'aria', type: 'hub', label: 'ARIA', color: '#C5FF4D', freshness: 1.0,
      detail: 'Adaptive Reasoning & Intelligent Automation — voice-first cofounder for Jack & Jewell Consulting.' },

    { id: 'scout',    type: 'category', label: 'Scout',    color: '#6BD08F', freshness: 0.92,
      detail: 'Web intelligence. Targeted searches, page fetches, cross-referenced briefings.' },
    { id: 'hunter',   type: 'category', label: 'Hunter',   color: '#E08B5C', freshness: 0.84,
      detail: 'B2B lead generation. Qualifies SMB prospects by funding, tech hiring, modernization.' },
    { id: 'creative', type: 'category', label: 'Creative', color: '#B97FE5', freshness: 0.88,
      detail: 'B2B ad and social copywriter. LinkedIn/Meta/Google/email variations.' },
    { id: 'hermes',   type: 'category', label: 'Hermes',   color: '#E3CC68', freshness: 0.72,
      detail: 'Long-running, memory-backed tasks via Nous Research Hermes CLI.' },
    { id: 'beacon',   type: 'category', label: 'Beacon',   color: '#6FA8DC', freshness: 1.00,
      detail: 'Drafts the 8 AM Morning Brief — actively running right now.' },
    { id: 'verse',    type: 'category', label: 'Verse',    color: '#C078E5', freshness: 0.91,
      detail: "LinkedIn comment reply drafter in Randy's voice. Drafts only." },

    { id: 'wayfinder',   parent: 'scout',    type: 'leaf', label: 'Wayfinder Tech',       freshness: 0.95, detail: 'Local MSP competitor — dropped Starter tier to $399/mo from $750. Possible price-war signal.' },
    { id: 'indy-mkt',    parent: 'scout',    type: 'leaf', label: 'Indy MSP market',      freshness: 0.70, detail: 'Greenwood / South Indianapolis competitive landscape. 12 competitors tracked.' },
    { id: 'msp-pricing', parent: 'scout',    type: 'leaf', label: 'Pricing surveillance', freshness: 0.58, detail: 'Pricing pages monitored across all watched competitors. Snapshots cached.' },
    { id: 'community',   parent: 'scout',    type: 'leaf', label: 'Indy SMB community',   freshness: 0.45, detail: 'Chambers of commerce, BNI groups, local IT forums.' },

    { id: 'bridgepoint', parent: 'hunter',   type: 'leaf', label: 'Bridgepoint Dental',  freshness: 0.95, detail: 'Carmel, 18 users. New ops director hired — 3-month MSP procurement window typical.' },
    { id: 'hedgerow',    parent: 'hunter',   type: 'leaf', label: 'Hedgerow Dental',     freshness: 0.82, detail: 'Inbound, scored 78/100 by Atlas. Likely Standard tier.' },
    { id: 'perf-clinic', parent: 'hunter',   type: 'leaf', label: 'Performance Clinic', freshness: 0.90, detail: 'Discovery call Wednesday Jun 3. Beacon drafting prep brief now.' },
    { id: 'pixel-pools', parent: 'hunter',   type: 'leaf', label: 'Pixel Pools LLC',    freshness: 0.65, detail: 'Proposal sent May 29, no reply. 2 days overdue.' },

    { id: 'li-post-v1', parent: 'creative', type: 'leaf', label: 'LinkedIn post v1',     freshness: 0.86, detail: 'Indy SMB IT topic. Direct tone, ends with question.' },
    { id: 'li-post-v2', parent: 'creative', type: 'leaf', label: 'LinkedIn post v2',     freshness: 0.86, detail: 'Indy SMB IT topic. Story angle, ends with question.' },
    { id: 'li-post-v3', parent: 'creative', type: 'leaf', label: 'LinkedIn post v3',     freshness: 0.86, detail: 'Indy SMB IT topic. Stat-led, ends with question.' },
    { id: 'email-tmpl', parent: 'creative', type: 'leaf', label: 'Cold email templates', freshness: 0.55, detail: 'Four templates for break-fix to retainer conversion.' },

    { id: 'memory-cons', parent: 'hermes',  type: 'leaf', label: 'Memory consolidation', freshness: 0.48, detail: 'Daily memory review job. Runs at 11 PM.' },
    { id: 'snark-tune',  parent: 'hermes',  type: 'leaf', label: 'Voice snark tuning',   freshness: 0.70, detail: "Iterative test runs for ARIA's reply style." },

    { id: 'morning-brief',    parent: 'beacon', type: 'leaf', label: 'Morning brief · DRAFTING', freshness: 1.00, detail: 'MRR + actions + alerts. Currently generating.' },
    { id: 'perf-clinic-prep', parent: 'beacon', type: 'leaf', label: 'Performance Clinic prep', freshness: 0.92, detail: 'Pre-call summary, due Tuesday night.' },
    { id: 'weekly-summary',   parent: 'beacon', type: 'leaf', label: 'Last week summary',       freshness: 0.42, detail: '7-day rollup of MRR delta, leads, intel.' },

    { id: 'li-reply-1', parent: 'verse', type: 'leaf', label: 'LinkedIn reply · "Mark T."',  freshness: 0.96, detail: 'Drafted reply to Mark T. comment on Friday post.' },
    { id: 'li-reply-2', parent: 'verse', type: 'leaf', label: 'LinkedIn reply · "Sarah K."', freshness: 0.96, detail: 'Drafted reply to Sarah K. comment on Friday post.' },
  ],
  edges: [],
};

// Auto-derive edges from parent fields
MOCK_DATA.nodes.forEach(n => {
  if (n.type === 'category') MOCK_DATA.edges.push({ from: 'aria', to: n.id });
  if (n.type === 'leaf')     MOCK_DATA.edges.push({ from: n.parent, to: n.id });
});
