import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── State machine tests (no mocks needed) ────────────────────────────────────
import { assertTransition, TerminalStates, TRANSITIONS } from '../agents/states.js';

describe('assertTransition', () => {
  it('allows queued → running', () => {
    expect(() => assertTransition('queued', 'running')).not.toThrow();
  });

  it('allows running → awaiting_approval', () => {
    expect(() => assertTransition('running', 'awaiting_approval')).not.toThrow();
  });

  it('allows awaiting_approval → approved', () => {
    expect(() => assertTransition('awaiting_approval', 'approved')).not.toThrow();
  });

  it('allows awaiting_approval → rejected', () => {
    expect(() => assertTransition('awaiting_approval', 'rejected')).not.toThrow();
  });

  it('allows running → failed', () => {
    expect(() => assertTransition('running', 'failed')).not.toThrow();
  });

  it('allows queued → failed', () => {
    expect(() => assertTransition('queued', 'failed')).not.toThrow();
  });

  it('allows awaiting_approval → failed', () => {
    expect(() => assertTransition('awaiting_approval', 'failed')).not.toThrow();
  });

  it('THROWS on queued → approved (skips states)', () => {
    expect(() => assertTransition('queued', 'approved')).toThrow('invalid state transition');
  });

  it('THROWS on approved → running (out of terminal)', () => {
    expect(() => assertTransition('approved', 'running')).toThrow('invalid state transition');
  });

  it('THROWS on rejected → running (out of terminal)', () => {
    expect(() => assertTransition('rejected', 'running')).toThrow('invalid state transition');
  });

  it('THROWS on failed → queued (out of terminal)', () => {
    expect(() => assertTransition('failed', 'queued')).toThrow('invalid state transition');
  });

  it('THROWS on queued → awaiting_approval (skips running)', () => {
    expect(() => assertTransition('queued', 'awaiting_approval')).toThrow('invalid state transition');
  });

  it('TerminalStates contains approved, rejected, failed', () => {
    expect(TerminalStates.has('approved')).toBe(true);
    expect(TerminalStates.has('rejected')).toBe(true);
    expect(TerminalStates.has('failed')).toBe(true);
    expect(TerminalStates.has('queued')).toBe(false);
    expect(TerminalStates.has('running')).toBe(false);
  });
});

// ── tasks-repo tests (mocked Supabase) ───────────────────────────────────────

// In-memory store shared across mock calls
const store = { rows: [] };
let nextId = 1;

vi.mock('../supabase.js', () => ({
  getTenantId: async () => 'tenant-abc',
  getSupabase: () => {
    // Returns a chainable Supabase-style query builder backed by `store.rows`
    const makeChain = (table, ctx = {}) => {
      const chain = {
        // Accumulate filters
        eq:  (col, val)  => { ctx.filters = [...(ctx.filters || []), { col, val }]; return chain; },
        order: (col, opts) => { ctx.orderCol = col; ctx.orderAsc = opts?.ascending; return chain; },
        // Terminal ops
        insert: (row) => {
          ctx.insertRow = row;
          return {
            select: () => ({
              single: async () => {
                const saved = { id: String(nextId++), ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
                store.rows.push(saved);
                return { data: saved, error: null };
              },
            }),
          };
        },
        select: (cols) => {
          ctx.selectCols = cols;
          return chain;
        },
        update: (patch) => {
          ctx.updatePatch = patch;
          // Chainable multi-eq to support optimistic locking:
          // .eq('id', x).eq('state', y).select().single()
          const updateFilters = [];
          const updateChain = {
            eq: (col, val) => {
              updateFilters.push({ col, val });
              return updateChain;
            },
            select: () => ({
              single: async () => {
                const idx = store.rows.findIndex(r =>
                  updateFilters.every(f => r[f.col] === f.val)
                );
                // 0 matched rows → null data (optimistic-lock loss signal)
                if (idx === -1) return { data: null, error: null };
                store.rows[idx] = { ...store.rows[idx], ...patch };
                return { data: store.rows[idx], error: null };
              },
            }),
          };
          return updateChain;
        },
        delete: () => ({
          eq: (col, val) => ({
            eq: async (col2, val2) => {
              store.rows = store.rows.filter(r => !(r[col] === val && r[col2] === val2));
              return { error: null };
            },
          }),
        }),
        maybeSingle: async () => {
          let results = [...store.rows];
          for (const f of (ctx.filters || [])) {
            results = results.filter(r => r[f.col] === f.val);
          }
          return { data: results[0] || null, error: null };
        },
        // Resolve as array (for listTasks / listByState)
        then: (resolve) => {
          let results = [...store.rows];
          for (const f of (ctx.filters || [])) {
            results = results.filter(r => r[f.col] === f.val);
          }
          if (ctx.orderCol && ctx.orderAsc === false) {
            results = results.sort((a, b) => new Date(b[ctx.orderCol]) - new Date(a[ctx.orderCol]));
          }
          resolve({ data: results, error: null });
        },
      };
      return chain;
    };
    return { from: (table) => makeChain(table) };
  },
}));

import { createTask, listTasks, listByState, getTask, setState, deleteTask } from '../agents/tasks-repo.js';

beforeEach(() => { store.rows = []; nextId = 1; });

describe('createTask', () => {
  it('inserts with state queued and tenant_id', async () => {
    const row = await createTask({ slug: 'echo', text: 'Summarize X' });
    expect(row.state).toBe('queued');
    expect(row.tenant_id).toBe('tenant-abc');
    expect(row.slug).toBe('echo');
    expect(row.text).toBe('Summarize X');
  });

  it('returns an id', async () => {
    const row = await createTask({ slug: 'echo', text: 'Hello' });
    expect(row.id).toBeDefined();
  });
});

describe('listTasks', () => {
  it('returns tasks for a given slug (tenant-scoped)', async () => {
    await createTask({ slug: 'echo', text: 'Task 1' });
    await createTask({ slug: 'forge', text: 'Task 2' });
    const rows = await listTasks('echo');
    expect(rows.every(r => r.slug === 'echo')).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it('returns all tenant tasks when slug omitted', async () => {
    await createTask({ slug: 'echo', text: 'Task 1' });
    await createTask({ slug: 'forge', text: 'Task 2' });
    const rows = await listTasks();
    expect(rows).toHaveLength(2);
  });
});

describe('listByState', () => {
  it('returns tasks in a given state', async () => {
    await createTask({ slug: 'echo', text: 'Task A' });
    const rows = await listByState('queued');
    expect(rows.every(r => r.state === 'queued')).toBe(true);
    expect(rows).toHaveLength(1);
  });
});

describe('getTask', () => {
  it('returns a single row by id (tenant-scoped)', async () => {
    const created = await createTask({ slug: 'echo', text: 'Hello' });
    const found = await getTask(created.id);
    expect(found.id).toBe(created.id);
    expect(found.slug).toBe('echo');
  });

  it('returns null for unknown id', async () => {
    const found = await getTask('nonexistent');
    expect(found).toBeNull();
  });
});

describe('setState', () => {
  it('transitions queued → running', async () => {
    const task = await createTask({ slug: 'echo', text: 'Go' });
    const updated = await setState(task.id, 'running');
    expect(updated.state).toBe('running');
  });

  it('stores result patch when provided', async () => {
    const task = await createTask({ slug: 'echo', text: 'Go' });
    await setState(task.id, 'running');
    const updated = await setState(task.id, 'awaiting_approval', { result: 'Some output' });
    expect(updated.state).toBe('awaiting_approval');
    expect(updated.result).toBe('Some output');
  });

  it('THROWS on invalid transition queued → approved (calls assertTransition)', async () => {
    const task = await createTask({ slug: 'echo', text: 'Go' });
    await expect(setState(task.id, 'approved')).rejects.toThrow('invalid state transition');
  });

  it('THROWS when trying to leave a terminal state', async () => {
    const task = await createTask({ slug: 'echo', text: 'Go' });
    await setState(task.id, 'running');
    await setState(task.id, 'failed');
    await expect(setState(task.id, 'running')).rejects.toThrow('invalid state transition');
  });
});

describe('deleteTask', () => {
  it('removes the task and returns { ok: true }', async () => {
    const task = await createTask({ slug: 'echo', text: 'Bye' });
    const result = await deleteTask(task.id);
    expect(result).toEqual({ ok: true });
  });
});
