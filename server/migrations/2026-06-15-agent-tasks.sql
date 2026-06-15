-- P3: Agent Tasking → execution.
-- Run in the Supabase SQL editor (or psql) against the ARIA project.

-- 1. Agent task queue (one row per queued/executed task).
create table if not exists public.agent_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  slug         text not null,                       -- target agent (spawned_agents.slug)
  text         text not null,                       -- the task instruction
  state        text not null default 'queued',      -- queued|running|awaiting_approval|approved|rejected|failed
  result       text,                                -- agent output (when awaiting_approval)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_agent_tasks_tenant_state on public.agent_tasks(tenant_id, state);
alter table public.agent_tasks enable row level security;

-- 2. Seed the 6 cosmic personas as ACTIVE spawned_agents (read-mostly tools in v1).
--    tool_allowlist intentionally conservative: no outward-action tools. Every task
--    result is gated behind human Approval before anything goes outward.
insert into public.spawned_agents (tenant_id, slug, name, specialty, system_prompt, tool_allowlist, model, status)
select t.id, p.slug, p.name, p.specialty, p.system_prompt, p.tool_allowlist::jsonb, 'claude-sonnet-4-6', 'active'
from (select id from public.tenants order by created_at limit 1) t,
(values
  ('scout',    'Scout',    'Web reconnaissance & competitor monitoring',
   'You are Scout, ARIA''s web-recon agent. Given a task, research it concisely and return a tight, sourced briefing. You draft only — a human approves before anything is acted on.', '["web_search"]'),
  ('hunter',   'Hunter',   'Lead generation & qualification',
   'You are Hunter, ARIA''s lead-gen agent. Given a task, identify/qualify leads and return a structured summary. Draft only; a human approves.', '["web_search"]'),
  ('creative', 'Creative', 'Copywriting & content drafts',
   'You are Creative, ARIA''s copywriter. Given a task, produce a polished draft (post, email, or copy). Draft only; a human approves before sending.', '[]'),
  ('hermes',   'Hermes',   'Long-running synthesis & reports',
   'You are Hermes, ARIA''s long-task synthesizer. Given a task, produce a thorough written deliverable. Draft only; a human approves.', '[]'),
  ('beacon',   'Beacon',   'Briefings & monitoring summaries',
   'You are Beacon, ARIA''s briefing agent. Given a task, produce a clear status briefing. Draft only; a human approves.', '[]'),
  ('verse',    'Verse',    'Social content drafts',
   'You are Verse, ARIA''s social agent. Given a task, draft social content. Draft only; a human approves before posting.', '[]')
) as p(slug, name, specialty, system_prompt, tool_allowlist)
on conflict (slug) do nothing;
