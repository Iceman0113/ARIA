import { describe, it, expect } from 'vitest';
import { buildDispatchTool } from '../src/factory/dispatch-tool.js';

describe('buildDispatchTool', () => {
  it('returns a uniform tool schema with message:string input', () => {
    const tool = buildDispatchTool('echo', {
      slug: 'echo',
      name: 'Echo',
      specialty: 'PDF watcher for South Indy MSPs',
    });
    expect(tool.name).toBe('dispatch_to_echo');
    expect(tool.description).toBe('PDF watcher for South Indy MSPs');
    expect(tool.input_schema.properties.message.type).toBe('string');
    expect(tool.input_schema.required).toEqual(['message']);
    expect(tool.factory_allowed).toBe(false);
  });
});
