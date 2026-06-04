# Phase Closeout — Agent Factory (COMPLETE)

**Closed 2026-06-04.** The ARIA Agent Factory is built, hardened, live-verified against the real stack, and merged. This doc is the clean handoff for starting the **next** phase in a fresh session.

## What this phase delivered
- **Agent Factory**: research → draft spec/prompt → human approval → hot-register `dispatch_to_<slug>` tools from Postgres config rows, **zero server restarts** (Supabase Realtime). One generic `ConfigDrivenAgent` runtime; shadow → active → archived lifecycle; 3 containment layers.
- **Cleanup (Tasks 2–4)**: dead model-ID fix; removed 6 unused legacy components + obsolete TTS truncation; SIM labels on simulated metrics; gitignored generated specs; idempotent `RegistryWatcher.start()`; de-magicked client revision cap.
- **Two live-only bugs fixed** (unit tests mock Anthropic, so these were invisible until live):
  - `a117a41` — internal `factory_allowed` marker leaked into the Anthropic `tools` array → **every chat + dispatch 400'd**. Fixed with `toApiTools()` in `server/src/tools.js`, applied at `agent.js` + `factory/runtime.js`.
  - `dafeef2` — `approve` returns a friendly 409 on duplicate slug instead of a raw 500.

## Verification (all green)
- Live smokes: migration ✓ · boot + realtime `SUBSCRIBED` ✓ · B3 research+cache ✓ · F5 full lifecycle ✓ · daily-cap 5/day ✓ · audit-chain no-NULLs ✓ · G3 reconnect-survival ✓
- Tests: **server 77/77, client 48/48**, clean vite build
- **Echo** is live as the first real Factory-spawned agent (slug `echo`, status `active`).

## Git state
- All work is on **`feat/aria-ui-revamp-and-factory`** (and `feat/aria-agent-factory`, both at the same commit). PR #1 **MERGED**. Both branches pushed to `origin` (github.com/Iceman0113/ARIA).
- **Not yet on `main`.** `feat/aria-ui-revamp-and-factory` is ~80 commits ahead of `origin/main`. Promoting the revamp+factory line to `main` is a **separate, deliberate decision** — nothing factory-related has shipped to the default branch.
- `feat/aria-agent-factory` is safe to delete (fully merged); it's currently the checked-out branch the live dev server runs on.

## Live-environment facts the next session needs
- **Don't run a second server.** Start/stop via `bin/start.sh` / `bin/stop.sh` (server :3001, client :5174). `npm run dev` = `node --watch`, so **edits hot-reload** — no manual restart needed for code changes.
- **Verify code with `npm test` / `node --check` / `npx vite build`**, never by booting a server.
- **`ANTHROPIC_API_KEY` false-negative:** Claude Code injects an empty key into the shell; the real key is in `server/.env`. Scripts must use `dotenv.config({ override: true })` (the factory CLIs already do).
- End commit bodies with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Test data in Supabase (jopardijgbzvfncfborn)
- Real, keep: Echo agent + its task `1f226f41` + research report `c7746893`; rejected duplicate task `42213605` (history).
- All daily-cap / archtest / g3 throwaways were cleaned up.

## To start the next session
1. Open a fresh session in `/Users/randyjewell/ARIA/`.
2. Tell it the next phase goal (TBD — define when you start). Two obvious candidates if you want a default:
   - **Promote to `main`**: get `feat/aria-ui-revamp-and-factory` (revamp + factory) onto the default branch.
   - **Build out Echo for real**: wire the PDF-ingest/extraction tools from Echo's `tools_wishlist` (currently Echo reasons but has no real PDF tools).
3. The auto-memory (`project_aria_agent_factory`) will surface this context automatically.
