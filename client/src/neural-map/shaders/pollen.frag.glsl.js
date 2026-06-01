export const POLLEN_FS = /* glsl */`
  varying vec3 vColor;
  varying float vFlicker;
  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core  = smoothstep(0.5, 0.0, d);
    float glow  = pow(1.0 - d * 2.0, 2.2);
    vec3 col = vColor * (core * 0.95 + glow * 0.55) * vFlicker;
    float a = (core * 0.9 + glow * 0.6) * vFlicker;
    gl_FragColor = vec4(col, a);
  }
`;
