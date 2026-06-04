# Forge — Etsy Print-on-Demand Agent (Design Spec)

**Date:** 2026-06-04
**Status:** Design approved (brainstorming), pending spec review → implementation plan
**Branch:** `feat/forge-etsy-pod`

## Purpose

Add a new income stream toward Randy's **$16,500/mo bridge** target: a sub-agent
(**Forge**) that designs print-on-demand products, builds the Etsy listings, and
runs the store — with Randy approving every item before anything renders or
publishes. This is a standalone new subsystem, not a modification of the Agent
Factory, though it deliberately reuses the Factory's proven patterns (state-machine
pipeline, human approval gate, Supabase Realtime HUD card).

## Context / existing building blocks

- **Sub-agents** (`server/src/subagents/`): Scout (research), Hunter (leads),
  Creative (copy in Randy's voice), Hermes, shared web tools. Each is an LLM loop
  with a system prompt that returns structured output. Forge follows this shape.
- **Agent Factory** (`server/src/factory/`): pipeline state machine +
  `awaiting_approval → approve` gate + `RegistryWatcher` (Supabase Realtime) + a
  `/factory` HUD page. Forge reuses these mechanics, not the Factory runtime
  itself.
- **No image generation, Etsy, Printify, or commerce code exists today** — this is
  greenfield. The store's fulfillment partner is **Printify (already connected to
  the Etsy store)**, so Printify publishes listings to Etsy; ARIA does **not** need
  the Etsy API directly.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Product type | Print-on-demand (physical, POD-fulfilled) |
| Fulfillment | **Printify** (already linked to Etsy) — Printify creates the Etsy listing |
| Image generation | **OpenAI `gpt-image-1`** (best all-round prompt adherence + text rendering; per-image cost amortized across sales) |
| Architecture | **Approach A** — dedicated Forge sub-agent + pipeline, reusing the Factory approval gate |
| Idea intake | **All three** modes: conversational, backlog, batch brief |
| Control points | **Two gates** — concept approval (Gate 1) and final listing approval (Gate 2) |
| Sequencing | Its own phase. Priority: revenue-config unblockers (Stripe/Buffer) → **this** → Echo PDF / connectors |

## Pipeline (state machine)

Modeled on the Factory pipeline. Bold states are human-in-the-loop.

```
idea               ← captured from any of the 3 intakes
  → Forge expands into a concrete concept (product type, art direction, text/slogan, niche)
concept
  → **concept_approved**   ← GATE 1: Randy blesses the idea before anything renders
rendering          ← gpt-image-1 produces print-ready art → stored in Supabase Storage
building           ← Printify creates a DRAFT product (blueprint + variants + mockups);
                     Creative writes title/description/tags/price
  → **awaiting_approval**  ← GATE 2: Randy sees real mockup + listing + price
  → approved → published (Printify publishes to Etsy)
  → rejected → archived    (optional: regenerate from the reject reason)
```

**Why two gates:** Gate 1 is cheap insurance — no image-gen or Printify spend until
Randy likes the *idea*. Gate 2 is the "nothing goes live without me" guarantee — the
Etsy listing only publishes on approval. The Printify product is created **draft/
unpublished** and only publish-to-Etsy is irreversible, gated behind Gate 2.

## Idea intake — three front doors, one pipeline

All three converge on the same `idea`/`concept` stage, so they are thin adapters,
not three subsystems.

| Mode | Mechanism | Gate 1 |
|---|---|---|
| **Conversational** | `subagents/forge.js` LLM loop; Randy chats to develop a concept, Forge riffs | Implicit — proceeds when Randy says "make it" |
| **Backlog** | `merch_ideas` table; Randy drops raw ideas anytime, Forge works the queue | Explicit — each concept returns for yes/no |
| **Batch brief** | Structured brief (theme, text, style, product) expands into N concepts | Explicit — Randy picks which concepts proceed |

## Components & file layout

Mirrors `factory/`.

- `server/src/forge/`
  - `states.js` — states + legal transitions
  - `pipeline.js` — orchestrates idea → concept → render → build → awaiting → publish
  - `concept.js` — Forge's concept-expansion brain (Claude **Sonnet**, per model-tiering preference)
  - `repo.js` — Supabase access for `merch_ideas` + `merch_items`
  - `routes.js` — REST endpoints (below)
- `server/src/subagents/forge.js` — conversational intake (LLM loop, `scout.js` shape)
- `server/src/image.js` — `gpt-image-1` wrapper (transparent background, returns image bytes). **Resolution note:** `gpt-image-1` outputs up to ~1024–1536px; that's fine for small/medium print areas but marginal for large all-over prints. If a blueprint needs more, add an upscale step (e.g. Real-ESRGAN via Replicate) in a later slice — not in MVP.
- `server/src/printify/client.js` — Printify API client: upload image, list blueprints/print-providers/variants, create draft product, fetch mockups, publish to the Etsy-connected shop
- **Reuse** `server/src/subagents/creative.js` — listing copy in Randy's voice
- `client/src/pages/Merch.jsx` — approval queue UI (mirrors `Factory.jsx`), + HUD card + NavChip

### REST endpoints (`forge/routes.js`)

- `POST /forge/brief` — submit a batch brief → creates `idea`/`concept` rows
- `POST /forge/idea` — add a backlog idea
- `GET  /forge/pending` — items at either gate (rehydrates HUD after refresh)
- `POST /forge/items/:id/approve-concept` — Gate 1 pass → `rendering`
- `POST /forge/items/:id/approve` — Gate 2 pass → publish to Etsy
- `POST /forge/items/:id/reject` — reject (+reason) → archived (optional regen)

## Data model (Supabase)

Two new tables + realtime publication (matching the factory pattern). Generated art
goes to a Supabase Storage bucket `merch-art`, referenced by path.

**`merch_ideas`** (backlog)
- `id` uuid pk, `source` text (`chat|backlog|brief`), `raw_idea` text,
  `status` text (`new|picked|done`), `created_at` timestamptz

**`merch_items`** (pipeline)
- `id` uuid pk, `idea_id` uuid fk null, `state` text (enum of pipeline states)
- `brief` jsonb, `concept` jsonb (`product_type`, `art_direction`, `text`, `niche`)
- `art_path` text (Storage ref), `printify_product_id` text, `mockup_urls` jsonb
- `listing` jsonb (`title`, `description`, `tags`, `price`)
- `etsy_listing_id` text, `reject_reason` text
- `created_at`, `updated_at`, plus audit fields

## External integrations & config

New `server/.env` values:
- `OPENAI_API_KEY` — `gpt-image-1`
- `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID` — the Etsy-connected Printify shop

Anthropic key is reused for Forge concept-expansion + Creative copy.

## Guards & risks

- **Daily cap** on image generations (runaway-spend backstop), mirroring the
  factory daily-cap.
- **Draft-until-Gate-2**: Printify products are created unpublished; publish-to-Etsy
  (the only irreversible action) requires Gate 2 approval.
- **Idempotent publish**: guard on `etsy_listing_id` so an item can't double-list.
- **Input sanitization** on briefs/ideas (reuse factory sanitize approach).
- **⚠️ IP / trademark risk (the big one):** Etsy + POD bans stores for copyrighted
  characters, brand logos, and celebrity likenesses. Forge's `concept.js` includes
  an explicit "no infringing IP" guardrail in its system prompt, and **Gate 1 is
  Randy's human check** on it. This is the single most likely way an automated merch
  store gets killed — called out so it's designed in, not bolted on.

## Testing

- **TDD.** Unit tests mock OpenAI + Printify the way factory tests mock Anthropic:
  state transitions, gate logic, idempotent publish, concept parsing, route
  contracts, daily-cap.
- **Live-only smokes** (real `gpt-image-1` + Printify): render → draft product →
  mockups → Gate 2 → publish to Etsy. Same live-verification reality the factory
  had (mocked tests can't exercise the real external APIs).

## Build order (MVP-first — it's revenue)

- **Slice 1 (MVP):** Batch brief → one product type (e.g. t-shirt) → both gates →
  publish to Etsy. Proves the whole spine; earns money immediately.
- **Slice 2:** Conversational intake + backlog.
- **Slice 3:** Multiple blueprints/product types, regenerate-from-reason, optional
  Scout trend research to suggest niches.

Each slice is independently shippable.

## Out of scope (YAGNI)

- Direct Etsy API control (Printify owns the listing).
- Automated order/fulfillment management (Printify handles it).
- Paid ads / promotion automation.
- AI-discovered niches beyond optional Scout assist in Slice 3.
