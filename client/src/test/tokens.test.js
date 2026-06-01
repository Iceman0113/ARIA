import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

describe('design tokens', () => {
  it('defines lime accent #C5FF4D', () => {
    expect(css).toMatch(/--accent:\s*#C5FF4D/);
  });
  it('defines warm near-black bg rgb(3, 3, 7)', () => {
    expect(css).toMatch(/--bg:\s*rgb\(3,\s*3,\s*7\)/);
  });
  it('imports Space Grotesk + Geist + Geist Mono', () => {
    expect(css).toMatch(/Space\+Grotesk/);
    expect(css).toMatch(/Geist:wght/);
    expect(css).toMatch(/Geist\+Mono/);
  });
  it('defines eyebrow ◦ pseudo-element', () => {
    expect(css).toMatch(/\.eyebrow::before/);
    expect(css).toMatch(/content:\s*"◦ "/);
  });
});
