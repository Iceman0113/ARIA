export const DENDRITE_VS = /* glsl */`
  varying vec2 vUv;
  varying float vAlong;
  void main() {
    vUv = uv;
    vAlong = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
