import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/factory/repo.js', () => ({
  createTask: vi.fn(async (args) => ({ id: 'task-77', ...args })),
}));

let lastKickoff = null;
vi.mock('../src/factory/pipeline.js', () => ({
  SpawnPipeline: class {
    constructor(opts) { this.opts = opts; }
    kickoff(id) { lastKickoff = id; return Promise.resolve(); }
  },
  _inFlight: new Set(),
}));

beforeEach(() => { lastKickoff = null; });

describe('delegateToFactory', () => {
  it('creates a task and kicks off the pipeline', async () => {
    const { delegateToFactory } = await import('../src/factory/delegate.js');
    const broadcast = vi.fn();
    const result = await delegateToFactory({
      name_hint: 'Echo',
      role_description: 'monitor PDF extraction',
      special_requirements: null,
    }, broadcast);
    expect(result.taskId).toBe('task-77');
    expect(result.status).toBe('queued');
    expect(lastKickoff).toBe('task-77');
  });

  it('returns an error result on missing fields', async () => {
    const { delegateToFactory } = await import('../src/factory/delegate.js');
    const result = await delegateToFactory({}, () => {});
    expect(result.error).toMatch(/role_description|name_hint/i);
  });
});
