import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeFloatOffset, advanceState } from './workStates.js';

describe('computeFloatOffset', () => {
  it('returns zero vector for idle', () => {
    const v = computeFloatOffset({ state: 'idle', stateStartTime: 0 }, 5.0);
    expect(v.length()).toBe(0);
  });
  it('returns a large Lissajous offset when working (dramatic orbit, r~2.6)', () => {
    const v = computeFloatOffset({ state: 'working', stateStartTime: 0 }, 1.0);
    expect(v.length()).toBeGreaterThan(1.0);
    expect(v.length()).toBeLessThan(5.0);
  });
  it('eases the offset back to zero over 1.6s when returning', () => {
    const ws = { state: 'returning', stateStartTime: 0, floatStartOffset: new THREE.Vector3(1.0, 0, 0) };
    const v0 = computeFloatOffset(ws, 0);
    const v1 = computeFloatOffset(ws, 1.6);
    expect(v0.x).toBeCloseTo(1.0, 5);
    expect(v1.x).toBeCloseTo(0.0, 5);
  });
});

describe('advanceState', () => {
  it('transitions working → returning after 8s', () => {
    const ws = { state: 'working', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
    advanceState(ws, 9.0, /* slug */ 'scout');
    expect(ws.state).toBe('returning');
    expect(ws.stateStartTime).toBe(9.0);
  });
  it('transitions returning → idle after 1.6s', () => {
    const ws = { state: 'returning', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
    advanceState(ws, 1.7, 'scout');
    expect(ws.state).toBe('idle');
  });
  it('beacon re-triggers working after 2s idle (demo behavior)', () => {
    const ws = { state: 'idle', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
    advanceState(ws, 2.1, 'beacon');
    expect(ws.state).toBe('working');
  });
  it('non-beacon slugs do NOT auto-trigger working from idle', () => {
    const ws = { state: 'idle', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
    advanceState(ws, 100, 'scout');
    expect(ws.state).toBe('idle');
  });
});
