# ARIA Roadmap

Single source of truth for what's done and what's left. Updated 2026-06-04.

This replaces the scattered phase notes in `CONTEXT.md` and `docs/superpowers/*`. When you finish or re-scope a phase, edit this file.

---

## ✅ Done

- **Phase 1 — Core agent + HUD** — ARIA agent loop, cosmic-orb HUD, tool suite (MRR/revenue/clients/memory/competitors/email/proposal/Buffer + Scout/Hunter/Creative sub-agents).
- **Phase: UI revamp** — on `feat/aria-ui-revamp-and-factory`.
- **Phase: Agent Factory** — research → spec/prompt → human approval → hot-register `dispatch_to_<slug>` tools from Postgres, zero restarts. Shadow→active→archived lifecycle, 3 containment layers. Server 77/77, client 48/48. PR #1 merged. **Echo** spawned as first live agent. See [PHASE-COMPLETE-agent-factory.md](docs/superpowers/PHASE-COMPLETE-agent-factory.md).
- **Phase A — Promote to `main`** ✅ 2026-06-04 — revamp+factory line is now the default branch (`d9f6789`). During cutover, discovered a stray PWA commit (`79d8a99`, May 25) that had been sitting on `origin/main` and was never picked up by the revamp line; merged it in (resolved `package.json`, regenerated lockfile, verified `vite build` emits `sw.js`). `main` and `feat/aria-ui-revamp-and-factory` are now in sync. `feat/aria-agent-factory` is stale (left at `9004b63`) — safe to delete.
- **Phase B Slice 1 — Echo PDF tools** ✅ 2026-06-06 — `read_pdf` tool (`server/src/pdf.js`): reads a PDF by local path or http(s) URL, Claude-native document extraction (text/tables/scanned), `<untrusted-source>`-wrapped for injection safety. Registered `factory_allowed: true` in `tools.js` + added to Echo's Supabase `tool_allowlist` (hot-reloads). Server 102/102; live-verified by path + URL. Merged to `main` @ `8406aae`. Slice 2 (autonomous monitoring) is in Next.
- **Forge — Etsy POD pipeline (MVP + Slice 2)** ✅ 2026-06-06 — GitFunny store: idea → AI design (Ideogram) → Printify product → **live Etsy listing**, with two human gates (`Concept OK`, `Publish`). Hybrid stack: Airtable (`Products` table) = record + gates, n8n WF1/WF3 (concept/publish) + a **local worker** (`server/forge-worker.js`, run via `bin/forge-worker.sh`) that handles design-gen + human-in-the-loop background removal via `~/Desktop/Forge/{inbox,ready,done}` (replaces n8n WF2). Slice 2: worker auto-derives the `Image Prompt` via Claude. First live listing: etsy.com/listing/4516889318. Server 91/91. Spec/plan in `docs/superpowers/specs|plans/2026-06-04-forge-*`. **⛔ Operational gate:** add Replicate credit (~$5 ≈ 150 designs) — free allowance is spent, so no new designs generate until billing is added.

---

## 🔜 Next (no committed order — pick when starting a session)

### Phase B Slice 2 — Echo autonomous PDF monitoring
Slice 1 (the `read_pdf` tool) shipped — see Done. Slice 2 is Echo's full "persistent monitor" vision: `list_pdfs(folder)`, a hash **ledger** (new-vs-revised detection), folder-watching + a scheduler for autonomous runs, and alerting via Echo's existing tools. Spec/plan: `docs/superpowers/specs|plans/2026-06-06-echo-pdf-tools-*`.

---

## 🗓️ Deferred (scoped but not scheduled)

### Revenue unblockers (config, not code — do anytime)
- **Stripe** — add `STRIPE_SECRET_KEY`; revenue currently reads $0.
- **Buffer** — add `BUFFER_ACCESS_TOKEN` + `BUFFER_PROFILE_ID`; `schedule_linkedin_post` errors without it.
- **Client MRR** — load client roster MRR into Supabase (or rely on Stripe) so the HUD stops showing $0.

### Phase C — "Phase 3" integrations
GitHub, Linear, PostHog, Intercom — stubbed/disabled in code (`CONTEXT.md:325`). Enable when there's a use case.

### Forge — future slices (Slice 3+)
Not needed to operate/earn. Conversational "chat with Forge" intake · multiple product types/blueprints · regenerate-from-reject-reason · Scout suggesting trending niches · transparent-bg remover (needs Replicate billing) · sales/revenue sync into Airtable + HUD · live WF3 wait already bumped to 60s in repo (apply in n8n).

### Phase D — Hermes sub-agent
`delegate_to_hermes` spawn-per-call sub-agent for persistent memory / scheduled work. Full plan in `CONTEXT.md:512`.
- **Note:** that doc predates the Factory and labels itself "Phase 1" — numbering is stale; treat as a deferred candidate.
- **Validate with:** scheduled 8am MRR-vs-bridge check (exercises memory + scheduling + channel reach).

---

## Notes
- No formal dependency chain between phases — A and B are independent. Deferred items can jump the queue if a client need forces it.
- Keep this file current: it's the thing a fresh session should read first.
