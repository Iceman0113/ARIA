import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/skills-report-example.json';

vi.mock('../src/anthropic.js', () => ({
  getClient: () => ({
    messages: {
      create: vi.fn().mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'emit_skills_report', input: fixture }],
      }),
    },
  }),
}));

vi.mock('../src/factory/cache.js', () => ({
  normalizeQuery: (q) => q.toLowerCase().trim(),
  hashQuery: (q) => `hash:${q}`,
  getCachedReport: vi.fn().mockResolvedValue(null),
  saveReport: vi.fn().mockResolvedValue('rep_abc'),
}));

vi.mock('../src/subagents/shared.js', () => ({
  webSearch: vi.fn(),
  WEB_TOOLS: [],
}));

beforeEach(() => vi.resetModules());

describe('runResearch', () => {
  it('returns a validated Skills Report when the LLM emits one on iter 1', async () => {
    const { runResearch } = await import('../src/factory/research.js');
    const result = await runResearch('PDF extraction', ['web_search']);
    expect(result.ok).toBe(true);
    expect(result.report.domain).toBe('PDF text extraction');
    expect(result.report.competencies.length).toBeGreaterThan(0);
    expect(result.reportId).toBe('rep_abc');
    expect(result.cached).toBe(false);
  });

  it('short-circuits and returns a cached report if one exists within 24h', async () => {
    vi.resetModules();
    vi.doMock('../src/factory/cache.js', () => ({
      normalizeQuery: (q) => q,
      hashQuery: (q) => q,
      getCachedReport: vi.fn().mockResolvedValue({ id: 'rep_cached', report: fixture, createdAt: new Date().toISOString() }),
      saveReport: vi.fn(),
    }));
    const { runResearch } = await import('../src/factory/research.js');
    const result = await runResearch('PDF extraction', ['web_search']);
    expect(result.cached).toBe(true);
    expect(result.reportId).toBe('rep_cached');
  });
});
