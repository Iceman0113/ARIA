# Forge — n8n Workflow Import Pack

Importable n8n workflows for **Slice 1** of the Forge Etsy POD pipeline. They cover
**Tasks 3–5** of the implementation plan
(`docs/superpowers/plans/2026-06-04-forge-etsy-pod-slice1.md`):

- `wf1-concept.json` — **WF1**: new Airtable row → Claude expands idea → concept + Etsy copy written back (`Status = Concept Ready`).
- `wf2-build.json` — **WF2**: `Concept OK` ticked → gpt-image-1 renders art → Printify uploads + creates a **draft** product → mockups written back (`Status = Built`).
- `wf3-publish.json` — **WF3**: `Publish` ticked → Printify publishes to Etsy → `Etsy Listing ID` written back (`Status = Published`).

> These are a **head start, not turnkey.** n8n node parameter schemas vary by version,
> so after import open each node and confirm it looks right (especially the Airtable
> Trigger and Airtable Update nodes). Everything high-value — URLs, request bodies,
> prompts, wiring, the JSON-shape-defensive code — is filled in.

## Before importing

1. **Airtable `Items` table** exists with the fields from Plan Task 1, **plus a field
   named exactly `Last Modified`** of type *Last modified time* (the Airtable Trigger
   polls on it; without it the triggers won't fire on checkbox edits).
2. **n8n credentials** created (Plan Task 2). On import, each node will show its
   credential unset — pick the matching one:
   | Node credential slot | Create a credential of type | Holds |
   |---|---|---|
   | `Airtable account` | Airtable Personal Access Token | your Airtable PAT |
   | `Anthropic x-api-key` | Header Auth | header `x-api-key` = your Anthropic key |
   | `OpenAI Bearer` | Header Auth | header `Authorization` = `Bearer <OPENAI_API_KEY>` |
   | `Printify token` | Header Auth | header `Authorization` = `Bearer <PRINTIFY_API_TOKEN>` |
3. **IDs captured** from Plan Task 0 (Printify catalog curls).

## Placeholders to replace after import

Search each workflow for `<<...>>` and the `TODO` line:

| Placeholder | Where | Value |
|---|---|---|
| `<<AIRTABLE_BASE_ID>>` | all 3 workflows, trigger + update nodes | your `appXXXXXXXX` |
| `<<SHOP_ID>>` | WF2 "Printify Create Product" URL · WF3 "Printify Publish" + "Get Product" URLs | your Etsy-connected Printify shop id |
| `PROVIDER_ID`, `VARIANTS`, `PRICES` | **WF2 → "Build Product Req" Code node** (the `TODO` block at the top) | your blueprint-6 print-provider id + 5 variant ids |

All the Printify product IDs live in **one Code node** (`Build Product Req`) so you set
them in a single place.

## Import + activate

1. n8n → **Workflows → Import from File** → `wf1-concept.json`. Repeat for WF2, WF3.
2. In each workflow, map the 4 credentials and replace the placeholders above.
3. **Test inactive first:** add a test row in Airtable (`Status = New`,
   `Raw Idea = "funny cat dad, retro 70s sunset"`) and use n8n's **Execute Workflow**
   on WF1 to dry-run. Confirm the row gets `Concept Ready` + copy. Then tick
   `Concept OK`, Execute WF2; then `Publish`, Execute WF3.
4. Once a full manual run produces a real Etsy listing (Plan Task 7), **Activate** all
   three so the Airtable Triggers run them automatically.

## Notes / gotchas

- **Both Airtable output shapes handled.** Some n8n versions return record fields
  flattened (`$json["Title"]`), others nested (`$json.fields.Title`). Every Code/Filter
  node uses `($json.fields || $json)` so it works either way.
- **Idempotent publish.** WF3 only fires when `Etsy Listing ID` is empty, so re-saving a
  published row won't create a duplicate listing (Plan Task 7, Step 5).
- **Draft until you say so.** WF2 creates the Printify product *unpublished*. Nothing
  reaches Etsy until `Publish` is ticked and WF3 runs.
- **Etsy publish lag.** WF3 waits 15s after the publish call before reading back the
  `external.id`. If Printify is still mid-publish, the row stays `Built` with an empty
  `Etsy Listing ID` — just re-tick `Publish` (or raise the Wait).
- **Daily-cap guard (Plan Task 6)** is *not* included here — add an Airtable-count
  check before the gpt-image-1 node in WF2 if you want a hard spend cap.
- **IP/trademark guardrail** lives in WF1's system prompt; `Concept OK` (Gate 1) is your
  human check before any render spend.
