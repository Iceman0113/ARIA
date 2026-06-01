export const ARIA_CORE_FS = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uPulse;
  uniform vec3  uAccent;
  uniform vec3  uDeep;
  uniform vec3  uIridA;
  uniform vec3  uIridB;
  uniform vec3  uIridC;
  varying vec3  vN;
  varying vec3  vW;
  varying float vDisp;

  vec3 iridescence(float cosT) {
    float a = cosT;
    vec3 col =
      uIridA * pow(1.0 - a, 2.0) +
      uIridB * pow(a * (1.0 - a) * 4.0, 1.2) +
      uIridC * pow(a, 3.0);
    return col;
  }

  void main() {
    vec3 V  = normalize(cameraPosition - vW);
    vec3 N  = normalize(vN);
    float ndv = max(dot(N, V), 0.0);
    float fres = pow(1.0 - ndv, 3.0);
    vec3 irid = iridescence(ndv);
    float breath = 0.55 + 0.45 * sin(uTime * 0.9);
    breath = mix(breath, 1.0, uPulse);
    float bands = smoothstep(-0.10, 0.20, vDisp);
    vec3 core = mix(uDeep, uAccent * 0.18, bands);
    vec3 col = core
             + irid * fres * 0.85
             + uAccent * fres * fres * 0.55 * breath
             + uAccent * smoothstep(0.65, 1.0, ndv) * 0.04;
    col += uAccent * uPulse * 0.20;
    gl_FragColor = vec4(col, 1.0);
  }
`;
