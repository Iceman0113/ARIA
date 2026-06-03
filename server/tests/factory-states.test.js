import { describe, it, expect } from 'vitest';
import { TRANSITIONS, canTransition, assertTransition, TerminalStates } from '../src/factory/states.js';

describe('TRANSITIONS', () => {
  it('matches spec §4', () => {
    expect(TRANSITIONS.pending).toEqual(new Set(['researching', 'failed']));
    expect(TRANSITIONS.researching).toEqual(new Set(['drafting_spec', 'failed']));
    expect(TRANSITIONS.drafting_spec).toEqual(new Set(['writing_prompt', 'failed']));
    expect(TRANSITIONS.writing_prompt).toEqual(new Set(['awaiting_approval', 'failed']));
    expect(TRANSITIONS.awaiting_approval).toEqual(new Set(['approved', 'rejected', 'writing_prompt', 'failed']));
    expect(TRANSITIONS.approved).toEqual(new Set());
    expect(TRANSITIONS.rejected).toEqual(new Set());
    expect(TRANSITIONS.failed).toEqual(new Set());
  });

  it('TerminalStates = approved, rejected, failed', () => {
    expect(TerminalStates).toEqual(new Set(['approved', 'rejected', 'failed']));
  });

  it('canTransition is true for pending → researching', () => {
    expect(canTransition('pending', 'researching')).toBe(true);
  });

  it('canTransition is false for pending → approved', () => {
    expect(canTransition('pending', 'approved')).toBe(false);
  });

  it('assertTransition throws on invalid', () => {
    expect(() => assertTransition('approved', 'researching')).toThrow(/invalid.*transition/i);
  });

  it('assertTransition is silent on valid', () => {
    expect(() => assertTransition('awaiting_approval', 'rejected')).not.toThrow();
  });
});
