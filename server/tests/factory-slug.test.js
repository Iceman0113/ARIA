import { describe, it, expect } from 'vitest';
import { slugify, RESERVED_SLUGS, isReserved } from '../src/factory/slug.js';

describe('slugify', () => {
  it('lowercases and dash-joins', () => {
    expect(slugify('Echo Watch')).toBe('echo-watch');
  });

  it('strips non-alphanumeric chars', () => {
    expect(slugify('Atlas v2.0!')).toBe('atlas-v2-0');
  });

  it('truncates to 40 chars max', () => {
    const out = slugify('x'.repeat(60));
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});

describe('RESERVED_SLUGS', () => {
  it('contains the 5 reserved core sub-agent slugs', () => {
    expect(RESERVED_SLUGS).toEqual(new Set(['scout', 'hunter', 'creative', 'hermes', 'factory']));
  });

  it('isReserved is case-insensitive and accepts unslugged input', () => {
    expect(isReserved('Scout')).toBe(true);
    expect(isReserved('SCOUT')).toBe(true);
    expect(isReserved('hermes ')).toBe(true);
    expect(isReserved('echo')).toBe(false);
  });
});
