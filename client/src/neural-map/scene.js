import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * createScene — mounts a Three.js scene into the given hosts.
 * Returns a { dispose() } handle for unmounting.
 *
 * Phase B fills this out element by element. Phase B1 is just a black scene.
 */
export function createScene({ canvas, labelLayer, tooltip, data, workStates }) {
  const stage = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 1.0);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000005, 0.018);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 240);
  camera.position.set(0, 0.8, 15.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.autoRotate = false;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 24;
  controls.target.set(0, 0, 0);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    },
  };
}
