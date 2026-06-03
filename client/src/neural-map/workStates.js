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
    // Big, energetic Lissajous orbit with a secondary harmonic for swooping motion.
    const r = 2.6;
    const t = tSince;
    out.set(
      (Math.sin(t * 0.95)       * 0.85 + Math.sin(t * 2.1 + 0.5) * 0.28) * r,
      (Math.cos(t * 1.10 + 1.2) * 0.62 + Math.sin(t * 2.5 + 2.0) * 0.22) * r,
      (Math.sin(t * 0.75 + 2.4) * 0.78 + Math.cos(t * 1.7 + 1.1) * 0.24) * r,
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
