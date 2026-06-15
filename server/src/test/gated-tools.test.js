/**
 * Tests for the gated outward-action interception in callTool (tools.js).
 *
 * Safety properties verified here:
 *   1. A gated tool invoked by a spawned_agent is NEVER executed inline.
 *   2. The action is captured into ctx.proposedActions.
 *   3. A non-spawned caller (human_approved or none) executes the tool normally.
 *   4. Non-gated tools are unaffected by the gate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all external dependencies before importing tools.js ─────────────────
vi.mock('../anthropic.js', () => ({ getClient: () => ({}) }));
vi.mock('../memory.js', () => ({
  upsertEntry: vi.fn(),
  resolveIssue: vi.fn(),
  getMemory: vi.fn(async () => ({})),
}));
vi.mock('../clients.js', () => ({
  getClients: vi.fn(async () => ({ clients: [], totalMonthlyValue: 0 })),
  upsertClient: vi.fn(async () => ({})),
}));
vi.mock('../subagents/scout.js', () => ({ runScout: vi.fn(async () => ({})) }));
vi.mock('../subagents/hunter.js', () => ({ runHunter: vi.fn(async () => ({})) }));
vi.mock('../subagents/creative.js', () => ({ runCreative: vi.fn(async () => ({})) }));
vi.mock('../subagents/hermes.js', () => ({ runHermes: vi.fn(async () => ({})) }));
vi.mock('../subagents/shared.js', () => ({ webSearch: vi.fn(async () => ({})) }));
vi.mock('../factory/delegate.js', () => ({ delegateToFactory: vi.fn(async () => ({})) }));
vi.mock('../factory/tool-registry.js', () => ({
  factoryRegistry: {
    getDynamicDefinitions: () => [],
    has: () => false,
    execute: vi.fn(),
  },
}));
vi.mock('../airtable.js', () => ({
  makeAirtable: () => ({ listItems: vi.fn(async () => []) }),
}));
vi.mock('../forge-report.js', () => ({ summarizeMerch: vi.fn(() => ({})) }));
vi.mock('../pdf.js', () => ({ readPdf: vi.fn(async () => ({})) }));

// The key mock: publishPost (imported as publishLinkedInPost in tools.js)
const mockPublishLinkedInPost = vi.fn(async () => ({ postId: 'li-123', status: 'published' }));
vi.mock('../linkedin.js', () => ({
  publishPost: (...args) => mockPublishLinkedInPost(...args),
  loadAuth: vi.fn(async () => null),
  getTargets: vi.fn(async () => []),
}));

import { callTool } from '../tools.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockPublishLinkedInPost.mockResolvedValue({ postId: 'li-123', status: 'published' });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GATED_TOOLS interception — publish_to_linkedin', () => {
  it('spawned_agent call: returns queued sentinel and does NOT execute publishLinkedInPost', async () => {
    const proposedActions = [];
    const result = await callTool(
      'publish_to_linkedin',
      { content: 'Hello LinkedIn!', author: 'person' },
      undefined,
      undefined,
      { caller: { kind: 'spawned_agent', slug: 'verse' }, proposedActions },
    );

    // Safety property 1: tool was not executed
    expect(mockPublishLinkedInPost).not.toHaveBeenCalled();

    // Returns the queued sentinel
    expect(result).toEqual({ queued: true, note: 'Drafted and queued for human approval. Do not retry.' });
  });

  it('spawned_agent call: captures the action into ctx.proposedActions', async () => {
    const proposedActions = [];
    await callTool(
      'publish_to_linkedin',
      { content: 'Hello LinkedIn!', author: 'person' },
      undefined,
      undefined,
      { caller: { kind: 'spawned_agent', slug: 'verse' }, proposedActions },
    );

    // Safety property 2: action captured
    expect(proposedActions).toHaveLength(1);
    expect(proposedActions[0]).toEqual({
      tool: 'publish_to_linkedin',
      input: { content: 'Hello LinkedIn!', author: 'person' },
    });
  });

  it('spawned_agent call without proposedActions array: still does not execute (graceful)', async () => {
    const result = await callTool(
      'publish_to_linkedin',
      { content: 'Oops' },
      undefined,
      undefined,
      { caller: { kind: 'spawned_agent', slug: 'verse' } }, // no proposedActions
    );

    expect(mockPublishLinkedInPost).not.toHaveBeenCalled();
    expect(result.queued).toBe(true);
  });

  it('human_approved caller: DOES execute publishLinkedInPost normally', async () => {
    const result = await callTool(
      'publish_to_linkedin',
      { content: 'Approved post text', author: 'person' },
      undefined,
      undefined,
      { caller: { kind: 'human_approved' } },
    );

    // Safety property 3: non-spawned caller executes normally
    expect(mockPublishLinkedInPost).toHaveBeenCalledOnce();
    expect(mockPublishLinkedInPost).toHaveBeenCalledWith({ content: 'Approved post text', author: 'person' });
    // Returns the real tool result (not the queued sentinel)
    expect(result).toEqual({ postId: 'li-123', status: 'published' });
  });

  it('no ctx at all: DOES execute publishLinkedInPost normally', async () => {
    const result = await callTool(
      'publish_to_linkedin',
      { content: 'Direct call, no ctx' },
    );

    expect(mockPublishLinkedInPost).toHaveBeenCalledOnce();
    expect(result).toEqual({ postId: 'li-123', status: 'published' });
  });

  it('multiple captures: each gated call pushes to proposedActions', async () => {
    const proposedActions = [];
    const ctx = { caller: { kind: 'spawned_agent', slug: 'verse' }, proposedActions };

    await callTool('publish_to_linkedin', { content: 'Post 1' }, undefined, undefined, ctx);
    await callTool('publish_to_linkedin', { content: 'Post 2' }, undefined, undefined, ctx);

    expect(mockPublishLinkedInPost).not.toHaveBeenCalled();
    expect(proposedActions).toHaveLength(2);
    expect(proposedActions[0].input.content).toBe('Post 1');
    expect(proposedActions[1].input.content).toBe('Post 2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('non-gated tools — gate does not interfere', () => {
  it('web_search called by spawned_agent: executes normally (not gated)', async () => {
    const { webSearch } = await import('../subagents/shared.js');
    vi.mocked(webSearch).mockResolvedValueOnce({ results: ['r1'] });

    const result = await callTool(
      'web_search',
      { query: 'ARIA agent factory' },
      undefined,
      undefined,
      { caller: { kind: 'spawned_agent', slug: 'beacon' }, proposedActions: [] },
    );

    expect(webSearch).toHaveBeenCalledWith('ARIA agent factory');
    expect(result).toEqual({ results: ['r1'] });
  });
});
