export const FILAMENT_VS = /* glsl */`
  varying float vAlong;
  void main(){ vAlong = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const FILAMENT_FS = /* glsl */`
  uniform float uTime; uniform float uFreshness; uniform float uPhase;
  uniform vec3 uColor; varying float vAlong;
  void main(){
    float taper = mix(1.0, 0.05, vAlong);
    float shimmer = 0.7 + 0.30 * sin(uTime * (1.4 + uFreshness) + uPhase);
    float tipBoost = smoothstep(0.78, 1.0, vAlong) * 0.7;
    vec3 col = uColor * taper * shimmer + uColor * tipBoost;
    float a = taper * 0.95 + tipBoost * 0.4;
    gl_FragColor = vec4(col, a);
  }
`;
