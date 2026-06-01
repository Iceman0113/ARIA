export const MIST_VS = /* glsl */`
  uniform float uTime; uniform float uPixelRatio;
  varying float vF;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 / -mv.z) * 220.0 * uPixelRatio;
    vF = 0.30 + 0.18 * sin(uTime * 0.6 + position.x * 0.5 + position.z * 0.3);
  }
`;
