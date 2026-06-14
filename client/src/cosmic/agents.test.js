import { describe, it, expect } from 'vitest';
import { AGENTS, agentView } from './agents.js';

describe('agentView', () => {
  it('exposes the six cosmic agents', () => {
    expect(Object.keys(AGENTS)).toEqual(
      ['scout', 'hunter', 'creative', 'hermes', 'beacon', 'verse']
    );
  });

  it('docks an agent that is working and shows its task', () => {
    const v = agentView({ hunter: { state: 'working', task: 'Qualifying lead' } });
    const hunter = v.find(a => a.slug === 'hunter');
    expect(hunter.docked).toBe(true);
    expect(hunter.task).toBe('Qualifying lead');
  });

  it('roams an agent that is idle (or unknown)', () => {
    const v = agentView({ hunter: { state: 'idle' } });
    expect(v.find(a => a.slug === 'hunter').docked).toBe(false);
    expect(v.find(a => a.slug === 'scout').docked).toBe(false); // unmentioned => roams
  });
});
