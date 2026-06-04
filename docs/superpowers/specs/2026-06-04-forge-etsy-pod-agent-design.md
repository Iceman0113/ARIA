# Forge — Etsy Print-on-Demand Agent (Design Spec)

**Date:** 2026-06-04
**Status:** Design approved (brainstorming), pending implementation plan
**Branch:** `feat/forge-etsy-pod`
**Architecture:** Hybrid — Airtable (system of record + approval) · n8n (executor) · ARIA (brain + reporting)

## Purpose

Add a new income stream toward Randy's **$16,500/mo bridge**: a system (**Forge**)
that designs print-on-demand products, builds the Etsy listings, and runs the store
— with Randy approving every item before anything renders or publishes. It is built
on Randy's **existing Airtable + n8n + Claude stack**, not as a from-scratch
subsystem inside ARIA.

## Why hybrid (decided during brainstorming)

Randy already runs an n8n workflow shaped exactly like the merch pipeline:
`Airtable Trigger → Filter → HTTP Request (POST api.anthropic.com) → Code (JS) →
Update record (Airtable)`. Rather than rebuild that in ARIA, Forge **reuses it** and
adds two HTTP nodes (gpt-image-1, Printify). Airtable is a familiar, good approval
UI (a checkbox = "approve"). ARIA contributes only what it's uniquely good at: the
conversational concept brain and revenue reporting.

## Decisions locked

| Decision | Choice |
|---|---|
| Product type | Print-on-demand (physical, POD-fulfilled) |
| Fulfillment | **Printify** (already linked to Etsy) — Printify creates the Etsy listing |
| Image generation | **OpenAI `gpt-image-1`** |
| Topology | **Hybrid** — Airtable = record + gates, n8n = executor, ARIA = brain + reporting |
| Idea intake | All three: conversational (ARIA), backlog (Airtable), batch brief (Airtable) |
| Control points | **Two gates**, both as Airtable fields: Concept OK (Gate 1) + Publish (Gate 2) |
| Sequencing | Own phase. Priority: Stripe/Buffer config → **this** → Echo PDF / connectors |

## Responsibilities

| System | Role |
|---|---|
| **Airtable** | System of record + approval surface. One base; two checkbox/status fields are the two gates. |
| **n8n** | Executor. Airtable triggers → filter on status → HTTP to Claude / gpt-image-1 / Printify → write results back. Reuses Randy's existing pattern + 2 new HTTP nodes. |
| **ARIA** | Conversational concept brain (chat-to-develop) + merch-revenue reporting in the HUD. Writes concepts into Airtable, reads results back. |

## Pipeline (expressed in the stack)

Bold states are human-in-the-loop, performed as Airtable field edits.

```
Idea in Airtable (brief or backlog row)
  → n8n: HTTP → Claude            → writes concept fields, status = "Concept Ready"
  → **☑ Concept OK**              ← GATE 1 (Airtable checkbox)
  → n8n: HTTP → gpt-image-1 (render) → Printify (upload, draft product, mockups)
          HTTP → Claude (listing)    → writes mockup + listing, status = "Built"
  → **☑ Publish**                 ← GATE 2 (Airtable checkbox)
  → n8n: HTTP → Printify publish     → Etsy listing, status = "Published", etsy_listing_id
  → (reject) status = "Rejected", reject_reason  (optional: regenerate)
```

**Why two gates:** Gate 1 is cheap insurance — no image-gen or Printify spend until
Randy likes the *idea*. Gate 2 is the "nothing goes live without me" guarantee — the
Printify product is created **draft/unpublished**; publish-to-Etsy (the only
irreversible step) only fires when the Publish box is ticked.

## Idea intake — three front doors, one Airtable record

| Mode | Mechanism | Gate 1 |
|---|---|---|
| **Conversational** | ARIA `subagents/forge.js` LLM loop; Randy chats to develop a concept; ARIA writes the concept row to Airtable | Implicit — proceeds when Randy says "make it" (row written already past Gate 1, or with box pre-tickable) |
| **Backlog** | Randy adds raw-idea rows in Airtable anytime; n8n picks them up | Explicit — n8n writes concept, Randy ticks Concept OK |
| **Batch brief** | Randy adds brief rows in Airtable (theme/text/style/product); n8n expands each | Explicit — Randy ticks Concept OK per row |

## Deliverables (three parts — only one is ARIA repo code)

### 1. Airtable base schema (Randy applies; ARIA can create via API)
Base **"Forge Merch"**, table **"Items"** (single table keeps n8n simple):

- **Intake:** `Source` (chat/backlog/brief), `Raw Idea`, `Theme`, `Text/Slogan`,
  `Style`, `Product Type`, `Niche`
- **Concept:** `Art Direction`, `Image Prompt`
- **Gate 1:** `Concept OK` (checkbox)
- **Art/build:** `Art` (attachment/URL), `Printify Product ID`, `Mockups`
  (attachment/URLs)
- **Listing:** `Title`, `Description`, `Tags`, `Price`
- **Gate 2:** `Publish` (checkbox)
- **Result:** `Etsy Listing ID`, `Published At`, `Sales`/`Revenue` (optional sync)
- **Control:** `Status` (single select: New → Concept Ready → Built → Published /
  Rejected), `Reject Reason`, `Created At`

### 2. n8n workflows (Randy imports; ARIA provides node-by-node specs + JSON)
Three flows (or one with branches), each mirroring the existing
trigger→filter→HTTP→code→update pattern:

- **WF1 — Concept:** trigger on `Status = New` → HTTP Claude (expand idea→concept,
  incl. IP guardrail) → Code (parse) → update row (concept fields, `Status =
  Concept Ready`).
- **WF2 — Build:** trigger on `Concept OK = true` → HTTP gpt-image-1 (render art) →
  HTTP Printify (upload image, create **draft** product on blueprint+variants, fetch
  mockups) → HTTP Claude (listing copy) → update row (art, mockups, listing, `Status
  = Built`).
- **WF3 — Publish:** trigger on `Publish = true` → HTTP Printify (publish to the
  connected Etsy shop) → update row (`Etsy Listing ID`, `Published At`, `Status =
  Published`). Idempotency: skip if `Etsy Listing ID` already set.

The spec for each WF includes the exact HTTP method, URL, headers, and request-body
JSON for the Claude, gpt-image-1, and Printify calls, plus the Code-node JS.

### 3. ARIA repo code (built + tested here, TDD)
- `server/src/subagents/forge.js` — conversational intake (LLM loop, `scout.js`
  shape) that develops a concept with Randy and writes it to Airtable.
- `server/src/airtable.js` — thin Airtable client: create item row, read items
  (for reporting), update status.
- A merch-reporting tool (in `tools.js`) so ARIA can surface store performance
  (pending count, published count, revenue) in the HUD toward the bridge.
- Optional (Slice 3): a read-only HUD card mirroring the Airtable queue.

## Configuration

- **n8n credentials** (where the API calls originate): Anthropic (exists), **OpenAI**
  (new), **Printify** (new: API token + shop id), Airtable (exists).
- **ARIA `server/.env`:** `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` (to write concepts +
  read for reporting). Anthropic key already present.

Note: OpenAI/Printify keys live in **n8n**, not ARIA, since n8n makes those calls.

## Guards & risks

- **Draft-until-Gate-2:** Printify products created unpublished; publish only on the
  Publish checkbox.
- **Idempotent publish:** WF3 skips if `Etsy Listing ID` is set — no double-listing.
- **Daily cap:** WF2 can guard a per-day render count (Airtable rollup or n8n check)
  to cap image-gen spend.
- **Input sanitization:** treat `Raw Idea`/brief fields as untrusted in the Claude
  prompt (wrap, don't interpolate as instructions).
- **⚠️ IP / trademark (the big one):** Etsy + POD bans stores for copyrighted
  characters, brand logos, celebrity likenesses. The Concept (WF1) Claude prompt
  includes an explicit "no infringing IP" guardrail, and **Gate 1 is Randy's human
  check**. Single most likely way the store gets killed — designed in, not bolted on.
- **gpt-image-1 resolution:** outputs ~1024–1536px — fine for small/medium print
  areas, marginal for large all-over prints. Add an upscale HTTP node
  (e.g. Real-ESRGAN via Replicate) in a later slice only if a blueprint needs it.
- **State-sync:** Airtable is the single source of truth; ARIA never caches item
  state, it reads Airtable live. Avoids split-brain between ARIA and Airtable.
- **DRY concept prompt:** in Slice 2, n8n's WF1 should call an ARIA concept endpoint
  rather than duplicating the prompt. MVP keeps n8n-calls-Claude-directly for speed.

## Testing

- **ARIA code:** TDD, mock the Airtable client — concept parsing, row-write shape,
  reporting aggregation, conversational loop.
- **n8n + Airtable:** cannot be unit-tested from the repo; validated via **live
  smokes** — add a brief row → WF1 concept → tick Concept OK → WF2 art+draft+mockups
  → tick Publish → WF3 Etsy listing appears. Same live-verification reality the
  Agent Factory had.

## Build order (fastest-to-revenue first)

- **Slice 1 (MVP):** Airtable base + WF1/WF2/WF3 for the **brief/backlog** path, one
  product type (Randy's bread-and-butter), both gates, publish to Etsy. Mostly config
  on the existing stack — earns money fastest. ARIA: just the reporting read.
- **Slice 2:** ARIA **conversational** Forge intake (chat-to-develop), writing
  concepts into Airtable; move the concept prompt into an ARIA endpoint (DRY).
- **Slice 3:** Multiple product types/blueprints, regenerate-from-reject-reason,
  Scout niche research, richer ARIA HUD queue mirror, optional upscale node, sales
  sync into Airtable/HUD.

Each slice is independently shippable.

## Open items to confirm at build time

- **Slice 1 product type** — which blueprint is the proving ground (shirt/mug/poster/
  hoodie)? Randy to name his bread-and-butter.
- **Store niche** — supplied per-brief for now; Scout assist deferred to Slice 3.
- **Concepts per brief** — how many design candidates WF1 generates per brief row.

## Out of scope (YAGNI)

- Direct Etsy API control (Printify owns the listing).
- Order/fulfillment automation (Printify handles it; an n8n orders flow may already exist).
- Paid ads / promotion automation.
- AI-discovered niches beyond optional Scout assist in Slice 3.
