import * as THREE from 'three';

export function createInitialWorkStates(catSlugs) {
  const out = {};
  catSlugs.forEach(slug => {
    out[slug] = { state: 'idle', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
  });
  // Demo: Beacon kicks off in working state so user sees the float behavior immediately
  if (out['beacon']) out['beacon'].state = 'working';
  return out;
}

/**
 * Lissajous orbit when working; cubic ease-out back to anchor when returning.
 */
export function computeFloatOffset(ws, tSince) {
  const out = new THREE.Vector3();
  if (ws.state === 'working') {
    const r = 1.7;
    out.set(
      Math.sin(tSince * 0.65)       * r * 0.80,
      Math.cos(tSince * 0.75 + 1.2) * r * 0.55,
      Math.sin(tSince * 0.45 + 2.4) * r * 0.70,
    );
  } else if (ws.state === 'returning') {
    const k = Math.min(1, tSince / 1.6);
    const eased = 1 - Math.pow(1 - k, 3);
    out.copy(ws.floatStartOffset).multiplyScalar(1 - eased);
  }
  return out;
}

/**
 * Advances a state machine based on elapsed time. Mutates ws.
 * Demo: 'beacon' auto-cycles working ↔ idle so user sees the animation.
 * Phase D: real WebSocket events drive state transitions.
 */
export function advanceState(ws, tNow, slug) {
  const tSince = tNow - ws.stateStartTime;
  if (ws.state === 'working' && tSince > 8) {
    ws.floatStartOffset.copy(computeFloatOffset(ws, tSince));
    ws.state = 'returning';
    ws.stateStartTime = tNow;
  } else if (ws.state === 'returning' && tSince > 1.6) {
    ws.state = 'idle';
    ws.stateStartTime = tNow;
  } else if (ws.state === 'idle' && slug === 'beacon' && tSince > 2) {
    ws.state = 'working';
    ws.stateStartTime = tNow;
  }
}
