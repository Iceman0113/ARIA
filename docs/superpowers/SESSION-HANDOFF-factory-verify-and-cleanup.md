> ✅ **COMPLETED 2026-06-04.** All of Tasks 1–4 done; every live smoke passed; 2 live-only bugs fixed. Merged via PR #1 into `feat/aria-ui-revamp-and-factory`. See `PHASE-COMPLETE-agent-factory.md` for the closeout + how to start the next session. This file is kept for history only.

# Session Handoff — Factory Live Verification + Cleanup

**Start a fresh session in `/Users/randyjewell/ARIA/` and point it at this file.** Everything below is verified as of 2026-06-03. Work continues on branch **`feat/aria-agent-factory`** (currently at `f2c9e1c`, 25 commits ahead of `feat/aria-ui-revamp-and-factory`).

## Where things stand
The **ARIA Agent Factory** is **code-complete** — Tasks A1–H2 built via subagent-driven-development with per-task spec+quality review + a final holistic integration review (SHIP-READY). **73 server + 48 client tests pass, tree clean, nothing merged.** Plan: [`plans/2026-06-01-aria-agent-factory.md`](plans/2026-06-01-aria-agent-factory.md) (header marked `[CODE-COMPLETE]`). Memory: `~/.claude/.../memory/project_aria_agent_factory.md`.

## Hard rules (read before touching anything)
- **Never run a second dev server.** A backend (**plain `node src/index.js`** on :3001 — NOT `--watch`) and a Vite client are running for Randy. Do NOT run `npm run dev`, `bin/start.sh`, a bare `node src/index.js`, or `pkill` — a 2nd server collides on :3001. Plain-node means your edits do NOT auto-reload; the server must be restarted manually to pick them up (see Task 1).
- **Verify code with `npm test` / `node --check` / `npx vite build`** (in `server/` and `client/`), never by booting a server.
- **`ANTHROPIC_API_KEY` false-negative:** plain `dotenv.config()` reports it empty (Claude Code injects an empty one); the real key IS in `server/.env`. Use `dotenv.config({ override: true })`. Don't escalate over it.
- Recommended skill: **subagent-driven-development** for the cleanup batch (Tasks 2–4). Task 1 is manual verification only.
- End commit bodies with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## TASK 1 — Agent Factory live verification (BLOCKING; only Randy can do the live parts)
The whole feature is unit-tested but never run against live Supabase/APIs. Sequence:

1. **Apply the schema migration.** In the Supabase SQL editor (project = `SUPABASE_URL` in `server/.env`), paste ALL of `server/schema.sql` and run it (idempotent). Adds `spawn_tasks`, `spawned_agents`, `research_reports` + realtime publication. *Nothing factory-related works until this runs.* If it errors with "publication supabase_realtime does not exist", run `CREATE PUBLICATION supabase_realtime;` first, then re-run.
2. **Restart the servers** so the new code loads: `cd /Users/randyjewell/ARIA && bin/stop.sh && bin/start.sh` (the running backend predates this code; the Vite `/factory` proxy also needs a restart). Confirm boot log shows `Factory: ✓ RegistryWatcher running` and `[registry-watcher] realtime channel: SUBSCRIBED`.
3. **Run the deferred smokes** (full detail in plan Tasks B3 Steps 2-3, F5, G3, and the Final §15 checklist):
   - **B3** — research CLI hits real Serper/Anthropic: `cd server && node src/factory/research-cli.js "competitor pricing intelligence for indianapolis MSPs"` → valid Skills Report; run twice → 2nd is a `CACHED` hit.
   - **F5** — end-to-end: insert a `spawn_tasks` row (or tell ARIA "make me an agent called Echo that monitors PDF extraction"), watch the pipeline reach `awaiting_approval` + HUD card → `curl -X POST :3001/factory/tasks/<ID>/approve` → server logs `[registry-watcher] + dispatch_to_echo (shadow)` within ~1s → dispatch from ARIA (logs show `[SHADOW] dispatch_to_echo ←`) → `/promote` (drops [SHADOW]) → `/archive` (logs `- dispatch_to_echo`). **No restart between any of these.**
   - **G3** — reconnect-survival: with a task awaiting approval, hard-refresh the front-end, open `/factory` → the card is still there (hydrated from `GET /factory/pending`).
   - **Daily cap** — insert 5 non-failed tasks dated today, then spawn one more → it lands `failed` with `daily spawn cap reached (5/day)`.
   - **Audit chain SQL** (plan Final §15): every `spawned_agents` row joins back to its `spawn_tasks` + `research_reports` with no NULLs.
4. **Then decide integration** (finishing-a-development-branch): merge `feat/aria-agent-factory` into `feat/aria-ui-revamp-and-factory`, or open a PR.

---

## TASK 2 — 🐛 Dead model-ID bug (real, do first; ~2 min)
`server/src/tools.js` lines **536** and **584** pin the decommissioned model `claude-sonnet-4-20250514` for `draft_conversion_email` and `generate_proposal` → both tools error on every call. **Fix:** change both to `claude-sonnet-4-6` (the known-good ID). Grep the whole repo for `claude-sonnet-4-20250514` to catch any other occurrences. Verify `cd server && npm test` (73 pass) + `node --check src/tools.js`. Commit. *(Memory `reference_intellisite_github` tracks this dead pin.)*

---

## TASK 3 — Non-urgent cleanup (verify-then-act)
- **Delete unused legacy components** *(verify each is truly unimported first — the UI revamp may have changed usage)*: `client/src/components/{Chat,Dashboard,Clients,Memory,Alert,TextInput}.jsx`. For each, `grep -rn "<Name" client/src` and `grep -rn "from.*components/<Name>" client/src` → if zero hits, delete. (Note: `Orb.jsx` from the original list no longer exists.) Run `cd client && npx vite build && npm test` after.
- **`MAX_TTS_CHARS = 850`** in `client/src/App.jsx` — leftover ElevenLabs-era truncation ("Full response is in the chat."). Edge TTS has no quota; safe to remove the truncation in the non-streaming `speakText` path.
- **System Diag** panel shows simulated random CPU/RAM/swap, not real metrics — either wire real metrics or label it clearly.

---

## TASK 4 — Minor items noticed during the Factory build (optional polish)
- `client/src/pages/Factory.jsx` hardcodes `const remaining = 3 - iters` (duplicates server `MAX_REVISIONS`); cosmetic only, server enforces the real cap.
- `server/agent-specs/*.md` (generated at runtime by `spec.js`) are not gitignored — consider adding `server/agent-specs/*.md` to `.gitignore` (keep `.gitkeep`).
- `RegistryWatcher.start()` isn't idempotent (a 2nd call would leak the poll interval) — only matters if something ever calls `start()` twice; add a guard if you touch it.

---

## Env / integrations status (so you don't chase phantoms)
`server/.env` already has keys for: ANTHROPIC, SUPABASE (url+service+anon), SERPER, STRIPE_SECRET_KEY, BUFFER (token+profile), LINKEDIN, ELEVENLABS. So Stripe/Buffer are *configured* — CONTEXT.md's "not connected" notes are stale. HUD MRR shows **$0** because there's no client MRR data in Supabase (data entry, not code). Phase-3 integrations (GitHub, Linear, PostHog, Intercom) are intentionally disabled.

## Suggested order for the new session
Task 2 (quick bug) → Task 3 (cleanup, build+test gated) → Task 4 (optional) → then hand Task 1's live steps to Randy (or walk through them together). Read `CONTEXT.md` for broader ARIA architecture if needed.
