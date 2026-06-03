import { describe, it, expect } from 'vitest';
import { SkillsReportSchema, validateSkillsReport } from '../src/factory/schema.js';

const valid = {
  domain: 'competitor intelligence for indianapolis MSPs',
  competencies: ['monitor competitor pricing pages', 'detect new service launches'],
  tools_available: ['web_search'],
  tools_wishlist: [{ name: 'linkedin_company_scraper', purpose: 'pull MSP headcount' }],
  design_patterns: ['polling cadence 6h', 'hash-and-diff change detection'],
  sources: [
    { url: 'https://example.com/a', title: 'Source A', excerpt: 'short excerpt' },
    { url: 'https://example.com/b', title: 'Source B', excerpt: 'another excerpt' },
    { url: 'https://example.com/c', title: 'Source C', excerpt: 'third excerpt' },
  ],
};

describe('SkillsReportSchema', () => {
  it('accepts a valid report', () => {
    expect(() => SkillsReportSchema.parse(valid)).not.toThrow();
  });

  it('rejects a report with no competencies', () => {
    expect(() => SkillsReportSchema.parse({ ...valid, competencies: [] })).toThrow();
  });

  it('rejects a report with an excerpt > 400 chars', () => {
    const bad = { ...valid, sources: [{ ...valid.sources[0], excerpt: 'x'.repeat(401) }, ...valid.sources.slice(1)] };
    expect(() => SkillsReportSchema.parse(bad)).toThrow();
  });

  it('validateSkillsReport returns ok=true for valid', () => {
    const r = validateSkillsReport(valid);
    expect(r.ok).toBe(true);
    expect(r.data.domain).toBe(valid.domain);
  });

  it('validateSkillsReport returns ok=false with error for invalid', () => {
    const r = validateSkillsReport({ domain: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/competencies/i);
  });
});
