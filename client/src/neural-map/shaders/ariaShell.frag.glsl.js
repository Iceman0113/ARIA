export const ARIA_SHELL_VS = /* glsl */`
  varying vec3 vN; varying vec3 vW;
  void main(){
    vN = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
export const ARIA_SHELL_FS = /* glsl */`
  uniform float uTime; uniform vec3 uAccent;
  varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(normalize(vN), V), 0.0), 2.0);
    float pulse = 0.55 + 0.45 * sin(uTime * 0.6);
    vec3 col = uAccent * fres * 0.5 * pulse;
    gl_FragColor = vec4(col, fres * 0.32);
  }
`;
