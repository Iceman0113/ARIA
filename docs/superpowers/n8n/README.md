# Forge — n8n Workflow Pack (adapted to the live GitFunny base)

Slice 1 of the Forge Etsy POD pipeline, wired to your **existing** GitFunny Airtable
base (`app9HMypY5XkOlD9N`, table **`Products`**, id `tblZkGoYmTblzII7O`). We reuse your
fields and your copy-drafting flow; Forge adds the art + Printify build + publish steps.

## Files

- `wf1-existing-flow-enhancement.md` — **WF1**: two tiny edits to your *existing*
  copy-drafting flow so it also outputs an `Image Prompt`. (No new flow to import.)
- `wf2-build.json` — **WF2** (new): `Concept OK` ticked → **Ideogram (via Replicate)**
  renders art → Printify uploads it by URL + creates a **draft** product → mockups
  written back, `Status = Built`.
- `wf3-publish.json` — **WF3** (new): `Publish` ticked → Printify publishes to Etsy →
  `Etsy Listing ID` written back, `Status = live`.

Pipeline in your status vocabulary:
`idea → (your flow) Drafted → ☑Concept OK → (WF2) Built → ☑Publish → (WF3) live`
(reject → `Paused`).

> Still a **head start, not turnkey** — n8n node schemas vary by version; after import,
> open each node and confirm it looks right (especially the Airtable nodes).

## Before importing — add 5 fields + 1 status to `Products`

| Add field | Type | Purpose |
|---|---|---|
| `Image Prompt` | Long text | feeds gpt-image-1 (also used by the WF1 enhancement) |
| `Concept OK` | Checkbox | **Gate 1** |
| `Publish` | Checkbox | **Gate 2** |
| `Mockups` | Attachment | review the rendered tee |
| `Last Modified` | Last modified time | n8n trigger field |

And add one `Status` option: **`Built`** (between `Drafted` and `live`).

Everything else maps to fields you already have: `Name` (the idea/slogan), `Title`,
`Description`, `Tags`, `Printify ID`, `Etsy Listing ID`, `Revenue`, `Status`.

## n8n credentials (map on import)

| Node credential slot | Credential type | Holds |
|---|---|---|
| `Airtable account` | Airtable PAT | your `patwK...` token (already proven to work) |
| `Replicate token` | Header Auth | `Authorization` = `Bearer <REPLICATE_TOKEN r8_...>` (Ideogram) |
| `Printify token` | Header Auth | `Authorization` = `Bearer <PRINTIFY_API_TOKEN>` (the JWT) |

> Credential **names** don't have to match — on import you pick a credential per node
> from a dropdown, so whatever you named them (e.g. "ARIA") is fine.

(The Anthropic credential is already on your existing flow.)

## Placeholders — all filled ✅

Everything is baked in (2026-06-04): base `app9HMypY5XkOlD9N` / table `Products`,
Printify shop `27681721` (your Etsy store), provider `29` (Monster Digital), variants
`12102/12101/12100/12103/12104` (Bella+Canvas 3001, White, S–2XL) at $24.99 (2XL $26.99).
Nothing to paste. To change color/sizes/prices later, edit the constants in WF2's
"Build Product Req" Code node.

## Import + test

1. Do the **WF1 enhancement** edits (see that file) on your existing flow.
2. n8n → **Import from File** → `wf2-build.json`, then `wf3-publish.json`.
3. Map the 3 credentials; fill the Printify placeholders.
4. **Dry-run inactive:** take a `Drafted` row with an `Image Prompt`, tick `Concept OK`,
   **Execute** WF2 → expect `Printify ID` + `Mockups` + `Status = Built`, product
   **unpublished** in Printify. Then tick `Publish`, **Execute** WF3 → expect
   `Etsy Listing ID` + `Status = live`, listing live on Etsy.
5. Once a full run works, **Activate** WF2 + WF3.

## Gotchas

- **Both Airtable output shapes handled** — every Code/Filter node uses
  `($json.fields || $json)` so flattened vs nested record output both work.
- **Idempotent** — WF2 skips rows that already have a `Printify ID`; WF3 skips rows that
  already have an `Etsy Listing ID`. No double-builds or double-listings.
- **Draft until Publish** — WF2 creates the Printify product unpublished; nothing hits
  Etsy until `Publish` is ticked and WF3 runs.
- **Etsy lag** — WF3 waits 15s after publishing before reading back `external.id`. If
  Printify is still mid-publish the row stays `Built`; just re-tick `Publish`.
- **Airtable trial** — the base shows a trial countdown; make sure it's on a plan before
  you depend on the automation.
