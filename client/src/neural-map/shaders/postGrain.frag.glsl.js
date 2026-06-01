export const POST_GRAIN_VS = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const POST_GRAIN_FS = /* glsl */`
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uAberration;
  uniform float uVignette;
  uniform float uGrain;
  uniform vec2  uResolution;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main(){
    vec2 uv = vUv;
    vec2 c  = uv - 0.5;
    float r2 = dot(c, c);
    vec2 dir = normalize(c + 1e-5);
    float strength = uAberration * (0.4 + r2 * 1.6);
    float cr = texture2D(tDiffuse, uv + dir * strength).r;
    float cg = texture2D(tDiffuse, uv).g;
    float cb = texture2D(tDiffuse, uv - dir * strength).b;
    vec3 col = vec3(cr, cg, cb);
    float vig = smoothstep(0.95, 0.20, length(c) * uVignette);
    col *= mix(0.62, 1.0, vig);
    float n = hash(gl_FragCoord.xy + vec2(uTime * 60.0)) - 0.5;
    col += n * uGrain;
    col = col + vec3(0.005, 0.006, 0.012);
    gl_FragColor = vec4(col, 1.0);
  }
`;
