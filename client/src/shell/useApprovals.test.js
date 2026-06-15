import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApprovals } from './useApprovals.js';

// Default mock: factory returns one item, agent returns one awaiting task
function makeFetch({ factoryTasks, agentTasks } = {}) {
  const ft = factoryTasks ?? [{ id: 't1', proposed_manifest: { name: 'Draft Agent', specialty: 'sales' } }];
  const at = agentTasks ?? [{ id: 'at1', slug: 'hunter', text: 'Research leads', state: 'awaiting_approval', result: 'Found 5 leads' }];

  return vi.fn(async (url) => {
    if (url.includes('/factory/pending')) {
      return { ok: true, status: 200, json: async () => ft };
    }
    if (url.includes('/agents/tasks')) {
      return { ok: true, status: 200, json: async () => ({ tasks: at }) };
    }
    // approve/reject endpoints
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

beforeEach(() => {
  global.fetch = makeFetch();
});

describe('useApprovals', () => {
  it('hydrates pending on mount — merges factory + agent tasks', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
  });

  it('factory item has source=factory and normalized title/preview', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    const factoryItem = result.current.pending.find(p => p.source === 'factory');
    expect(factoryItem).toBeTruthy();
    expect(factoryItem.title).toBe('Draft Agent');
    expect(factoryItem.preview).toBe('sales');
  });

  it('agent task item has source=agent and normalized title/preview', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    const agentItem = result.current.pending.find(p => p.source === 'agent');
    expect(agentItem).toBeTruthy();
    expect(agentItem.title).toContain('Hunter');
    expect(agentItem.title).toContain('Research leads');
    expect(agentItem.preview).toBe('Found 5 leads');
  });

  it('approve routes factory item to /factory/tasks/:id/approve', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    const factoryItem = result.current.pending.find(p => p.source === 'factory');
    await result.current.approve(factoryItem);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/factory/tasks/t1/approve'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('approve routes agent item to /agents/tasks/:id/approve', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    const agentItem = result.current.pending.find(p => p.source === 'agent');
    await result.current.approve(agentItem);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/agents/tasks/at1/approve'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reject routes factory item to /factory/tasks/:id/reject', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    const factoryItem = result.current.pending.find(p => p.source === 'factory');
    await result.current.reject(factoryItem);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/factory/tasks/t1/reject'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reject routes agent item to /agents/tasks/:id/reject', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    const agentItem = result.current.pending.find(p => p.source === 'agent');
    await result.current.reject(agentItem);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/agents/tasks/at1/reject'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('re-hydrates on factory WS event via ws prop (msg.type)', async () => {
    const listeners = {};
    const mockWs = {
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
      removeEventListener: () => {},
    };

    const { result } = renderHook(() => useApprovals(mockWs));
    await waitFor(() => expect(result.current.pending.length).toBe(2));

    const callCount = global.fetch.mock.calls.length;

    // Server sends { type: ... } for factory events — must use msg.type, not msg.kind
    listeners['message']({ data: JSON.stringify({ type: 'factory.task_ready', id: 't2' }) });

    await waitFor(() => expect(global.fetch.mock.calls.length).toBeGreaterThan(callCount));
  });

  it('re-hydrates on agent_task.updated via agentTaskRefreshKey (primary path)', async () => {
    // This is the primary path: App.handleServerEvent bumps agentTaskRefreshKey
    // when it receives { type: 'agent_task.updated' } — no stale-ws-ref problem.
    const { result, rerender } = renderHook(
      ({ refreshKey }) => useApprovals(null, refreshKey),
      { initialProps: { refreshKey: 0 } }
    );
    await waitFor(() => expect(result.current.pending.length).toBe(2));

    const callCount = global.fetch.mock.calls.length;

    // Simulate App bumping the key (as it does in handleServerEvent)
    rerender({ refreshKey: 1 });

    await waitFor(() => expect(global.fetch.mock.calls.length).toBeGreaterThan(callCount));
  });

  it('approve accepts a bare id string and defaults to factory routing', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(2));
    await result.current.approve('t1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/factory/tasks/t1/approve'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
