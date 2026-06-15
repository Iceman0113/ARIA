import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── In-memory store (shared across repo mock + direct assertions) ─────────────
const store = { rows: [] };
let nextId = 1;

// ── Mock: Supabase (same pattern as agent-tasks.test.js) ─────────────────────
vi.mock('../supabase.js', () => ({
  getTenantId: async () => 'tenant-test',
  getSupabase: () => {
    const makeChain = (table, ctx = {}) => {
      const chain = {
        eq: (col, val) => {
          ctx.filters = [...(ctx.filters || []), { col, val }];
          return chain;
        },
        in: (col, vals) => {
          ctx.inFilters = [...(ctx.inFilters || []), { col, vals }];
          return chain;
        },
        order: (col, opts) => {
          ctx.orderCol = col;
          ctx.orderAsc = opts?.ascending;
          return chain;
        },
        insert: (row) => ({
          select: () => ({
            single: async () => {
              const saved = {
                id: String(nextId++),
                ...row,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              store.rows.push(saved);
              return { data: saved, error: null };
            },
          }),
        }),
        select: () => chain,
        update: (patch) => ({
          eq: (col, val) => ({
            select: () => ({
              single: async () => {
                const idx = store.rows.findIndex(r => r[col] === val);
                if (idx === -1) return { data: null, error: { message: 'not found' } };
                store.rows[idx] = { ...store.rows[idx], ...patch };
                return { data: store.rows[idx], error: null };
              },
            }),
          }),
        }),
        delete: () => ({
          eq: (col, val) => ({
            eq: async (col2, val2) => {
              store.rows = store.rows.filter(
                r => !(r[col] === val && r[col2] === val2)
              );
              return { error: null };
            },
          }),
        }),
        maybeSingle: async () => {
          let results = [...store.rows];
          for (const f of ctx.filters || []) {
            results = results.filter(r => r[f.col] === f.val);
          }
          for (const f of ctx.inFilters || []) {
            results = results.filter(r => f.vals.includes(r[f.col]));
          }
          return { data: results[0] || null, error: null };
        },
        then: (resolve) => {
          let results = [...store.rows];
          for (const f of ctx.filters || []) {
            results = results.filter(r => r[f.col] === f.val);
          }
          for (const f of ctx.inFilters || []) {
            results = results.filter(r => f.vals.includes(r[f.col]));
          }
          if (ctx.orderCol && ctx.orderAsc === false) {
            results = results.sort(
              (a, b) => new Date(b[ctx.orderCol]) - new Date(a[ctx.orderCol])
            );
          }
          resolve({ data: results, error: null });
        },
      };
      return chain;
    };
    return { from: (table) => makeChain(table) };
  },
}));

// ── Mock: ConfigDrivenAgent (no real Anthropic call) ─────────────────────────
vi.mock('../factory/runtime.js', () => ({
  ConfigDrivenAgent: class {
    async run() {
      return { text: 'MOCK RESULT', shadow: false };
    }
  },
}));

import { mountAgentRoutes } from '../agents/routes.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const broadcasts = [];

function makeApp() {
  const app = express();
  app.use(express.json());
  const broadcast = (event) => broadcasts.push(event);
  mountAgentRoutes(app, { broadcast });
  return app;
}

/** Flush promise micro-task queue so fire-and-forget background work settles. */
async function flushAsync(ms = 20) {
  await new Promise(r => setTimeout(r, ms));
}

beforeEach(() => {
  store.rows = [];
  nextId = 1;
  broadcasts.length = 0;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /agents/:slug/tasks', () => {
  it('returns 404 when slug is unknown (no spawned_agents row)', async () => {
    const res = await request(makeApp())
      .post('/agents/ghost/tasks')
      .send({ text: 'hello' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 when text is empty', async () => {
    // Seed a scout row so slug resolution doesn't 404 first
    store.rows.push({ id: 'agent-1', slug: 'scout', status: 'active' });
    const res = await request(makeApp())
      .post('/agents/scout/tasks')
      .send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text is required/i);
  });

  it('creates a task and returns 201 immediately (scout active)', async () => {
    // Seed a scout agent row
    store.rows.push({ id: 'agent-row', slug: 'scout', status: 'active', system_prompt: 'You scout.', tool_allowlist: [], model: 'claude-haiku' });

    const res = await request(makeApp())
      .post('/agents/scout/tasks')
      .send({ text: 'Research something' });

    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.slug).toBe('scout');
    expect(res.body.task.state).toBe('queued');
  });

  it('background run transitions task to awaiting_approval with MOCK RESULT', async () => {
    store.rows.push({ id: 'agent-row', slug: 'scout', status: 'active', system_prompt: 'You scout.', tool_allowlist: [], model: 'claude-haiku' });

    const app = makeApp();
    const res = await request(app)
      .post('/agents/scout/tasks')
      .send({ text: 'Do something' });

    const taskId = res.body.task.id;

    // Wait for background execution to settle
    await flushAsync(50);

    // Find the updated row in the store
    const updated = store.rows.find(r => r.id === taskId);
    expect(updated).toBeDefined();
    expect(updated.state).toBe('awaiting_approval');
    expect(updated.result).toBe('MOCK RESULT');
  });

  it('broadcasts agent_state working then idle after background run', async () => {
    store.rows.push({ id: 'agent-row', slug: 'scout', status: 'active', system_prompt: 'You scout.', tool_allowlist: [], model: 'claude-haiku' });

    const app = makeApp();
    await request(app).post('/agents/scout/tasks').send({ text: 'Go' });
    await flushAsync(50);

    const stateEvents = broadcasts.filter(e => e.type === 'agent_state');
    expect(stateEvents.some(e => e.slug === 'scout' && e.state === 'working')).toBe(true);
    expect(stateEvents.some(e => e.slug === 'scout' && e.state === 'idle')).toBe(true);
    expect(stateEvents[0].state).toBe('working');
    expect(stateEvents[stateEvents.length - 1].state).toBe('idle');
  });

  it('works for shadow agents too', async () => {
    store.rows.push({ id: 'agent-row', slug: 'echo', status: 'shadow', system_prompt: 'You echo.', tool_allowlist: [], model: 'claude-haiku' });

    const res = await request(makeApp())
      .post('/agents/echo/tasks')
      .send({ text: 'Summarize this' });

    expect(res.status).toBe(201);
    expect(res.body.task.slug).toBe('echo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('failing agent run', () => {
  it('task ends in failed state when ConfigDrivenAgent.run() throws', async () => {
    // Override the mock for this test to throw
    const { ConfigDrivenAgent } = await import('../factory/runtime.js');
    const origRun = ConfigDrivenAgent.prototype.run;
    ConfigDrivenAgent.prototype.run = async function () {
      throw new Error('agent exploded');
    };

    store.rows.push({ id: 'agent-row', slug: 'scout', status: 'active', system_prompt: 'You scout.', tool_allowlist: [], model: 'claude-haiku' });

    const app = makeApp();
    const res = await request(app)
      .post('/agents/scout/tasks')
      .send({ text: 'Cause a failure' });

    expect(res.status).toBe(201); // HTTP response still succeeds immediately

    await flushAsync(50);

    const taskId = res.body.task.id;
    const updated = store.rows.find(r => r.id === taskId);
    expect(updated).toBeDefined();
    expect(updated.state).toBe('failed');
    expect(updated.result).toContain('agent exploded');

    // Agent state broadcast goes idle on failure too
    const stateEvents = broadcasts.filter(e => e.type === 'agent_state');
    expect(stateEvents.some(e => e.slug === 'scout' && e.state === 'idle')).toBe(true);

    // Restore
    ConfigDrivenAgent.prototype.run = origRun;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /agents/tasks?state=', () => {
  it('returns tasks in awaiting_approval by default', async () => {
    // Insert tasks directly into store (different states)
    store.rows.push(
      { id: '10', slug: 'scout', state: 'awaiting_approval', tenant_id: 'tenant-test', text: 'T1', created_at: new Date().toISOString() },
      { id: '11', slug: 'echo',  state: 'queued',            tenant_id: 'tenant-test', text: 'T2', created_at: new Date().toISOString() },
    );
    const res = await request(makeApp()).get('/agents/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].state).toBe('awaiting_approval');
  });

  it('accepts an explicit state query param', async () => {
    store.rows.push(
      { id: '20', slug: 'scout', state: 'failed', tenant_id: 'tenant-test', text: 'T1', created_at: new Date().toISOString() },
      { id: '21', slug: 'echo',  state: 'queued', tenant_id: 'tenant-test', text: 'T2', created_at: new Date().toISOString() },
    );
    const res = await request(makeApp()).get('/agents/tasks?state=failed');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].state).toBe('failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /agents/:slug/tasks', () => {
  it('returns tasks for a slug', async () => {
    store.rows.push(
      { id: '30', slug: 'scout', state: 'queued', tenant_id: 'tenant-test', text: 'T1', created_at: new Date().toISOString() },
      { id: '31', slug: 'echo',  state: 'queued', tenant_id: 'tenant-test', text: 'T2', created_at: new Date().toISOString() },
    );
    const res = await request(makeApp()).get('/agents/scout/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].slug).toBe('scout');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /agents/tasks/:id/approve', () => {
  it('transitions awaiting_approval → approved', async () => {
    store.rows.push({
      id: '50',
      slug: 'scout',
      state: 'awaiting_approval',
      tenant_id: 'tenant-test',
      text: 'Task',
      result: 'MOCK RESULT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await request(makeApp()).post('/agents/tasks/50/approve');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const updated = store.rows.find(r => r.id === '50');
    expect(updated.state).toBe('approved');
  });

  it('broadcasts agent_task.updated on approve', async () => {
    store.rows.push({
      id: '51',
      slug: 'scout',
      state: 'awaiting_approval',
      tenant_id: 'tenant-test',
      text: 'Task',
      result: 'OUT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await request(makeApp()).post('/agents/tasks/51/approve');
    expect(broadcasts.some(e => e.type === 'agent_task.updated' && e.id === '51')).toBe(true);
  });

  it('returns 409 for non-awaiting_approval task', async () => {
    store.rows.push({
      id: '52',
      slug: 'scout',
      state: 'queued',
      tenant_id: 'tenant-test',
      text: 'Task',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await request(makeApp()).post('/agents/tasks/52/approve');
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown task id', async () => {
    const res = await request(makeApp()).post('/agents/tasks/nonexistent/approve');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /agents/tasks/:id/reject', () => {
  it('transitions awaiting_approval → rejected', async () => {
    store.rows.push({
      id: '60',
      slug: 'scout',
      state: 'awaiting_approval',
      tenant_id: 'tenant-test',
      text: 'Task',
      result: 'OUT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await request(makeApp()).post('/agents/tasks/60/reject');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');

    const updated = store.rows.find(r => r.id === '60');
    expect(updated.state).toBe('rejected');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /agents/:slug/tasks/:id', () => {
  it('deletes a queued task', async () => {
    store.rows.push({
      id: '70',
      slug: 'scout',
      state: 'queued',
      tenant_id: 'tenant-test',
      text: 'Task',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await request(makeApp()).delete('/agents/scout/tasks/70');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 409 when task is not queued', async () => {
    store.rows.push({
      id: '71',
      slug: 'scout',
      state: 'running',
      tenant_id: 'tenant-test',
      text: 'Task',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await request(makeApp()).delete('/agents/scout/tasks/71');
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown task', async () => {
    const res = await request(makeApp()).delete('/agents/scout/tasks/nonexistent');
    expect(res.status).toBe(404);
  });
});
