#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { runResearch } from './research.js';
import { TOOL_DEFINITIONS } from '../tools.js';

const domain = process.argv.slice(2).join(' ').trim();
if (!domain) {
  console.error('Usage: node src/factory/research-cli.js "<domain description>"');
  process.exit(1);
}

const factoryAllowed = TOOL_DEFINITIONS
  .filter(t => t.factory_allowed !== false)
  .map(t => t.name);

console.log(`Researching: "${domain}"`);
console.log(`Factory-allowed tools: ${factoryAllowed.length}`);

const result = await runResearch(domain, factoryAllowed, (e) => {
  console.log(`[event] ${JSON.stringify(e)}`);
});

if (!result.ok) {
  console.error(`FAILED: ${result.error}`);
  process.exit(2);
}

console.log(`\n=== Skills Report (${result.cached ? 'CACHED' : 'fresh'}) ===`);
console.log(JSON.stringify(result.report, null, 2));
console.log(`\nReport id: ${result.reportId}`);
