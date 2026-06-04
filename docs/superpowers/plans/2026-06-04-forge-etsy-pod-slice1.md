# Forge Etsy POD — Slice 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT — this is a HYBRID plan.** Most tasks are configuration in Randy's
> external SaaS tools (Airtable, n8n) that an automated agent **cannot** perform —
> they're marked **[MANUAL — Randy]** with exact, copy-pasteable specs and a
> verification command. Only Tasks 8–10 are ARIA repo code an agent can execute via
> TDD (**[AGENT]**). A subagent runner should implement 8–10 and treat the rest as
> human checklist items.

**Goal:** Stand up the end-to-end print-on-demand pipeline for **one product
(t-shirt)** on Randy's Airtable + n8n + Printify stack, with two human approval gates,
publishing a real listing to Etsy — plus a minimal ARIA reporting read.

**Architecture:** Airtable is the system of record and approval surface (two checkbox
fields = the two gates). n8n is the executor: Airtable triggers fire HTTP calls to
Claude (concept + copy), OpenAI gpt-image-1 (art), and Printify (build draft + publish
to Etsy), writing results back to Airtable. ARIA reads Airtable for HUD reporting.

**Tech Stack:** Airtable (REST), n8n (HTTP Request + Airtable + Code nodes), Anthropic
Messages API (`claude-sonnet-4-6`), OpenAI Images API (`gpt-image-1`), Printify API v1,
ARIA server (Node, vitest).

**Spec:** `docs/superpowers/specs/2026-06-04-forge-etsy-pod-agent-design.md`

**MVP simplification vs spec:** listing copy (title/description/tags) is generated in
**WF1 (concept stage)**, not the build stage — so Gate 1 approves the idea + copy
together and WF2 only renders + builds. Noted intentionally.

---

## Task 0: Capture the IDs this plan needs **[MANUAL — Randy]**

**Why:** WF2 (Printify product creation) needs concrete blueprint/provider/variant/shop
IDs. These are account- and availability-specific, so we fetch them once and record
them. Blueprint `6` = Bella+Canvas 3001 Unisex Jersey Tee (stable Printify ID).

Record answers in a scratch note; you'll paste them into n8n in later tasks.

- [ ] **Step 1: Get your Etsy-connected shop ID**

```bash
curl -s https://api.printify.com/v1/shops.json \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" | jq
```
Expected: a JSON array of shops. Record the `id` of the one whose `sales_channel` is
`etsy`. → **SHOP_ID**

- [ ] **Step 2: Pick a print provider for blueprint 6**

```bash
curl -s https://api.printify.com/v1/catalog/blueprints/6/print_providers.json \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" | jq
```
Expected: list of providers. Record one `id` (e.g. Monster Digital). → **PROVIDER_ID**

- [ ] **Step 3: Get variant IDs for that provider**

```bash
curl -s "https://api.printify.com/v1/catalog/blueprints/6/print_providers/$PROVIDER_ID/variants.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" | jq '.variants[] | {id, title}'
```
Expected: variants like "Black / M". For MVP pick **one color in S,M,L,XL,2XL** (5
variants). Record those 5 `id`s. → **VARIANT_IDS** (array of 5 integers)

- [ ] **Step 4: Record your Airtable base ID**

From the Airtable base URL (`https://airtable.com/appXXXXXXXXXXXXXX/...`), the
`appXXXXXXXXXXXXXX` part. → **AIRTABLE_BASE_ID**

---

## Task 1: Create the Airtable base + fields **[MANUAL — Randy]**

**Files:** none (Airtable UI).

Create (or reuse a base) and a table named exactly **`Items`** with these fields. Field
names matter — n8n and ARIA reference them verbatim.

- [ ] **Step 1: Create table `Items` with fields**

| Field | Type | Notes |
|---|---|---|
| `Source` | Single select | options: `chat`, `backlog`, `brief` |
| `Raw Idea` | Long text | the brief/idea text |
| `Status` | Single select | options: `New`, `Concept Ready`, `Built`, `Published`, `Rejected` |
| `Art Direction` | Long text | filled by WF1 |
| `Image Prompt` | Long text | filled by WF1 |
| `Title` | Single line text | filled by WF1 |
| `Description` | Long text | filled by WF1 |
| `Tags` | Long text | comma-separated, filled by WF1 |
| `Price` | Number | dollars, filled by WF1 |
| `Concept OK` | Checkbox | **GATE 1** |
| `Art` | Attachment | filled by WF2 (mockup or raw art URL) |
| `Printify Product ID` | Single line text | filled by WF2 |
| `Mockups` | Attachment | filled by WF2 |
| `Publish` | Checkbox | **GATE 2** |
| `Etsy Listing ID` | Single line text | filled by WF3 |
| `Published At` | Date | filled by WF3 |
| `Reject Reason` | Long text | optional |

- [ ] **Step 2: Verify via API**

```bash
curl -s "https://api.airtable.com/v0/$AIRTABLE_BASE_ID/Items?maxRecords=1" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq
```
Expected: `{"records": []}` (HTTP 200). A 403/404 means base ID or key is wrong, or the
table name isn't exactly `Items`.

---

## Task 2: Add n8n credentials **[MANUAL — Randy]**

**Files:** none (n8n UI → Credentials).

- [ ] **Step 1:** Add an **OpenAI** credential (API key) — or a generic Header Auth
  credential `Authorization: Bearer <OPENAI_API_KEY>` for the HTTP node.
- [ ] **Step 2:** Add a **Printify** Header Auth credential:
  `Authorization: Bearer <PRINTIFY_API_TOKEN>`.
- [ ] **Step 3:** Confirm the existing **Anthropic** and **Airtable** credentials still
  work (the flow you already run uses them).

No verification command — confirmed implicitly when the workflows run in Task 7.

---

## Task 3: Build WF1 — Concept + Copy **[MANUAL — Randy]**

**Pattern:** identical shape to your existing `Airtable Trigger → Filter → HTTP
(Claude) → Code → Update record` flow.

- [ ] **Step 1: Airtable Trigger** on table `Items`. (Polling trigger is fine.)

- [ ] **Step 2: Filter** — keep only rows where `Status` = `New`.

- [ ] **Step 3: HTTP Request → Claude.** Method `POST`,
  URL `https://api.anthropic.com/v1/messages`, headers
  `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
  Body (JSON; `{{ $json["Raw Idea"] }}` is the trigger row's field):

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "system": "You are Forge, a print-on-demand designer for a t-shirt store. Expand the user's idea into ONE concrete t-shirt design concept and its Etsy listing copy. HARD RULE: never use copyrighted characters, brand logos, trademarked phrases, or celebrity likenesses — these get the store banned. Reply with ONLY a JSON object, no prose, with keys: art_direction (string), image_prompt (string: a vivid prompt for an image model to render front-chest art on a transparent background), title (string, <=140 chars, Etsy-optimized), description (string), tags (string: 13 comma-separated Etsy tags, each <=20 chars), price (number, USD).",
  "messages": [
    { "role": "user", "content": "<idea>{{ $json[\"Raw Idea\"] }}</idea>" }
  ]
}
```

- [ ] **Step 4: Code (JavaScript)** — parse Claude's JSON out of the response text:

```javascript
const text = $input.first().json.content[0].text.trim();
const json = JSON.parse(text.replace(/^```json\n?|\n?```$/g, ''));
return [{ json }];
```

- [ ] **Step 5: Update record (Airtable)** on `Items`, record id from the trigger
  (`{{ $('Airtable Trigger').item.json.id }}`). Set:
  `Art Direction`, `Image Prompt`, `Title`, `Description`, `Tags`, `Price` from the Code
  node, and `Status` = `Concept Ready`.

- [ ] **Step 6: Verify** — add a test row in Airtable (`Raw Idea` = "funny cat dad,
  retro 70s sunset vibe", `Status` = `New`), run/activate WF1. Expected: within the poll
  interval the row gets `Status = Concept Ready` and the 6 concept/copy fields filled,
  no copyrighted references.

---

## Task 4: Build WF2 — Render + Build Draft Product **[MANUAL — Randy]**

Triggers on Gate 1. Renders art with gpt-image-1, uploads to Printify, creates a
**draft** (unpublished) product, writes mockups back.

- [ ] **Step 1: Airtable Trigger** on `Items`.

- [ ] **Step 2: Filter** — keep rows where `Concept OK` = `true` AND `Printify Product
  ID` is empty (prevents re-builds).

- [ ] **Step 3: HTTP → gpt-image-1.** `POST https://api.openai.com/v1/images/generations`,
  header `Authorization: Bearer <OPENAI_API_KEY>`. Body:

```json
{
  "model": "gpt-image-1",
  "prompt": "{{ $json[\"Image Prompt\"] }}",
  "size": "1024x1024",
  "background": "transparent",
  "n": 1
}
```
Response art is base64 at `data[0].b64_json`.

- [ ] **Step 4: HTTP → Printify upload image.**
  `POST https://api.printify.com/v1/uploads/images.json`, Printify auth. Body:

```json
{
  "file_name": "forge-design.png",
  "contents": "{{ $('HTTP Request').item.json.data[0].b64_json }}"
}
```
Response: `{ "id": "<upload_image_id>", ... }`.

- [ ] **Step 5: HTTP → Printify create product.**
  `POST https://api.printify.com/v1/shops/<SHOP_ID>/products.json`, Printify auth. Body
  (replace `<PROVIDER_ID>` and the 5 `<VARIANT_ID>`s from Task 0; `price` is in **cents**):

```json
{
  "title": "{{ $('Airtable Trigger').item.json[\"Title\"] }}",
  "description": "{{ $('Airtable Trigger').item.json[\"Description\"] }}",
  "blueprint_id": 6,
  "print_provider_id": <PROVIDER_ID>,
  "variants": [
    { "id": <VARIANT_ID_1>, "price": 2499, "is_enabled": true },
    { "id": <VARIANT_ID_2>, "price": 2499, "is_enabled": true },
    { "id": <VARIANT_ID_3>, "price": 2499, "is_enabled": true },
    { "id": <VARIANT_ID_4>, "price": 2499, "is_enabled": true },
    { "id": <VARIANT_ID_5>, "price": 2699, "is_enabled": true }
  ],
  "print_areas": [
    {
      "variant_ids": [<VARIANT_ID_1>, <VARIANT_ID_2>, <VARIANT_ID_3>, <VARIANT_ID_4>, <VARIANT_ID_5>],
      "placeholders": [
        { "position": "front",
          "images": [ { "id": "{{ $('HTTP Request1').item.json.id }}", "x": 0.5, "y": 0.5, "scale": 1.0, "angle": 0 } ] }
      ]
    }
  ]
}
```
Response: product object with `id` and `images[]` (mockups; each has a `src` URL).
Products are created **unpublished** by default — nothing is on Etsy yet.

- [ ] **Step 6: Update record (Airtable)** — set `Printify Product ID` =
  `{{ $json.id }}`, `Mockups` = the mockup URLs (map `images[].src` to Airtable
  attachment objects `[{ "url": "<src>" }]`), `Status` = `Built`.

- [ ] **Step 7: Verify** — tick `Concept OK` on the test row. Expected: within the poll
  interval `Printify Product ID` fills, `Mockups` show the rendered tee, `Status =
  Built`. Cross-check in the Printify dashboard that the product exists and is
  **unpublished**.

---

## Task 5: Build WF3 — Publish to Etsy **[MANUAL — Randy]**

Triggers on Gate 2. The only irreversible step.

- [ ] **Step 1: Airtable Trigger** on `Items`.

- [ ] **Step 2: Filter** — keep rows where `Publish` = `true` AND `Etsy Listing ID` is
  empty (idempotency — never double-publish).

- [ ] **Step 3: HTTP → Printify publish.**
  `POST https://api.printify.com/v1/shops/<SHOP_ID>/products/{{ $json["Printify Product ID"] }}/publish.json`,
  Printify auth. Body:

```json
{ "title": true, "description": true, "images": true, "variants": true, "tags": true, "keyFeatures": true, "shipping_template": true }
```
For an Etsy-connected shop, Printify now pushes the listing to Etsy (async).

- [ ] **Step 4: HTTP → Printify get product** (capture the Etsy listing id once Printify
  finishes). `GET https://api.printify.com/v1/shops/<SHOP_ID>/products/{{ $('Airtable Trigger').item.json["Printify Product ID"] }}.json`,
  Printify auth. The `external` object holds `id` (Etsy listing id) and `handle` (URL)
  once published. (If `external` is still null, Printify is mid-publish — a short Wait
  node before this step handles the lag.)

- [ ] **Step 5: Update record (Airtable)** — set `Etsy Listing ID` =
  `{{ $json.external.id }}`, `Published At` = now, `Status` = `Published`.

- [ ] **Step 6: Verify** — see Task 7.

---

## Task 6: Daily-cap guard on WF2 **[MANUAL — Randy]**

**Why:** backstop against runaway gpt-image-1 spend (spec guard).

- [ ] **Step 1:** In WF2, before the gpt-image-1 node, add an HTTP→Airtable GET that
  counts rows where `Status` = `Built` or `Published` and `Published At`/created is
  today, OR maintain a simple Airtable "rendered today" rollup. If the count ≥ a cap
  (e.g. 10), route to a no-op / notification instead of rendering.
- [ ] **Step 2: Verify** — temporarily set the cap to 1, trigger two builds, confirm the
  second is skipped. Restore the cap.

---

## Task 7: End-to-end live smoke **[MANUAL — Randy]**

- [ ] **Step 1:** New Airtable row: `Raw Idea` = a real idea, `Source` = `brief`,
  `Status` = `New`.
- [ ] **Step 2:** WF1 fills concept + copy → `Status = Concept Ready`. Read the copy;
  confirm no IP issues.
- [ ] **Step 3:** Tick `Concept OK`. WF2 renders + builds draft → `Status = Built`,
  mockups visible. Confirm the product is **unpublished** in Printify.
- [ ] **Step 4:** Tick `Publish`. WF3 publishes → `Status = Published`, `Etsy Listing
  ID` set. Open the Etsy listing and confirm it's live and correct.
- [ ] **Step 5:** Re-save the published row (re-trigger). Confirm WF3 does **not**
  create a second Etsy listing (idempotency guard held).

**This is the revenue-path acceptance test. Slice 1 is "done" when Step 4 yields a
real, correct Etsy listing and Step 5 proves no double-publish.**

---

## Task 8: ARIA Airtable client **[AGENT]**

**Files:**
- Create: `server/src/airtable.js`
- Test: `server/tests/airtable.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/airtable.test.js
import { describe, it, expect } from 'vitest';
import { makeAirtable } from '../src/airtable.js';

describe('airtable client', () => {
  it('lists items mapping record id + fields into flat objects', async () => {
    const fakeFetch = async (url, opts) => {
      expect(url).toBe('https://api.airtable.com/v0/appTEST/Items');
      expect(opts.headers.Authorization).toBe('Bearer key123');
      return {
        ok: true,
        json: async () => ({ records: [
          { id: 'rec1', fields: { Title: 'Cat Dad Tee', Status: 'Published', Price: 24.99 } },
        ] }),
      };
    };
    const at = makeAirtable({ apiKey: 'key123', baseId: 'appTEST', fetchImpl: fakeFetch });
    const items = await at.listItems();
    expect(items).toEqual([{ id: 'rec1', Title: 'Cat Dad Tee', Status: 'Published', Price: 24.99 }]);
  });

  it('throws on non-ok response', async () => {
    const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    const at = makeAirtable({ apiKey: 'k', baseId: 'b', fetchImpl: fakeFetch });
    await expect(at.listItems()).rejects.toThrow('Airtable 403');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/airtable.test.js`
Expected: FAIL — `Cannot find module '../src/airtable.js'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/src/airtable.js
const API = 'https://api.airtable.com/v0';

export function makeAirtable({
  apiKey = process.env.AIRTABLE_API_KEY,
  baseId = process.env.AIRTABLE_BASE_ID,
  table = 'Items',
  fetchImpl = fetch,
} = {}) {
  async function listItems() {
    const res = await fetchImpl(`${API}/${baseId}/${table}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = await res.json();
    return data.records.map((r) => ({ id: r.id, ...r.fields }));
  }
  return { listItems };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/airtable.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/airtable.js server/tests/airtable.test.js
git commit -m "feat(forge): add Airtable client for merch reporting"
```

---

## Task 9: ARIA merch-reporting tool **[AGENT]**

**Files:**
- Create: `server/src/forge-report.js`
- Test: `server/tests/forge-report.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/forge-report.test.js
import { describe, it, expect } from 'vitest';
import { summarizeMerch } from '../src/forge-report.js';

describe('summarizeMerch', () => {
  it('counts items by status and sums published revenue', () => {
    const items = [
      { Status: 'New' },
      { Status: 'Concept Ready' },
      { Status: 'Built' },
      { Status: 'Published', Price: 24.99 },
      { Status: 'Published', Price: 26.99 },
      { Status: 'Rejected' },
    ];
    expect(summarizeMerch(items)).toEqual({
      total: 6,
      byStatus: { New: 1, 'Concept Ready': 1, Built: 1, Published: 2, Rejected: 1 },
      pendingGate1: 1,   // Concept Ready awaiting Concept OK
      pendingGate2: 1,   // Built awaiting Publish
      published: 2,
      listedRevenuePerSale: 51.98,
    });
  });

  it('handles empty input', () => {
    expect(summarizeMerch([])).toEqual({
      total: 0, byStatus: {}, pendingGate1: 0, pendingGate2: 0, published: 0, listedRevenuePerSale: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/forge-report.test.js`
Expected: FAIL — `Cannot find module '../src/forge-report.js'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/src/forge-report.js
export function summarizeMerch(items) {
  const byStatus = {};
  let published = 0;
  let listedRevenuePerSale = 0;
  for (const it of items) {
    byStatus[it.Status] = (byStatus[it.Status] || 0) + 1;
    if (it.Status === 'Published') {
      published += 1;
      listedRevenuePerSale += Number(it.Price) || 0;
    }
  }
  return {
    total: items.length,
    byStatus,
    pendingGate1: byStatus['Concept Ready'] || 0,
    pendingGate2: byStatus['Built'] || 0,
    published,
    listedRevenuePerSale: Math.round(listedRevenuePerSale * 100) / 100,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/forge-report.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/forge-report.js server/tests/forge-report.test.js
git commit -m "feat(forge): add merch status/revenue summary"
```

---

## Task 10: Wire the reporting tool into ARIA's agent **[AGENT]**

**Files:**
- Modify: `server/src/tools.js` (add a `get_merch_status` tool alongside the existing tools)

- [ ] **Step 1: Add the tool definition + handler.** Follow the existing tool shape in
  `server/src/tools.js`. The handler reads Airtable and summarizes:

```javascript
import { makeAirtable } from './airtable.js';
import { summarizeMerch } from './forge-report.js';

// tool definition (add to the exported tools array/registry, matching existing style):
{
  name: 'get_merch_status',
  description: "Report the Etsy print-on-demand store: how many designs are pending each approval gate, how many are published, and listed revenue per sale.",
  input_schema: { type: 'object', properties: {}, required: [] },
  handler: async () => {
    const at = makeAirtable();
    const items = await at.listItems();
    return summarizeMerch(items);
  },
}
```
Match the actual registration pattern already used in `tools.js` (e.g. how
`get_business_summary` is defined and exported) — read the file first and mirror it.

- [ ] **Step 2: Run the server test suite to confirm nothing broke**

Run: `cd server && npm test`
Expected: all existing tests still pass (77+), plus Tasks 8–9 tests (4 new).

- [ ] **Step 3: Live check (needs `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID` in
  `server/.env`).** With the server running, ask ARIA "what's the merch store status?"
  Expected: ARIA calls `get_merch_status` and reports counts matching Airtable.

- [ ] **Step 4: Commit**

```bash
git add server/src/tools.js
git commit -m "feat(forge): expose get_merch_status tool to ARIA agent"
```

---

## Self-review notes (coverage check vs spec)

- Two gates → `Concept OK` (Task 3/4) + `Publish` (Task 5). ✓
- Three intake modes → Slice 1 covers **brief/backlog** (Airtable rows); conversational
  is Slice 2 (not in this plan). ✓ (scoped)
- gpt-image-1 render → Task 4 Step 3. ✓
- Printify draft-until-Gate-2 → product created unpublished (Task 4), publish only on
  Gate 2 (Task 5). ✓
- Idempotent publish → WF3 filter on empty `Etsy Listing ID` + Task 7 Step 5 test. ✓
- IP/trademark guardrail → WF1 system prompt + Gate 1 human check. ✓
- Daily cap → Task 6. ✓
- ARIA reporting → Tasks 8–10. ✓
- Resolution ceiling → MVP uses front-chest print (fine at 1024px); upscale deferred. ✓

## Out of scope for Slice 1
Conversational Forge intake, multiple product types, regenerate-from-reject-reason,
Scout niche research, sales sync, ARIA HUD queue mirror. (Slices 2–3.)
