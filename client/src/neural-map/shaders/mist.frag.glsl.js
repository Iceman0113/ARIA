export const MIST_FS = /* glsl */`
  varying float vF;
  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = pow(1.0 - d*2.0, 2.0);
    gl_FragColor = vec4(vec3(0.78, 1.0, 0.55) * 0.25 * vF, a * vF * 0.35);
  }
`;
