import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getClient (consolidated Anthropic singleton)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  });

  it('returns the same client across calls (singleton)', async () => {
    const mod = await import('../src/anthropic.js');
    const a = mod.getClient();
    const b = mod.getClient();
    expect(a).toBe(b);
  });

  it('lazily instantiates — does not throw at import time even if key missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const mod = await import('../src/anthropic.js');
    // Construction MAY throw because SDK requires a key; we only assert import didn't throw.
    expect(typeof mod.getClient).toBe('function');
  });

  it('_resetForTest clears the singleton so a fresh client is built next call', async () => {
    const mod = await import('../src/anthropic.js');
    const a = mod.getClient();
    mod._resetForTest();
    const b = mod.getClient();
    expect(a).not.toBe(b);
  });
});
