# Gated Outward Action (LinkedIn Publish) — Design

**Date:** 2026-06-15
**Status:** Approved (brainstorm), pending implementation plan
**Builds on:** P3 agent-tasking (`server/src/agents/*`, `agent_tasks` table, `useApprovals`).

## Goal
Let an agent (Verse) draft a LinkedIn post that is **queued for human approval** and only **publishes when Randy clicks Approve** — never during the agent's run. Establish the generic **approve→execute** spine on this one reversible-ish, no-undo action.

## Locked decisions
- **Approach A — runtime interception** (chosen over B structured-draft / C two-phase). The gate is structural, not prompt-dependent.
- First and only gated tool in v1: **`publish_to_linkedin`**. Email send is out of scope (no send tool exists).
- Verse chooses content + author in its proposed call; the Approvals card shows both before Randy approves (an author picker at approve-time is a future enhancement).

## Architecture

### 1. Interception (the gate) — `server/src/tools.js` (+ `factory/runtime.js`)
- `const GATED_TOOLS = new Set(['publish_to_linkedin'])`.
- In `callTool(name, input, onEvent, broadcast, ctx)`: if `GATED_TOOLS.has(name)` AND `ctx?.caller?.kind === 'spawned_agent'`, do NOT execute. Push `{ tool: name, input }` to `ctx.proposedActions` (an array the caller provides) and return `{ queued: true, note: 'Drafted and queued for human approval. Do not retry.' }`.
- `ConfigDrivenAgent.run` creates `const proposedActions = []`, passes it on `ctx` to every `callTool`, and returns `{ text, shadow, proposedActions }`.
- Non-gated tools and non-`spawned_agent` callers are unaffected (existing behavior preserved).

### 2. Data model — migration `server/migrations/2026-06-15-proposed-action.sql`
- `alter table public.agent_tasks add column if not exists proposed_action jsonb;`
- Also (in same migration) update Verse: `update public.spawned_agents set tool_allowlist = '["publish_to_linkedin"]'::jsonb, system_prompt = <prompt + publish guidance> where slug = 'verse';`

### 3. runTask — `server/src/agents/routes.js`
- After the run (generic OR rich path), if `proposedActions?.length`, store the first as `proposed_action` when transitioning to `awaiting_approval`: `setState(id, 'awaiting_approval', { result, proposed_action: proposedActions[0] })`. (Rich subagents don't produce proposedActions; only generic ConfigDrivenAgent runs do in v1 — Verse is generic.)
- `tasks-repo.setState` must persist `proposed_action` when present (extend the patch passthrough).

### 4. Approve → execute — `server/src/agents/routes.js` approve handler
- On `POST /agents/tasks/:id/approve`: load task (must be `awaiting_approval`, else 409).
- If `task.proposed_action`: execute `await callTool(action.tool, action.input, undefined, undefined, { caller: { kind: 'human_approved' } })` (un-gated → actually publishes). On success → `setState(id, 'approved', { result: <append exec outcome> })` + broadcast. On thrown error → `setState(id, 'failed', { result: <error> })` + broadcast + respond 500 with the error.
- If no `proposed_action`: behave as today (just `approved`).
- Reject: unchanged — never executes.

### 5. Client — `useApprovals.js` + `Console.jsx`
- `useApprovals` normalization carries `proposed_action` (and `author`/`content` from its input) onto the merged agent item.
- Approvals card: when `proposed_action` present, render a `▲ Will publish to LinkedIn` banner + author + exact post text + a "no undo" note; the approve button label = "Approve & publish". If `proposed_action.input.author` is missing, show "author not set — reject & rephrase" and still allow reject.

### 6. Safety
- Structural gate: a gated tool cannot execute for a `spawned_agent` caller — only the approve handler (caller `human_approved`) executes it.
- Single-fire: the `awaiting_approval`-only guard prevents double-publish.
- No-undo surfaced in UI. Publish failure → `failed` state, error shown, nothing silently lost.

## Testing
- **Interception (server):** a `spawned_agent` call to `publish_to_linkedin` is captured into `proposedActions` and NOT executed (mock the underlying `publishLinkedInPost`); a non-gated tool still executes inline; a non-spawned caller executes the gated tool normally.
- **runTask:** a run returning `proposedActions` stores `proposed_action` on the task.
- **approve→execute:** approving a task with `proposed_action` calls the publish executor exactly once and ends `approved`; a throwing executor ends `failed`; reject executes nothing; double-approve blocked (409).
- **client:** Approvals card shows the publish banner + "Approve & publish" when `proposed_action` present; plain drafts render as before. Full client + server suites green; build clean.

## Prerequisite (Randy runs)
Apply `server/migrations/2026-06-15-proposed-action.sql` (adds the column + updates Verse). Idempotent.

## Out of scope (future)
- Author selection at approve-time (v1: agent proposes author).
- Additional gated tools (email send, etc.) — they just join `GATED_TOOLS` later.
- Scheduling posts (publish is immediate).
