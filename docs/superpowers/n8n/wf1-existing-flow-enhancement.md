# WF1 — Enhance your EXISTING copy-drafting flow

You already have an n8n flow that drafts GitFunny listing copy
(`Airtable Trigger → Filter → Claude → Code → Update record`), setting `Status` to
`Drafted`. We do **not** replace it. We make **two small edits** so it also produces an
**Image Prompt** for Forge's WF2 to render.

## Edit 1 — ask Claude for an image prompt

In the **Claude** HTTP node's system prompt, add `image_prompt` to the JSON keys it must
return. Append this to the instruction that lists the output fields:

> Also include `image_prompt` (string): a vivid prompt for an image model to render the
> design as **front-chest t-shirt art on a transparent background**. ORIGINAL artwork
> only — describe the visual; never reference copyrighted characters, company/brand
> logos (GitHub, Docker, Disney, sports teams, etc.), or celebrity likenesses.

So Claude now returns the keys you already parse **plus** `image_prompt`.

## Edit 2 — write it to Airtable

1. In the **Products** table, add a field **`Image Prompt`** (type: *Long text*).
2. In your flow's **Update record** node, add one mapping:
   `Image Prompt` ← the parsed `image_prompt` from your Code node
   (e.g. `={{ $json.image_prompt }}`, matching however your Code node exposes it).

That's it. Your flow still does everything it did; it just also fills `Image Prompt`,
which WF2 consumes after you tick `Concept OK`.

## Sanity check
Run your flow on a row (`Status = idea`). Expected: `Title`, `Description`, `Tags`
fill as before **and** `Image Prompt` now has a render-ready description. Then it's ready
for WF2.
