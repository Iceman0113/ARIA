import { describe, it, expect } from 'vitest';
import { summarizeMerch } from '../src/forge-report.js';

describe('summarizeMerch', () => {
  it('counts items by status and sums published revenue', () => {
    const items = [
      { Status: 'New' },
      { Status: 'Concept Ready' },
      { Status: 'Built' },
      { Status: 'Published', Price: 24.99 },
      { Status: 'Published', Price: 26.99 },
      { Status: 'Rejected' },
    ];
    expect(summarizeMerch(items)).toEqual({
      total: 6,
      byStatus: { New: 1, 'Concept Ready': 1, Built: 1, Published: 2, Rejected: 1 },
      pendingGate1: 1,
      pendingGate2: 1,
      published: 2,
      listedRevenuePerSale: 51.98,
    });
  });

  it('handles empty input', () => {
    expect(summarizeMerch([])).toEqual({
      total: 0, byStatus: {}, pendingGate1: 0, pendingGate2: 0, published: 0, listedRevenuePerSale: 0,
    });
  });
});
