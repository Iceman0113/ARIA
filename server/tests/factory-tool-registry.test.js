import { describe, it, expect } from 'vitest';
import { factoryRegistry } from '../src/factory/tool-registry.js';

describe('factoryRegistry', () => {
  it('register adds a tool that getDynamicDefinitions surfaces', () => {
    factoryRegistry.register({ name: 'dispatch_to_test1', description: 'd', input_schema: { type: 'object' }, factory_allowed: false }, async () => ({ ok: true }));
    const defs = factoryRegistry.getDynamicDefinitions();
    expect(defs.some(d => d.name === 'dispatch_to_test1')).toBe(true);
  });

  it('unregister removes the tool', () => {
    factoryRegistry.register({ name: 'dispatch_to_test2', description: 'd', input_schema: { type: 'object' }, factory_allowed: false }, async () => ({ ok: true }));
    factoryRegistry.unregister('dispatch_to_test2');
    expect(factoryRegistry.getDynamicDefinitions().some(d => d.name === 'dispatch_to_test2')).toBe(false);
  });

  it('execute calls the registered executor', async () => {
    factoryRegistry.register({ name: 'dispatch_to_test3', description: 'd', input_schema: { type: 'object' }, factory_allowed: false }, async (input) => ({ echoed: input?.message || null }));
    const result = await factoryRegistry.execute('dispatch_to_test3', { message: 'hi' }, () => {});
    expect(result.echoed).toBe('hi');
  });

  it('execute returns null for unknown tool', async () => {
    const result = await factoryRegistry.execute('dispatch_to_nope', {}, () => {});
    expect(result).toBeNull();
  });
});
