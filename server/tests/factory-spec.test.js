import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import fixture from './fixtures/skills-report-example.json';
import { writeAgentSpec, AGENT_SPECS_DIR } from '../src/factory/spec.js';

const slug = 'test-echo-' + Math.random().toString(36).slice(2, 8);
const specPath = join(AGENT_SPECS_DIR, `${slug}.md`);

afterEach(() => {
  if (existsSync(specPath)) unlinkSync(specPath);
});

describe('writeAgentSpec', () => {
  it('writes a markdown file with all required sections', () => {
    const result = writeAgentSpec({
      slug,
      name: 'Echo',
      role: 'Competitor watch for South Indy MSPs',
      specialRequirements: 'Notify me only when something material changes.',
      report: fixture,
    });
    expect(result.path).toBe(specPath);
    expect(existsSync(specPath)).toBe(true);
    const md = readFileSync(specPath, 'utf-8');
    expect(md).toMatch(/# Echo/);
    expect(md).toMatch(/`dispatch_to_test-echo/);
    expect(md).toMatch(/## Role/);
    expect(md).toMatch(/## Competencies/);
    expect(md).toMatch(/## Granted tools/);
    expect(md).toMatch(/## Wishlist tools/);
    expect(md).toMatch(/## Design patterns/);
    expect(md).toMatch(/## Sources/);
    expect(md).toMatch(/Extract text from PDF/);
  });
});
