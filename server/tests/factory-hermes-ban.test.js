import { describe, it, expect } from 'vitest';
import { callTool } from '../src/tools.js';

describe('Hermes ban (Layer 3 containment, spec §8)', () => {
  it('throws when delegate_to_hermes is called with spawned_agent ctx', async () => {
    await expect(
      callTool('delegate_to_hermes', { task: 'x' }, () => {}, () => {}, { caller: { kind: 'spawned_agent', slug: 'echo' } })
    ).rejects.toThrow(/Hermes is unreachable/);
  });
});
