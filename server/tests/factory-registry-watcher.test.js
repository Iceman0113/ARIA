import { describe, it, expect, vi, beforeEach } from 'vitest';

const agents = [
  { slug: 'echo', name: 'Echo', specialty: 'PDF watcher', system_prompt: 'p', tool_allowlist: ['web_search'], model: 'm', status: 'shadow', tenant_id: 't1' },
];

let channelHandler = null;
const channelMock = {
  on: vi.fn(function (event, opts, cb) { channelHandler = cb; return this; }),
  subscribe: vi.fn(function () { return this; }),
};

vi.mock('../src/supabase.js', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: agents, error: null }),
      }),
    }),
    channel: () => channelMock,
  }),
  getTenantId: async () => 't1',
}));

beforeEach(() => {
  channelHandler = null;
  channelMock.on.mockClear();
  channelMock.subscribe.mockClear();
});

describe('RegistryWatcher', () => {
  it('registers dispatch_to_<slug> tools for each shadow/active agent on start()', async () => {
    const { RegistryWatcher } = await import('../src/factory/registry-watcher.js');
    const registered = new Map();
    const fakeRegistry = {
      register: vi.fn((tool, executor) => registered.set(tool.name, { tool, executor })),
      unregister: vi.fn((name) => registered.delete(name)),
    };
    const watcher = new RegistryWatcher(fakeRegistry);
    await watcher.start();
    expect(registered.has('dispatch_to_echo')).toBe(true);
    expect(channelMock.on).toHaveBeenCalled();
    expect(channelMock.subscribe).toHaveBeenCalled();
  });

  it('start() is idempotent — a second call does not create a second interval or re-subscribe', async () => {
    const { RegistryWatcher } = await import('../src/factory/registry-watcher.js');
    const fakeRegistry = {
      register: vi.fn(),
      unregister: vi.fn(),
    };
    const watcher = new RegistryWatcher(fakeRegistry);
    await watcher.start();
    const firstTimer = watcher._pollTimer;
    // subscribe should have been called exactly once
    expect(channelMock.subscribe).toHaveBeenCalledTimes(1);

    // Second start() must be a no-op
    await watcher.start();
    expect(channelMock.subscribe).toHaveBeenCalledTimes(1); // still 1
    expect(watcher._pollTimer).toBe(firstTimer);             // same timer handle
  });

  it('unregisters tools for agents no longer live', async () => {
    const { RegistryWatcher } = await import('../src/factory/registry-watcher.js');
    const registered = new Map();
    const fakeRegistry = {
      register: vi.fn((tool) => registered.set(tool.name, tool)),
      unregister: vi.fn((name) => registered.delete(name)),
    };
    const watcher = new RegistryWatcher(fakeRegistry);
    await watcher.start();
    expect(registered.has('dispatch_to_echo')).toBe(true);

    // Simulate the agent being archived — refresh() now sees no live agents,
    // so it should unregister the dispatch tool.
    agents.length = 0;
    await watcher.refresh();
    expect(registered.has('dispatch_to_echo')).toBe(false);
  });
});
