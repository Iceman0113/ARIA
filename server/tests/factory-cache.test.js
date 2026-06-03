import { describe, it, expect } from 'vitest';
import { normalizeQuery, hashQuery } from '../src/factory/cache.js';

describe('cache helpers', () => {
  it('normalizes queries — lowercase + trim + collapse whitespace', () => {
    expect(normalizeQuery('  PDF   Extraction  ')).toBe('pdf extraction');
    expect(normalizeQuery('Competitor\tIntel')).toBe('competitor intel');
  });

  it('produces stable sha256 hex digests', () => {
    const a = hashQuery('PDF extraction');
    const b = hashQuery('pdf   extraction');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('differs for different queries', () => {
    expect(hashQuery('a')).not.toBe(hashQuery('b'));
  });
});
