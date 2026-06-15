import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApprovals } from './useApprovals.js';

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ id: 't1', title: 'Draft' }] }));
});

describe('useApprovals', () => {
  it('hydrates pending on mount', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(1));
  });
  it('approve posts then re-hydrates', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(1));
    await result.current.approve('t1');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/factory/tasks/t1/approve'), expect.objectContaining({ method: 'POST' }));
  });
});
