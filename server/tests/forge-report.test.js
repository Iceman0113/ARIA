import { describe, it, expect } from 'vitest';
import { summarizeMerch } from '../src/forge-report.js';

describe('summarizeMerch', () => {
  it('counts GitFunny products by status and sums revenue', () => {
    const items = [
      { Status: 'idea' },
      { Status: 'Drafted' },
      { Status: 'Built' },
      { Status: 'live', Revenue: 24.99 },
      { Status: 'live', Revenue: 26.99 },
      { Status: 'Paused' },
    ];
    expect(summarizeMerch(items)).toEqual({
      total: 6,
      byStatus: { idea: 1, Drafted: 1, Built: 1, live: 2, Paused: 1 },
      pendingGate1: 1,   // Drafted, awaiting Concept OK
      pendingGate2: 1,   // Built, awaiting Publish
      live: 2,
      totalRevenue: 51.98,
    });
  });

  it('handles empty input', () => {
    expect(summarizeMerch([])).toEqual({
      total: 0, byStatus: {}, pendingGate1: 0, pendingGate2: 0, live: 0, totalRevenue: 0,
    });
  });
});
