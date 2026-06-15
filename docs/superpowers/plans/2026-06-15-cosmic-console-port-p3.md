# Cosmic Console Port — Phase 3 (Agent Tasking → Execution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the left Agent Tasking panel into real autonomous execution — add a task to one of the 6 agents, it runs via the existing factory dispatch substrate, and its result lands in the Approvals gate for human sign-off before anything goes outward.

**Architecture:** Front the EXISTING substrate (`spawned_agents` registry rows → `buildDispatchTool` → `ConfigDrivenAgent.run`). Add an `agent_tasks` queue table + thin endpoints; seed the 6 personas as `spawned_agents` rows; wire the Console panel CRUD; route every result through the Approvals queue. Then retire `neural-map/`.

**Tech Stack:** Node/Express + `@supabase/supabase-js`, the factory runtime (`ConfigDrivenAgent`), React 19. No new deps.

**Branch:** `feat/cosmic-console-port`.

**Safety spine (non-negotiable):** agents draft; the human approves. Persona `tool_allowlist`s start **read-mostly** (no send/post/spend tools). Every task result is written as `awaiting_approval` and only an explicit Approve completes it. No autonomous outward action in v1.

**Verified facts:**
- Registry table `spawned_agents` (schema.sql:165): `slug` (unique), `name`, `specialty`, `system_prompt`, `tool_allowlist` JSONB, `model` (default `claude-sonnet-4-6`), `status` (`shadow`|`active`), `tenant_id`. The `registry-watcher` subscribes to rows with `status in ('shadow','active')` and registers `dispatch_to_<slug>`.
- `ConfigDrivenAgent(row).run(message, onEvent)` (`runtime.js`) executes an agent from its row.
- Factory approvals already exist: `/factory/pending`, `/factory/tasks/:id/{approve,reject,feedback}`, and the cosmic Approvals tab uses `useApprovals(ws)` (P2).
- `getTenantId()` (`supabase.js`) resolves the tenant.

---

## PREREQUISITE — Supabase migration (Randy runs this)

Run in the Supabase SQL editor (project `jopardijgbzvfncfborn`). File to commit: `server/migrations/2026-06-15-agent-tasks.sql`.

```sql
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

-- 2. Seed the 6 cosmic personas as ACTIVE spawned_agents (read-mostly tools).
--    tool_allowlist intentionally conservative in v1 (no outward-action tools).
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
```
(`web_search` must be a real registered tool name — the implementer verifies against `server/src/tools.js`; if the name differs, fix the allowlist. If no safe read tool exists, seed all with `'[]'` and they reason from the prompt only.)

After Randy runs it: the `registry-watcher` hot-reloads and `dispatch_to_{scout,hunter,creative,hermes,beacon,verse}` become available.

---

## Task 1: `agent_tasks` repo + lifecycle (server, TDD)

**Files:** Create `server/src/agents/tasks-repo.js`; Test `server/src/test/agent-tasks-repo.test.js`.

State machine: `queued → running → awaiting_approval → approved | rejected | failed`.

- [ ] Write failing tests for a pure `nextState(from, to)` validator (allowed transitions only; throws on invalid) and the row-shape mapper. (Mock Supabase like the existing factory repo tests do — read `server/src/test/` for the pattern.)
- [ ] Implement `tasks-repo.js`: `createTask({slug, text})`, `listTasks(slug?)`, `getTask(id)`, `setState(id, to, patch)`, `deleteTask(id)` — all tenant-scoped via `getTenantId()`, using the `agent_tasks` table. Reuse the transition-guard pattern from `server/src/factory/states.js`.
- [ ] Tests green. Commit.

## Task 2: Dispatch endpoints (server, TDD)

**Files:** Create `server/src/agents/routes.js` (mount in `server/src/index.js`); Test `server/src/test/agent-routes.test.js`.

- [ ] `POST /agents/:slug/tasks` `{text}` → create `queued` task; kick off execution async: set `running`, call the agent via the SAME mechanism the factory dispatcher uses (resolve the `dispatch_to_<slug>` tool / construct a `ConfigDrivenAgent` from the `spawned_agents` row and `.run(text)`), capture the output, set `awaiting_approval` with `result`. On error → `failed`. Return the created task immediately (execution continues in background; broadcast a WS event like `agent_task.updated` so the client refreshes).
- [ ] `GET /agents/:slug/tasks` → tasks for that slug. `GET /agents/tasks?state=awaiting_approval` → all awaiting approval (for the Approvals tab).
- [ ] `DELETE /agents/:slug/tasks/:id` → remove a queued task.
- [ ] `POST /agents/tasks/:id/approve` and `/reject` → set state; (v1: approve just marks `approved` — no outward action yet; reject marks `rejected`).
- [ ] Read how `server/src/factory/routes.js` resolves and runs a `ConfigDrivenAgent` (or the registry/dispatcher) and reuse that exact path — do NOT hand-roll Anthropic calls. Tests mock the agent runner and assert state transitions + broadcasts. Commit.

## Task 3: Approvals tab includes agent-task results (client)

**Files:** Modify `client/src/shell/useApprovals.js`, `client/src/pages/Console.jsx`.

- [ ] Extend `useApprovals(ws)` to also fetch `GET /agents/tasks?state=awaiting_approval` and merge with `/factory/pending` (tag each item with a `source`), refresh on `agent_task.updated` WS events too. `approve`/`reject` route to the right endpoint by source.
- [ ] Approvals cards render agent-task results (agent name + task text + `result` preview + Approve/Reject). Keep the factory items working. Commit. (Tests: extend `useApprovals.test.js` for the merge + routing.)

## Task 4: Agent Tasking CRUD in the Console (client)

**Files:** Modify `client/src/pages/Console.jsx` (left `.editor` panel).

- [ ] Per agent, render its queued/running tasks (`GET /agents/:slug/tasks`) and an add-task input (Enter → `POST /agents/:slug/tasks`) + remove (✕ → `DELETE`). Mirror the mockup's `.ablock`/`.task`/`.addrow` markup (`mockups/aria-cosmic/index.html` `renderEditor`, ~lines 321-331).
- [ ] A running task docks its agent (the agent's live state flows through the existing `agent_state`/`workStates` path → `agentView`; ensure the dispatch broadcasts an `agent_state` `working`/`idle` for the slug so the orb dock reacts). Commit. (Test: Console renders an add-row per agent + lists tasks from a mocked fetch.)

## Task 5: Retire neural-map + regression + live verify

- [ ] `git rm -r client/src/neural-map/` and remove its last references (`workStates.js` import, the `NeuralMap.test.jsx`/`workStates.test.js`). Confirm nothing else imports it (`grep -rn neural-map client/src`).
- [ ] Full suites green: `client` vitest + `server` test. Build clean.
- [ ] Live (after migration): add a task to Scout in the Console → it docks + runs → result appears in Approvals → Approve → task `approved`. No console errors. Commit.

## Phase 3 exit criteria
- Adding a task to any of the 6 agents executes it autonomously and surfaces the result in the Approvals gate; Approve/Reject work.
- Persona tool_allowlists are read-mostly; nothing goes outward without an explicit Approve.
- `neural-map/` deleted; client + server suites green; build clean.

## Out of scope (future)
- Granting outward-action tools to personas (send email/post/spend) — each behind approval, its own change.
- The cosmic full redesign of the Voice/Factory pages (separate design-first specs).
