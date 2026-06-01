export const DENDRITE_FS = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uPulse;
  uniform vec3  uColor;
  uniform float uFreshness;
  varying vec2  vUv;
  varying float vAlong;

  void main(){
    float radial = 1.0 - abs(vUv.y - 0.5) * 2.0;
    radial = pow(radial, 2.0);
    float base = mix(1.10, 0.40, vAlong) * radial;
    float speed = 0.18 + uFreshness * 0.30;
    float p1 = fract(vAlong * 1.0 - uTime * speed);
    float p2 = fract(vAlong * 1.0 - uTime * speed * 0.6 + 0.43);
    float pulse = pow(1.0 - p1, 12.0) + pow(1.0 - p2, 20.0) * 0.7;
    pulse *= radial * (0.65 + uFreshness * 0.7);
    float breath = 0.88 + 0.12 * sin(uTime * 0.9);
    vec3 col = uColor * base * breath + uColor * pulse * 1.5;
    col += uColor * uPulse * 0.45 * radial;
    float alpha = clamp(base * 0.75 + pulse * 1.0, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;
