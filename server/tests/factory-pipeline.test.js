import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/skills-report-example.json';

const fakeTask = {
  id: 'task-1',
  tenant_id: 'tenant-1',
  requested_by: 'Randy',
  name_hint: 'Echo',
  role_description: 'Monitor PDF extraction pipelines',
  special_requirements: null,
  status: 'pending',
  approval_iterations: 0,
};

let currentTask = { ...fakeTask };

vi.mock('../src/factory/repo.js', () => ({
  getTask: vi.fn(async (id) => ({ ...currentTask })),
  transition: vi.fn(async (id, to, patch = {}) => {
    currentTask = { ...currentTask, ...patch, status: to };
    return { ...currentTask };
  }),
  setError: vi.fn(async (id, msg) => {
    currentTask = { ...currentTask, status: 'failed', error: msg };
  }),
  countTasksToday: vi.fn(async () => 0),
  getAgentBySlug: vi.fn(async () => null),
}));

vi.mock('../src/factory/research.js', () => ({
  runResearch: vi.fn(async () => ({ ok: true, report: fixture, reportId: 'rep-1', cached: false })),
}));

vi.mock('../src/factory/prompt.js', () => ({
  generateSystemPrompt: vi.fn(async () => ({
    ok: true,
    prompt: 'You are Echo. ' + 'word '.repeat(220),
  })),
}));

vi.mock('../src/factory/spec.js', () => ({
  writeAgentSpec: vi.fn(() => ({ path: '/tmp/echo.md' })),
  AGENT_SPECS_DIR: '/tmp',
}));

vi.mock('../src/tools.js', () => ({
  TOOL_DEFINITIONS: [
    { name: 'web_search', factory_allowed: true },
    { name: 'delegate_to_hermes', factory_allowed: false },
  ],
}));

// Minimal Supabase mock so runRevision's loadResearchReport() can fetch the
// cached research report by id.
vi.mock('../src/supabase.js', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { report: fixture }, error: null }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  currentTask = { ...fakeTask };
});

describe('SpawnPipeline.run', () => {
  it('walks pending → researching → drafting_spec → writing_prompt → awaiting_approval', async () => {
    const { SpawnPipeline } = await import('../src/factory/pipeline.js');
    const broadcasts = [];
    const p = new SpawnPipeline({ broadcast: (e) => broadcasts.push(e) });
    await p.run('task-1');
    expect(currentTask.status).toBe('awaiting_approval');
    expect(currentTask.proposed_manifest).toBeTruthy();
    expect(currentTask.proposed_manifest.slug).toBe('echo');
    expect(currentTask.proposed_manifest.tool_allowlist).toEqual(['web_search']);
    expect(broadcasts.some(e => e.kind === 'factory.task_ready')).toBe(true);
  });

  it('rejects reserved slug before any LLM call', async () => {
    currentTask = { ...fakeTask, name_hint: 'Scout' };
    const { SpawnPipeline } = await import('../src/factory/pipeline.js');
    const p = new SpawnPipeline({ broadcast: () => {} });
    await p.run('task-1');
    expect(currentTask.status).toBe('failed');
    expect(currentTask.error).toMatch(/reserved/i);
  });

  it('rejects when daily cap reached', async () => {
    const { countTasksToday } = await import('../src/factory/repo.js');
    countTasksToday.mockResolvedValueOnce(5);
    const { SpawnPipeline } = await import('../src/factory/pipeline.js');
    const p = new SpawnPipeline({ broadcast: () => {} });
    await p.run('task-1');
    expect(currentTask.status).toBe('failed');
    expect(currentTask.error).toMatch(/daily.*cap/i);
  });

  it('caps revision iterations at 3 and fails on the 4th attempt', async () => {
    currentTask = { ...fakeTask, status: 'awaiting_approval', approval_iterations: 3, revision_feedback: 'change X' };
    const { SpawnPipeline } = await import('../src/factory/pipeline.js');
    const p = new SpawnPipeline({ broadcast: () => {} });
    await p.runRevision('task-1');
    expect(currentTask.status).toBe('failed');
    expect(currentTask.error).toMatch(/max revision rounds/i);
  });

  it('runRevision increments approval_iterations and returns to awaiting_approval', async () => {
    currentTask = {
      ...fakeTask,
      status: 'awaiting_approval',
      approval_iterations: 0,
      revision_feedback: 'make it shorter',
      research_report_id: 'rep-1',
      proposed_manifest: {
        slug: 'echo', name: 'Echo', specialty: 'PDF', tool_allowlist: ['web_search'],
        model: 'claude-sonnet-4-6', system_prompt: 'OLD PROMPT',
      },
    };
    const { SpawnPipeline } = await import('../src/factory/pipeline.js');
    const broadcasts = [];
    const p = new SpawnPipeline({ broadcast: (e) => broadcasts.push(e) });
    await p.runRevision('task-1');
    expect(currentTask.status).toBe('awaiting_approval');
    expect(currentTask.approval_iterations).toBe(1);
    expect(broadcasts.some(e => e.kind === 'factory.task_ready' && e.revision === true)).toBe(true);
  });

  it('kickoff registers in _inFlight and clears on completion', async () => {
    const { SpawnPipeline, _inFlight } = await import('../src/factory/pipeline.js');
    const p = new SpawnPipeline({ broadcast: () => {} });
    const promise = p.kickoff('task-1');
    expect(_inFlight.size).toBeGreaterThanOrEqual(1);
    await promise;
    expect(_inFlight.size).toBe(0);
  });
});
