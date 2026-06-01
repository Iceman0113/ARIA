import { NOISE_GLSL } from './noise.glsl.js';

export const BACKDROP_VS = /* glsl */`
  varying vec3 vP;
  void main(){
    vP = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const BACKDROP_FS = /* glsl */`
  ${NOISE_GLSL}
  uniform float uTime;
  varying vec3 vP;
  void main(){
    vec3 deep = vec3(0.010, 0.012, 0.028);
    vec3 cool = vec3(0.020, 0.040, 0.085);
    vec3 warm = vec3(0.055, 0.025, 0.060);
    float up   = smoothstep(-0.4, 0.7, vP.y);
    float down = smoothstep( 0.3, -0.8, vP.y);
    vec3 col = deep;
    col = mix(col, cool, up * 0.55);
    col = mix(col, warm, down * 0.42);
    float behind = pow(max(-vP.z, 0.0), 4.0);
    col += vec3(0.18, 0.22, 0.10) * behind * 0.10;
    float n = snoise(vP * 4.0 + vec3(uTime * 0.05));
    col += vec3(n) * 0.006;
    gl_FragColor = vec4(col, 1.0);
  }
`;
