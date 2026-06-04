# ARIA Roadmap

Single source of truth for what's done and what's left. Updated 2026-06-04.

This replaces the scattered phase notes in `CONTEXT.md` and `docs/superpowers/*`. When you finish or re-scope a phase, edit this file.

---

## ✅ Done

- **Phase 1 — Core agent + HUD** — ARIA agent loop, cosmic-orb HUD, tool suite (MRR/revenue/clients/memory/competitors/email/proposal/Buffer + Scout/Hunter/Creative sub-agents).
- **Phase: UI revamp** — on `feat/aria-ui-revamp-and-factory`.
- **Phase: Agent Factory** — research → spec/prompt → human approval → hot-register `dispatch_to_<slug>` tools from Postgres, zero restarts. Shadow→active→archived lifecycle, 3 containment layers. Server 77/77, client 48/48. PR #1 merged. **Echo** spawned as first live agent. See [PHASE-COMPLETE-agent-factory.md](docs/superpowers/PHASE-COMPLETE-agent-factory.md).

---

## 🔜 Next (no committed order — pick when starting a session)

### Phase A — Promote to `main`
Get `feat/aria-ui-revamp-and-factory` (revamp + factory, **86 commits** ahead of `origin/main`) onto the default branch. Nothing factory-related has shipped to `main` yet — this is a deliberate cutover, not automatic.
- **Done when:** `main` == revamp+factory line, pushed to origin, dev server runs clean off `main`.
- **Risk:** low (fully merged + tested), but it's the live branch — coordinate with running dev servers.

### Phase B — Build out Echo for real
Echo reasons well but has **no actual PDF tools**. Wire the PDF-ingest/extraction tools from Echo's `tools_wishlist`.
- **Done when:** Echo can ingest a real PDF and extract structured content end-to-end.

---

## 🗓️ Deferred (scoped but not scheduled)

### Revenue unblockers (config, not code — do anytime)
- **Stripe** — add `STRIPE_SECRET_KEY`; revenue currently reads $0.
- **Buffer** — add `BUFFER_ACCESS_TOKEN` + `BUFFER_PROFILE_ID`; `schedule_linkedin_post` errors without it.
- **Client MRR** — load client roster MRR into Supabase (or rely on Stripe) so the HUD stops showing $0.

### Phase C — "Phase 3" integrations
GitHub, Linear, PostHog, Intercom — stubbed/disabled in code (`CONTEXT.md:325`). Enable when there's a use case.

### Phase D — Hermes sub-agent
`delegate_to_hermes` spawn-per-call sub-agent for persistent memory / scheduled work. Full plan in `CONTEXT.md:512`.
- **Note:** that doc predates the Factory and labels itself "Phase 1" — numbering is stale; treat as a deferred candidate.
- **Validate with:** scheduled 8am MRR-vs-bridge check (exercises memory + scheduling + channel reach).

---

## Notes
- No formal dependency chain between phases — A and B are independent. Deferred items can jump the queue if a client need forces it.
- Keep this file current: it's the thing a fresh session should read first.
