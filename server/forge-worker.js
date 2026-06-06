// Forge local worker — runs on Randy's Mac, bridges Airtable <-> Desktop folders
// <-> Printify so a human can remove backgrounds between design and build.
//
//   Concept OK + Drafted  --(generate)-->  ~/Desktop/Forge/inbox/<rec>__slug.png
//   [you remove bg, drop into ready/]
//   ready/<rec>__slug.png --(build)-->     Printify product + mockups, Status=Built
//
// Run continuously:  node forge-worker.js     (or bin/forge-worker.sh)
// Single pass/test:  node forge-worker.js --once

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { makeAirtable } from './src/airtable.js';
import {
  inboxFilename, recordIdFromFilename, buildProductBody, mockupUrls, buildImagePromptMessages,
} from './src/forge/worker-lib.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(HERE, '.env'), override: true });

const {
  REPLICATE_API_TOKEN, PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID,
  AIRTABLE_API_KEY, AIRTABLE_BASE_ID,
} = process.env;

const FORGE_DIR = process.env.FORGE_DIR || path.join(os.homedir(), 'Desktop', 'Forge');
const INBOX = path.join(FORGE_DIR, 'inbox');
const READY = path.join(FORGE_DIR, 'ready');
const DONE = path.join(FORGE_DIR, 'done');
const POLL_MS = Number(process.env.FORGE_POLL_MS || 20000);

const BLUEPRINT_ID = Number(process.env.FORGE_BLUEPRINT_ID || 6);
const PROVIDER_ID = Number(process.env.FORGE_PROVIDER_ID || 217);
const VARIANT_IDS = (process.env.FORGE_VARIANT_IDS || '12102,12101,12100,12103,12104').split(',').map(Number);
const PRICES = (process.env.FORGE_PRICES || '2499,2499,2499,2499,2699').split(',').map(Number);
const MODEL = process.env.FORGE_IDEOGRAM_MODEL || 'ideogram-ai/ideogram-v3-turbo';
const SUFFIX = ' — centered t-shirt graphic on a plain white background, vector sticker style, bold legible text, high contrast, no shirt mockup';

const at = makeAirtable({ apiKey: AIRTABLE_API_KEY, baseId: AIRTABLE_BASE_ID });
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function generateDesign(prompt) {
  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input: { prompt, aspect_ratio: '1:1' } }),
  });
  const d = await res.json();
  if (d.status !== 'succeeded') throw new Error(`Replicate: ${d.error || d.detail || JSON.stringify(d)}`);
  return Array.isArray(d.output) ? d.output[0] : d.output;
}

async function deriveImagePrompt(row) {
  const { system, user } = buildImagePromptMessages(row);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 300, system, messages: [{ role: 'user', content: user }] }),
  });
  const d = await res.json();
  if (!d.content) throw new Error(`Anthropic: ${JSON.stringify(d)}`);
  return d.content[0].text.trim();
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function printifyUpload(fileName, base64) {
  const res = await fetch('https://api.printify.com/v1/uploads/images.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PRINTIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: fileName, contents: base64 }),
  });
  const d = await res.json();
  if (!d.id) throw new Error(`Printify upload: ${JSON.stringify(d)}`);
  return d.id;
}

async function printifyCreate(uploadId, title, description) {
  const body = buildProductBody({
    uploadId, title, description,
    blueprintId: BLUEPRINT_ID, providerId: PROVIDER_ID, variantIds: VARIANT_IDS, prices: PRICES,
  });
  const res = await fetch(`https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products.json`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PRINTIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json();
  if (!d.id) throw new Error(`Printify create: ${JSON.stringify(d.errors || d)}`);
  return d;
}

// Concept OK + Drafted + Image Prompt  ->  generate design into inbox/, set Awaiting BG
async function generatePhase() {
  const items = await at.listItems();
  const todo = items.filter((r) => r['Concept OK'] === true && r.Status === 'Drafted');
  for (const row of todo) {
    try {
      log(`generate ${row.id} "${row.Name}"`);
      let imagePrompt = row['Image Prompt'];
      if (!imagePrompt) {
        imagePrompt = await deriveImagePrompt(row);
        await at.updateItem(row.id, { 'Image Prompt': imagePrompt });
        log(`  derived Image Prompt: ${imagePrompt.slice(0, 80)}...`);
      }
      const url = await generateDesign(String(imagePrompt) + SUFFIX);
      const fname = inboxFilename(row.id, row.Title || row.Name || 'design');
      await download(url, path.join(INBOX, fname));
      await at.updateItem(row.id, { Status: 'Awaiting BG' });
      log(`  -> inbox/${fname} (Awaiting BG)`);
    } catch (e) {
      log(`  ! generate failed ${row.id}: ${e.message}`);
    }
  }
}

// cleaned files in ready/  ->  Printify upload + create product, set Built
async function buildPhase() {
  let files = [];
  try { files = await readdir(READY); } catch { return; }
  for (const file of files) {
    const recordId = recordIdFromFilename(file);
    if (!recordId) continue;
    const readyPath = path.join(READY, file);
    try {
      const row = await at.getItem(recordId);
      if (row['Printify ID']) { await rename(readyPath, path.join(DONE, file)).catch(() => {}); continue; }
      log(`build ${recordId} from ready/${file}`);
      const base64 = (await readFile(readyPath)).toString('base64');
      const uploadId = await printifyUpload(file, base64);
      const product = await printifyCreate(uploadId, row.Title || row.Name, row.Description || '');
      await at.updateItem(recordId, { 'Printify ID': product.id, Mockups: mockupUrls(product), Status: 'Built' });
      await rename(readyPath, path.join(DONE, file)).catch(() => {});
      const inboxMatch = (await readdir(INBOX).catch(() => [])).find((f) => recordIdFromFilename(f) === recordId);
      if (inboxMatch) await rename(path.join(INBOX, inboxMatch), path.join(DONE, `inbox-${inboxMatch}`)).catch(() => {});
      log(`  -> Built, Printify ${product.id}, ${mockupUrls(product).length} mockups`);
    } catch (e) {
      log(`  ! build failed ${recordId}: ${e.message}`);
    }
  }
}

async function tick() { await generatePhase(); await buildPhase(); }

async function main() {
  for (const d of [INBOX, READY, DONE]) await mkdir(d, { recursive: true });
  const missing = ['REPLICATE_API_TOKEN', 'PRINTIFY_API_TOKEN', 'PRINTIFY_SHOP_ID', 'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'ANTHROPIC_API_KEY']
    .filter((k) => !process.env[k]);
  if (missing.length) { console.error('Missing env:', missing.join(', ')); process.exit(1); }

  if (process.argv.includes('--once')) { await tick(); log('single pass done'); return; }

  log(`Forge worker up. inbox=${INBOX}  ready=${READY}  (poll ${POLL_MS}ms)`);
  let running = false;
  const run = async () => {
    if (running) return; running = true;
    try { await tick(); } catch (e) { log('tick error:', e.message); } finally { running = false; }
  };
  await run();
  setInterval(run, POLL_MS);
}

main();
