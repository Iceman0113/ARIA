export const POLLEN_VS = /* glsl */`
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vFlicker;
  void main(){
    vColor = aColor;
    vFlicker = 0.55 + 0.45 * sin(uTime * 1.8 + aPhase * 5.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (1.0 / -mv.z) * 18.0;
  }
`;
