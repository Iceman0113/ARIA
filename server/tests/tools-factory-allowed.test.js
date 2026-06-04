import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, toApiTools } from '../src/tools.js';

const BLOCKED = new Set([
  'publish_to_linkedin',
  'check_linkedin_connection',
  'get_linkedin_targets',
  'delegate_to_hermes',
  'save_to_memory',
  'get_memory',
  'update_client',
  'get_revenue_metrics',
  'track_mrr_vs_bridge',
  'get_business_summary',
]);

describe('factory_allowed field on every tool', () => {
  it('every tool definition has a factory_allowed boolean', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(typeof t.factory_allowed, `tool ${t.name} missing factory_allowed`).toBe('boolean');
    }
  });

  it('the 10 hard-blocked tools have factory_allowed=false', () => {
    for (const t of TOOL_DEFINITIONS) {
      if (BLOCKED.has(t.name)) {
        expect(t.factory_allowed, `${t.name} should be blocked`).toBe(false);
      }
    }
    // Sanity: all 10 are in the registry
    const found = TOOL_DEFINITIONS.filter(t => BLOCKED.has(t.name)).map(t => t.name);
    expect(new Set(found)).toEqual(BLOCKED);
  });

  it('a non-blocked tool is factory_allowed=true', () => {
    const safe = TOOL_DEFINITIONS.find(t => t.name === 'check_competitors');
    expect(safe.factory_allowed).toBe(true);
  });

  it('web_search is registered as a top-level tool with factory_allowed=true', () => {
    const ws = TOOL_DEFINITIONS.find(t => t.name === 'web_search');
    expect(ws).toBeTruthy();
    expect(ws.factory_allowed).toBe(true);
    expect(ws.input_schema.required).toContain('query');
  });
});

describe('toApiTools strips internal metadata before the Anthropic API', () => {
  // Regression: the Messages API rejects unknown keys on tool defs with
  // "tools.0.custom.factory_allowed: Extra inputs are not permitted". Our defs
  // carry internal metadata (factory_allowed) that MUST be stripped before the
  // tools array crosses the API boundary (agent.js + factory/runtime.js).
  it('keeps only name, description, input_schema — drops factory_allowed', () => {
    const apiTools = toApiTools(TOOL_DEFINITIONS);
    expect(apiTools.length).toBe(TOOL_DEFINITIONS.length);
    for (const t of apiTools) {
      expect(Object.keys(t).sort()).toEqual(['description', 'input_schema', 'name']);
      expect(t).not.toHaveProperty('factory_allowed');
    }
  });

  it('preserves the name, description, and input_schema values', () => {
    const src = TOOL_DEFINITIONS.find(t => t.name === 'web_search');
    const out = toApiTools([src])[0];
    expect(out.name).toBe(src.name);
    expect(out.description).toBe(src.description);
    expect(out.input_schema).toEqual(src.input_schema);
  });
});
