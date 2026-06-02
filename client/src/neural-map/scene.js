import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ARIA_CORE_VS } from './shaders/ariaCore.vert.glsl.js';
import { ARIA_CORE_FS } from './shaders/ariaCore.frag.glsl.js';
import { ARIA_SHELL_VS, ARIA_SHELL_FS } from './shaders/ariaShell.frag.glsl.js';

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

  // ── ARIA CORE ─────────────────────────────────────────────────
  const coreUniforms = {
    uTime:   { value: 0 },
    uPulse:  { value: 0.0 },
    uAccent: { value: new THREE.Color(0xC5FF4D) },
    uDeep:   { value: new THREE.Color(0x0a0e1a) },
    uIridA:  { value: new THREE.Color(0xC5FF4D) },
    uIridB:  { value: new THREE.Color(0x7AC8FF) },
    uIridC:  { value: new THREE.Color(0xE89FE8) },
  };
  const coreGeom = new THREE.IcosahedronGeometry(1.55, 6);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: coreUniforms,
    vertexShader:   ARIA_CORE_VS,
    fragmentShader: ARIA_CORE_FS,
    transparent: false,
  });
  const coreMesh = new THREE.Mesh(coreGeom, coreMat);
  const ariaNode = data.nodes.find(n => n.id === 'aria');
  if (!ariaNode) throw new Error('createScene: aria hub node missing from data.nodes');
  coreMesh.userData = { ...ariaNode, _color: '#C5FF4D' };
  scene.add(coreMesh);

  // ── OUTER SHELL ───────────────────────────────────────────────
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAccent: { value: new THREE.Color(0xC5FF4D) } },
    vertexShader: ARIA_SHELL_VS,
    fragmentShader: ARIA_SHELL_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const shellMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.05, 3), shellMat);
  scene.add(shellMesh);

  // ── INNER EMBER ───────────────────────────────────────────────
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xC5FF4D, transparent: true, opacity: 0.92 });
  const emberMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), emberMat);
  scene.add(emberMesh);

  // ── WIREFRAME HALOS (constructed/scientific gravitas) ─────────
  const ariaWireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.72, 2)),
    new THREE.LineBasicMaterial({
      color: 0xC5FF4D, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(ariaWireframe);
  const ariaWireframe2 = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.55, 1)),
    new THREE.LineBasicMaterial({
      color: 0xC5FF4D, transparent: true, opacity: 0.09,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(ariaWireframe2);

  // ── CATEGORY POSITIONS (irregular sphere, not a flat ring) ────
  const cats = data.nodes.filter(n => n.type === 'category');
  const CAT_R = 4.7;
  const catDirs = {};
  const phiOffsets   = [0.30, -0.55, 0.18, -0.20, 0.65, -0.35];
  const thetaOffsets = [0.00,  1.05, 2.10,  3.10, 4.05,  5.10];
  cats.forEach((n, i) => {
    const theta = thetaOffsets[i % thetaOffsets.length] + 0.18;
    const phi   = phiOffsets[i % phiOffsets.length];
    const v = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi),
    ).normalize();
    catDirs[n.id] = v.clone();
  });
  const nodePositions = { aria: new THREE.Vector3(0, 0, 0) };
  cats.forEach((n) => {
    nodePositions[n.id] = catDirs[n.id].clone().multiplyScalar(CAT_R);
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  const clock = new THREE.Clock();
  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    // Soft baseline voice pulse (Phase D wires real speak/listen states)
    const speakEnv = 0.5 + 0.5 * Math.sin(t * 0.45);
    const voicePulse = 0.18 + speakEnv * 0.25;

    coreUniforms.uTime.value  = t;
    coreUniforms.uPulse.value = voicePulse;
    shellMat.uniforms.uTime.value = t;
    emberMesh.scale.setScalar(1.0 + Math.sin(t * 2.3) * 0.08 + voicePulse * 0.15);
    ariaWireframe.rotation.y  =  t * 0.10;
    ariaWireframe.rotation.x  = Math.sin(t * 0.15) * 0.15;
    ariaWireframe2.rotation.y = -t * 0.06;
    ariaWireframe2.rotation.z = Math.cos(t * 0.10) * 0.12;

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
