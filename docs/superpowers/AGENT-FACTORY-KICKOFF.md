# Agent Factory — Session Kickoff

**Start a fresh session and point it at this file + the plan.** Pre-flight is already done (2026-06-03); everything below is verified so you can begin executing immediately.

## What this is
Build the **ARIA Agent Factory** — a meta-sub-agent that researches, drafts, gets approval for, and hot-registers new sub-agents from pure-config rows in Postgres, with **zero server restarts** and no bespoke JS per spawned agent.

- **Plan (execute this):** [`plans/2026-06-01-aria-agent-factory.md`](plans/2026-06-01-aria-agent-factory.md) — ~176 steps, self-contained, checkbox-tracked.
- **Spec (reference, the `§N` anchors point here):** [`specs/2026-06-01-aria-agent-factory-design.md`](specs/2026-06-01-aria-agent-factory-design.md)

## How to run it
- **Skill:** the plan header recommends **`superpowers:subagent-driven-development`** (preferred — independent tasks) or `superpowers:executing-plans`. Use TDD per task; tasks have RED→GREEN steps.
- **Structure:** Pre-flight `Task 0` → task groups **A1–A4, B1–B3, C1–C4, D1–D2, E1–E2, F1–F5, G1–G3 (front-end), H1–H2** → final commit.
- **Architecture:** 3 new Supabase tables (`spawn_tasks`, `spawned_agents`, `research_reports`) drive a state-machine pipeline (`pending → researching → drafting_spec → writing_prompt → awaiting_approval → approved`). One generic `ConfigDrivenAgent` runtime reads a row and runs a vanilla Claude tool-use loop, parameterized by `system_prompt` + `tool_allowlist`. A `RegistryWatcher` listens to Supabase Realtime and (un)registers `dispatch_to_<slug>` tools live. Approval is a REST gate with HUD-card + `/factory` page. Security = sanitize input + `<untrusted-source>` tags on web content + hard ban on Hermes from spawned agents.

## Pre-flight status (verified 2026-06-03 — all green)
- Node **v20.20.2** ✓ · ANTHROPIC/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SERPER **all set** ✓ · git tree **clean** ✓
- New dep **`zod`** is NOT installed yet — that's expected; **Task A1** installs it (`vitest` already in).

## Gotchas the new session MUST know
1. **ANTHROPIC_API_KEY false-negative:** Task 0 Step 2's check `dotenv.config()` (no override) reports ANTHROPIC **missing** because Claude Code injects an empty `ANTHROPIC_API_KEY` into the env. **The key IS set** (108 chars in `server/.env`; the server runs on it). Verify with `dotenv.config({ override: true })`. **Do NOT "stop and tell Randy"** over this — it's a known false alarm.
2. **Dev server `--watch` drops WebSocket clients:** `bin/start.sh` runs the server under `node --watch`, so **every** `server/src/*` edit auto-restarts it and disconnects the live ARIA client. During active server-side dev, run the server as plain `node src/index.js` (no auto-reload; restart manually after edits). Client edits are fine — Vite HMR on :5174. **Never `pkill -f "npm run dev"`** — it kills both the server AND the client Vite.
3. **Supabase schema is a manual step:** the plan appends new tables to `server/schema.sql` (Task A2), but they only take effect after Randy **pastes the migration into the Supabase SQL editor and runs it**. Flag this to Randy when the plan reaches it — code that reads the new tables will no-op until then.
4. **Branch:** currently on `feat/aria-ui-revamp-and-factory` (UI revamp A–F complete & committed). Task 0 Step 4 says create a branch — decide whether to continue here or branch `feat/aria-agent-factory` off current HEAD. Tree is clean either way.
5. **Confirm-before-delegating rule is live:** commit `eb1c033` added a system-prompt rule making ARIA ask before calling delegate tools. The Agent Factory adds *new* `dispatch_to_<slug>` tools — keep that confirmation UX consistent for spawned agents.

## Context
- Project: `/Users/randyjewell/ARIA/` — voice-first AI co-founder for Jack & Jewell Consulting. Read `CONTEXT.md` first.
- Auto-memory (`project_aria_build.md`) loads the full build history automatically.
