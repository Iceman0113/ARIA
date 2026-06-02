import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(),
  getTenantId: vi.fn(),
}));

let buildNeuralMap, getSupabase, getTenantId;
beforeEach(async () => {
  vi.resetModules();
  ({ buildNeuralMap } = await import('../neural-map.js'));
  ({ getSupabase, getTenantId } = await import('../supabase.js'));
});

describe('buildNeuralMap', () => {
  it('returns aria hub + 4 canonical sub-agents even when Supabase is null', async () => {
    getSupabase.mockReturnValue(null);
    getTenantId.mockResolvedValue(null);
    const out = await buildNeuralMap();
    expect(out.nodes.find(n => n.id === 'aria')?.type).toBe('hub');
    ['scout', 'hunter', 'creative', 'hermes'].forEach(slug => {
      expect(out.nodes.find(n => n.id === slug)?.type).toBe('category');
    });
  });

  it('binds canonical sub-agent colors to the spec values', async () => {
    getSupabase.mockReturnValue(null);
    getTenantId.mockResolvedValue(null);
    const out = await buildNeuralMap();
    expect(out.nodes.find(n => n.id === 'scout').color).toBe('#6BD08F');
    expect(out.nodes.find(n => n.id === 'hunter').color).toBe('#E08B5C');
    expect(out.nodes.find(n => n.id === 'creative').color).toBe('#B97FE5');
    expect(out.nodes.find(n => n.id === 'hermes').color).toBe('#E3CC68');
  });

  it('returns edges as an empty array', async () => {
    getSupabase.mockReturnValue(null);
    getTenantId.mockResolvedValue(null);
    const out = await buildNeuralMap();
    expect(out.edges).toEqual([]);
  });

  it('appends Factory spawned_agents as categories when the table exists', async () => {
    const spawned = [
      { slug: 'beacon', label: 'Beacon', color: '#6FA8DC', detail: 'Morning brief drafter', status: 'approved' },
    ];
    const sb = makeMockSupabase({ aria_memory: [], contacts: [], spawned_agents: spawned });
    getSupabase.mockReturnValue(sb);
    getTenantId.mockResolvedValue('tenant-1');
    const out = await buildNeuralMap();
    const beacon = out.nodes.find(n => n.id === 'beacon');
    expect(beacon?.type).toBe('category');
    expect(beacon?.color).toBe('#6FA8DC');
  });

  it('silently ignores spawned_agents table errors (Factory not yet shipped)', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }),
            order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }) }),
          }),
        }),
      }),
    };
    getSupabase.mockReturnValue(sb);
    getTenantId.mockResolvedValue('tenant-1');
    const out = await buildNeuralMap();
    expect(out.nodes.find(n => n.id === 'aria')).toBeTruthy();
    expect(out.nodes.length).toBeGreaterThanOrEqual(5);
  });
});

function makeMockSupabase({ aria_memory, contacts, spawned_agents }) {
  return {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({
            data: table === 'aria_memory' ? aria_memory
                : table === 'contacts'    ? contacts
                : table === 'spawned_agents' ? spawned_agents
                : [],
            error: null,
          }),
          order: () => ({
            limit: () => Promise.resolve({
              data: table === 'aria_memory' ? aria_memory
                  : table === 'contacts'    ? contacts
                  : table === 'spawned_agents' ? spawned_agents
                  : [],
              error: null,
            }),
          }),
        }),
      }),
    }),
  };
}
