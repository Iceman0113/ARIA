import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

const tasks = {
  'awaiting-1': { id: 'awaiting-1', status: 'awaiting_approval', tenant_id: 't1', proposed_manifest: {
    slug: 'echo', name: 'Echo', specialty: 'PDF watcher',
    system_prompt: 'You are Echo. ' + 'word '.repeat(220),
    tool_allowlist: ['web_search'], model: 'claude-sonnet-4-6',
  }, approval_iterations: 0 },
  'pending-1': { id: 'pending-1', status: 'pending', tenant_id: 't1' },
  'awaiting-dup': { id: 'awaiting-dup', status: 'awaiting_approval', tenant_id: 't1', proposed_manifest: {
    slug: 'taken', name: 'Taken', specialty: 'x',
    system_prompt: 'You are Taken. ' + 'word '.repeat(220),
    tool_allowlist: ['web_search'], model: 'claude-sonnet-4-6',
  }, approval_iterations: 0 },
};
const agents = {};

vi.mock('../src/factory/repo.js', () => ({
  getTask: vi.fn(async (id) => tasks[id]),
  transition: vi.fn(async (id, to) => { tasks[id].status = to; return tasks[id]; }),
  insertAgent: vi.fn(async (a) => { agents[a.slug] = a; return a; }),
  listPending: vi.fn(async () => Object.values(tasks).filter(t => t.status === 'awaiting_approval')),
  listAgents: vi.fn(async () => Object.values(agents)),
  updateAgentStatus: vi.fn(async (slug, status) => { agents[slug].status = status; return agents[slug]; }),
  getAgentBySlug: vi.fn(async (slug) => agents[slug] || null),
  setRevisionFeedback: vi.fn(async () => {}),
}));

vi.mock('../src/factory/pipeline.js', () => ({
  SpawnPipeline: class {
    constructor(opts){ this.opts = opts; }
    runRevision = vi.fn(async () => {});
    kickoff = vi.fn(async () => {});
  },
  _inFlight: new Set(),
}));

vi.mock('../src/supabase.js', () => ({
  getSupabase: () => null,
  getTenantId: async () => 't1',
}));

const broadcasts = [];
function makeApp() {
  const app = express();
  app.use(express.json());
  return app;
}

beforeEach(() => {
  broadcasts.length = 0;
  // Reset mutable task state so tests don't bleed into each other
  tasks['awaiting-1'].status = 'awaiting_approval';
  tasks['awaiting-1'].approval_iterations = 0;
});

describe('factory routes', () => {
  it('mounts and POST /factory/tasks/:id/approve inserts an agent + broadcasts agent_added with created_by_task_id', async () => {
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const app = makeApp();
    const broadcast = (e) => broadcasts.push(e);
    mountFactoryRoutes(app, broadcast);

    // Manually trigger handler via test client (supertest dep would be cleaner — use it)
    const { default: supertest } = await import('supertest');
    const res = await supertest(app).post('/factory/tasks/awaiting-1/approve');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.slug).toBe('echo');
    expect(agents.echo.status).toBe('shadow');
    expect(agents.echo.created_by_task_id).toBe('awaiting-1');
    const added = broadcasts.find(b => b.kind === 'agent_added');
    expect(added).toBeTruthy();
    expect(added.created_by_task_id).toBe('awaiting-1');
  });

  it('POST approve returns 409 (not a 500 DB error) when that slug already exists', async () => {
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const { default: supertest } = await import('supertest');
    const app = makeApp();
    mountFactoryRoutes(app, (e) => broadcasts.push(e));
    tasks['awaiting-dup'].status = 'awaiting_approval';
    agents['taken'] = { slug: 'taken', name: 'Taken', status: 'shadow' };
    try {
      const res = await supertest(app).post('/factory/tasks/awaiting-dup/approve');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
      // must not have transitioned or double-inserted
      expect(tasks['awaiting-dup'].status).toBe('awaiting_approval');
    } finally {
      delete agents['taken'];
    }
  });

  it('GET /factory/pending returns awaiting_approval tasks', async () => {
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const app = makeApp();
    mountFactoryRoutes(app, () => {});
    const { default: supertest } = await import('supertest');
    const res = await supertest(app).get('/factory/pending');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.tasks[0].proposed_manifest.slug).toBe('echo');
  });

  it('POST /factory/tasks/:id/reject transitions to rejected', async () => {
    tasks['awaiting-1'].status = 'awaiting_approval';
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const app = makeApp();
    mountFactoryRoutes(app, () => {});
    const { default: supertest } = await import('supertest');
    const res = await supertest(app).post('/factory/tasks/awaiting-1/reject');
    expect(res.status).toBe(200);
    expect(tasks['awaiting-1'].status).toBe('rejected');
  });

  it('POST /factory/agents/:slug/promote moves shadow → active', async () => {
    agents.echo = { slug: 'echo', name: 'Echo', status: 'shadow' };
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const app = makeApp();
    const broadcast = (e) => broadcasts.push(e);
    mountFactoryRoutes(app, broadcast);
    const { default: supertest } = await import('supertest');
    const res = await supertest(app).post('/factory/agents/echo/promote');
    expect(res.status).toBe(200);
    expect(agents.echo.status).toBe('active');
  });

  it('POST /factory/tasks/:id/feedback persists feedback and triggers a revision (no throw, no double-increment)', async () => {
    tasks['awaiting-1'].status = 'awaiting_approval';
    tasks['awaiting-1'].approval_iterations = 0;
    const repoMod = await import('../src/factory/repo.js');
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const app = makeApp();
    mountFactoryRoutes(app, () => {});
    const { default: supertest } = await import('supertest');
    const res = await supertest(app).post('/factory/tasks/awaiting-1/feedback').send({ feedback: 'make it shorter' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('revising');
    expect(repoMod.setRevisionFeedback).toHaveBeenCalledWith('awaiting-1', 'make it shorter');
  });

  it('POST /factory/tasks/:id/feedback rejects with 409 once the revision cap is hit', async () => {
    tasks['awaiting-1'].status = 'awaiting_approval';
    tasks['awaiting-1'].approval_iterations = 3;
    const { mountFactoryRoutes } = await import('../src/factory/routes.js');
    const app = makeApp();
    mountFactoryRoutes(app, () => {});
    const { default: supertest } = await import('supertest');
    const res = await supertest(app).post('/factory/tasks/awaiting-1/feedback').send({ feedback: 'again' });
    expect(res.status).toBe(409);
  });
});
