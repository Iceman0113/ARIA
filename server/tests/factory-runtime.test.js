import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastCallArgs = null;
const createMock = vi.fn().mockImplementation((args) => {
  lastCallArgs = args;
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'final answer from echo' }],
  };
});

vi.mock('../src/anthropic.js', () => ({
  getClient: () => ({ messages: { create: createMock } }),
}));

vi.mock('../src/tools.js', () => ({
  TOOL_DEFINITIONS: [
    { name: 'web_search', factory_allowed: true, description: 'd', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'check_competitors', factory_allowed: true, description: 'd', input_schema: { type: 'object', properties: {} } },
    { name: 'delegate_to_hermes', factory_allowed: false, description: 'd', input_schema: { type: 'object', properties: {} } },
    { name: 'publish_to_linkedin', factory_allowed: false, description: 'd', input_schema: { type: 'object', properties: {} } },
  ],
  callTool: vi.fn(async (name) => ({ ok: true, name })),
  toApiTools: (defs) => defs.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
  GATED_TOOLS: new Set(['publish_to_linkedin']),
}));

beforeEach(() => {
  lastCallArgs = null;
  createMock.mockClear();
});

describe('ConfigDrivenAgent', () => {
  it('filters tools to the allowlist AND drops factory_allowed=false', async () => {
    const { ConfigDrivenAgent } = await import('../src/factory/runtime.js');
    const row = {
      slug: 'echo', name: 'Echo', specialty: 'PDF watcher',
      system_prompt: 'You are Echo.',
      tool_allowlist: ['web_search', 'delegate_to_hermes'],   // hermes should be filtered out
      model: 'claude-sonnet-4-6',
      status: 'shadow',
    };
    const agent = new ConfigDrivenAgent(row);
    const result = await agent.run('say hi', () => {});
    expect(result.text).toBe('final answer from echo');
    // Inspect the tools passed to messages.create
    const passedTools = lastCallArgs.tools.map(t => t.name);
    expect(passedTools).toEqual(['web_search']);
    // Tools handed to the API must NOT carry internal metadata (Anthropic 400s
    // on unknown keys like factory_allowed) — this is the F5 dispatch path.
    for (const t of lastCallArgs.tools) {
      expect(t).not.toHaveProperty('factory_allowed');
    }
  });

  it('exposes a GATED tool even though factory_allowed=false (for interception/capture)', async () => {
    const { ConfigDrivenAgent } = await import('../src/factory/runtime.js');
    const row = {
      slug: 'verse', name: 'Verse', specialty: 'social',
      system_prompt: 'You are Verse.',
      tool_allowlist: ['web_search', 'publish_to_linkedin'],
      model: 'claude-sonnet-4-6', status: 'active',
    };
    await new ConfigDrivenAgent(row).run('post something', () => {});
    const passedTools = lastCallArgs.tools.map(t => t.name);
    // publish_to_linkedin is factory_allowed:false but gated → it MUST be handed
    // to the agent so the call can be intercepted + captured for approval.
    expect(passedTools).toEqual(['web_search', 'publish_to_linkedin']);
  });

  it('prefixes [SHADOW] log when status === shadow', async () => {
    const { ConfigDrivenAgent } = await import('../src/factory/runtime.js');
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const row = { slug: 'echo', name: 'Echo', specialty: 'x', system_prompt: 'p', tool_allowlist: [], model: 'm', status: 'shadow' };
      await new ConfigDrivenAgent(row).run('hi', () => {});
    } finally {
      console.log = origLog;
    }
    expect(logs.some(l => l.includes('[SHADOW]') && l.includes('echo'))).toBe(true);
  });

  it('emits a tool_call event for sub-agent dispatch', async () => {
    const { ConfigDrivenAgent } = await import('../src/factory/runtime.js');
    const events = [];
    const row = { slug: 'echo', name: 'Echo', specialty: 'x', system_prompt: 'p', tool_allowlist: ['web_search'], model: 'm', status: 'active' };
    await new ConfigDrivenAgent(row).run('hi', (e) => events.push(e));
    expect(events.some(e => e.type === 'tool_call' && e.name === 'dispatch_to_echo')).toBe(true);
  });
});
