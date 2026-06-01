import { NOISE_GLSL } from './noise.glsl.js';

export const ARIA_CORE_VS = /* glsl */`
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vN;
  varying vec3 vW;
  varying float vDisp;
  ${NOISE_GLSL}
  void main() {
    vec3 p = position;
    float t = uTime * 0.32;
    float n1 = snoise(p * 1.3 + vec3(t, t*0.7, -t*0.5));
    float n2 = snoise(p * 2.7 + vec3(-t*0.6, t*1.2, t*0.4)) * 0.5;
    float n3 = snoise(p * 5.5 + vec3(t*1.5, -t, t*0.9))     * 0.22;
    float disp = (n1 + n2 + n3) * (0.16 + uPulse * 0.06);
    vec3 displaced = p + normal * disp;
    vDisp = disp;
    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vW = wp.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
