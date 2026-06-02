import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ARIA_CORE_VS } from './shaders/ariaCore.vert.glsl.js';
import { ARIA_CORE_FS } from './shaders/ariaCore.frag.glsl.js';
import { ARIA_SHELL_VS, ARIA_SHELL_FS } from './shaders/ariaShell.frag.glsl.js';
import { DENDRITE_VS } from './shaders/dendrite.vert.glsl.js';
import { DENDRITE_FS } from './shaders/dendrite.frag.glsl.js';
import { FILAMENT_VS, FILAMENT_FS } from './shaders/filament.frag.glsl.js';
import { POLLEN_VS } from './shaders/pollen.vert.glsl.js';
import { POLLEN_FS } from './shaders/pollen.frag.glsl.js';
import { MIST_VS } from './shaders/mist.vert.glsl.js';
import { MIST_FS } from './shaders/mist.frag.glsl.js';
import { BACKDROP_VS, BACKDROP_FS } from './shaders/backdrop.frag.glsl.js';
import { createInitialWorkStates, computeFloatOffset, advanceState } from './workStates.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { POST_GRAIN_VS, POST_GRAIN_FS } from './shaders/postGrain.frag.glsl.js';
import { createTooltip } from './tooltip.js';

/**
 * createScene — mounts a Three.js scene into the given hosts.
 * Returns a { setWorkStates(), dispose() } handle for unmounting and state updates.
 *
 * Phase B fills this out element by element. Phase B1 is just a black scene.
 */
export function createScene({ canvas, labelLayer, tooltip, data }) {
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

  const labelRenderer = new CSS2DRenderer({ element: labelLayer });
  labelRenderer.setSize(stage.clientWidth, stage.clientHeight);

  const controls = new OrbitControls(camera, labelRenderer.domElement);
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

  // ── DENDRITES ─────────────────────────────────────────────────
  const dendriteUniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };

  function makeDendriteMaterial(color, freshness) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime:      dendriteUniforms.uTime,
        uPulse:     dendriteUniforms.uPulse,
        uColor:     { value: new THREE.Color(color) },
        uFreshness: { value: freshness },
      },
      vertexShader:   DENDRITE_VS,
      fragmentShader: DENDRITE_FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  const dendrites = [];
  cats.forEach((cat) => {
    const dir   = catDirs[cat.id].clone();
    const start = dir.clone().multiplyScalar(0.95);
    const end   = nodePositions[cat.id].clone();
    const perp1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    if (perp1.lengthSq() < 0.01) perp1.set(1, 0, 0);
    const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
    // Deterministic-ish curve seed from category id length so dendrites differ but stay stable
    const seed  = (cat.id.length * 13 + cat.id.charCodeAt(0)) % 100 / 100;
    const swirl = (seed - 0.5) * 1.6;
    const flex  = 0.6 + seed * 0.5;
    const ctrl1 = start.clone().lerp(end, 0.30)
      .add(perp1.clone().multiplyScalar(swirl * 0.45))
      .add(perp2.clone().multiplyScalar(flex * 0.35));
    const ctrl2 = start.clone().lerp(end, 0.70)
      .add(perp1.clone().multiplyScalar(-swirl * 0.50))
      .add(perp2.clone().multiplyScalar(-flex * 0.20));
    const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);

    const tubeGeom = new THREE.TubeGeometry(curve, 120, 0.062, 10, false);
    const positions = tubeGeom.attributes.position;
    const uvs       = tubeGeom.attributes.uv;
    const taperOf = (u) => 1.0 - Math.pow(u, 1.5) * 0.62;
    for (let i = 0; i < positions.count; i++) {
      const u  = uvs.getX(i);
      const cx = curve.getPointAt(u);
      const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
      const ox = px - cx.x, oy = py - cx.y, oz = pz - cx.z;
      const tt = taperOf(u);
      positions.setXYZ(i, cx.x + ox * tt, cx.y + oy * tt, cx.z + oz * tt);
    }
    positions.needsUpdate = true;
    tubeGeom.computeBoundingSphere();

    const mat  = makeDendriteMaterial(cat.color, cat.freshness);
    const mesh = new THREE.Mesh(tubeGeom, mat);
    scene.add(mesh);
    dendrites.push({ curve, mesh, fromId: 'aria', toId: cat.id, color: cat.color, freshness: cat.freshness });
  });

  // ── GROWTH TIPS (anemone filaments) ───────────────────────────
  const growthTips = {};
  cats.forEach((cat, ci) => {
    const pos = nodePositions[cat.id];
    const group = new THREE.Group();
    group.position.copy(pos);
    scene.add(group);

    const outward = pos.clone().normalize();
    group.lookAt(group.position.clone().add(outward));

    // hot core sphere
    const coreSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cat.color), transparent: true, opacity: 0.95 })
    );
    coreSphere.userData = { ...cat, _color: cat.color };
    group.add(coreSphere);

    // halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 20, 20),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(cat.color), transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    group.add(halo);

    // 14 filaments — deterministic per-cat per-filament seed
    const filaments = [];
    const FIL_COUNT = 14;
    for (let i = 0; i < FIL_COUNT; i++) {
      const seedA = ((ci * 73 + i * 17) % 100) / 100;
      const seedB = ((ci * 41 + i * 29) % 100) / 100;
      const seedC = ((ci * 13 + i *  7) % 100) / 100;
      const u = i / FIL_COUNT;
      const theta = u * Math.PI * 2 + seedA * 0.6;
      const phi   = (seedB - 0.5) * 1.2;
      const tipDir = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi),
        Math.sin(phi),
        Math.abs(Math.sin(theta)) * 0.4 + 0.25,
      ).normalize();
      const len    = 0.32 + seedC * 0.35;
      const startF = new THREE.Vector3(0, 0, 0);
      const tipF   = tipDir.clone().multiplyScalar(len);
      const ctrlF  = startF.clone().lerp(tipF, 0.5).add(new THREE.Vector3(
        (seedA - 0.5) * 0.12,
        (seedB - 0.5) * 0.12,
        (seedC - 0.5) * 0.12,
      ));
      const curveF = new THREE.QuadraticBezierCurve3(startF, ctrlF, tipF);
      const fGeom  = new THREE.TubeGeometry(curveF, 20, 0.014, 10, false);
      const fMat   = new THREE.ShaderMaterial({
        uniforms: {
          uTime:      dendriteUniforms.uTime,
          uColor:     { value: new THREE.Color(cat.color) },
          uFreshness: { value: cat.freshness },
          uPhase:     { value: seedA * Math.PI * 2 },
        },
        vertexShader:   FILAMENT_VS,
        fragmentShader: FILAMENT_FS,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const filMesh = new THREE.Mesh(fGeom, fMat);
      group.add(filMesh);

      // tip ember at each filament end
      const fTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 12, 12),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(cat.color), transparent: true, opacity: 0.95,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      fTip.position.copy(tipF);
      group.add(fTip);
      filaments.push({ mesh: filMesh, tip: fTip, baseLen: len, dir: tipDir });
    }

    growthTips[cat.id] = { group, coreSphere, halo, filaments, color: cat.color, data: cat };
  });

  // ── CSS2D LABELS ─────────────────────────────────────────────
  {
    const div = document.createElement('div');
    div.className = 'neural-label hub';
    div.textContent = 'A·R·I·A';
    const obj = new CSS2DObject(div);
    obj.position.set(0, 1.55, 0);
    coreMesh.add(obj);
  }
  cats.forEach((cat) => {
    const div = document.createElement('div');
    div.className = 'neural-label category';
    div.innerHTML = `<span class="tick"></span>${cat.label.toUpperCase()}`;
    div.style.color = cat.color;
    const obj = new CSS2DObject(div);
    obj.position.set(0, 0.22, 0);
    growthTips[cat.id].group.add(obj);
  });

  // ── WORK STATES + LEASH LINES ────────────────────────────────
  let workStates = createInitialWorkStates(cats.map(c => c.id));
  const leashes = {};
  cats.forEach(cat => {
    const lGeom = new THREE.BufferGeometry();
    lGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    const line = new THREE.Line(lGeom, new THREE.LineBasicMaterial({
      color: new THREE.Color(cat.color),
      transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    scene.add(line);
    leashes[cat.id] = line;
  });

  const lastTipPositions = {};
  cats.forEach(c => { lastTipPositions[c.id] = nodePositions[c.id].clone(); });

  // ── POLLEN (leaf particles) ──────────────────────────────────
  const POLLEN_PER_CAT = 90;
  const totalPollen = cats.length * POLLEN_PER_CAT;
  const pollenPos    = new Float32Array(totalPollen * 3);
  const pollenColor  = new Float32Array(totalPollen * 3);
  const pollenSize   = new Float32Array(totalPollen);
  const pollenPhase  = new Float32Array(totalPollen);
  const pollenRadius = new Float32Array(totalPollen);
  const pollenTheta  = new Float32Array(totalPollen);
  const pollenPhi    = new Float32Array(totalPollen);
  const pollenSpeed  = new Float32Array(totalPollen);

  const leafNodes = data.nodes.filter(n => n.type === 'leaf');
  const leafToPollenIndex = {};

  cats.forEach((cat, ci) => {
    const pos = nodePositions[cat.id];
    const col = new THREE.Color(cat.color);
    const leaves = leafNodes.filter(l => l.parent === cat.id);
    for (let i = 0; i < POLLEN_PER_CAT; i++) {
      const gi = ci * POLLEN_PER_CAT + i;
      if (i < leaves.length) leafToPollenIndex[leaves[i].id] = gi;
      const seed = ((ci * 47 + i * 31) % 1000) / 1000;
      const seedB = ((ci * 53 + i * 23) % 1000) / 1000;
      const seedC = ((ci * 19 + i * 11) % 1000) / 1000;
      const r  = 0.45 + seed * 0.95;
      const th = seedB * Math.PI * 2;
      const ph = (seedC - 0.5) * Math.PI * 0.85;
      pollenPos[gi*3]   = pos.x + Math.cos(th) * Math.cos(ph) * r;
      pollenPos[gi*3+1] = pos.y + Math.sin(ph) * r;
      pollenPos[gi*3+2] = pos.z + Math.sin(th) * Math.cos(ph) * r;
      pollenColor[gi*3]   = col.r;
      pollenColor[gi*3+1] = col.g;
      pollenColor[gi*3+2] = col.b;
      pollenSize[gi]   = 6.0 + seed * 7.0;
      pollenPhase[gi]  = seedB * Math.PI * 2;
      pollenRadius[gi] = r;
      pollenTheta[gi]  = th;
      pollenPhi[gi]    = ph;
      pollenSpeed[gi]  = 0.20 + seedC * 0.45;
    }
  });

  const pollenGeom = new THREE.BufferGeometry();
  pollenGeom.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  pollenGeom.setAttribute('aColor',   new THREE.BufferAttribute(pollenColor, 3));
  pollenGeom.setAttribute('aSize',    new THREE.BufferAttribute(pollenSize, 1));
  pollenGeom.setAttribute('aPhase',   new THREE.BufferAttribute(pollenPhase, 1));

  const pollenMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader:   POLLEN_VS,
    fragmentShader: POLLEN_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pollen = new THREE.Points(pollenGeom, pollenMat);
  scene.add(pollen);

  // ── MIST (ambient atmospheric drift) ─────────────────────────
  const MIST_N = 220;
  const mistGeom = new THREE.BufferGeometry();
  const mistPos  = new Float32Array(MIST_N * 3);
  const mistVel  = [];
  for (let i = 0; i < MIST_N; i++) {
    const seedA = ((i * 71) % 1000) / 1000;
    const seedB = ((i * 53) % 1000) / 1000;
    const seedC = ((i * 37) % 1000) / 1000;
    const r  = 10 + seedA * 24;
    const th = seedB * Math.PI * 2;
    const ph = Math.acos(2 * seedC - 1);
    mistPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    mistPos[i*3+1] = r * Math.cos(ph) * 0.55;
    mistPos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    mistVel.push([
      ((((i * 7) % 100) / 100) - 0.5) * 0.004,
      ((((i * 13) % 100) / 100) - 0.5) * 0.0025,
      ((((i * 17) % 100) / 100) - 0.5) * 0.004,
    ]);
  }
  mistGeom.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const mistMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader:   MIST_VS,
    fragmentShader: MIST_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Points(mistGeom, mistMat));

  // ── NEBULA BACKDROP (inside-out sphere) ──────────────────────
  const backdropMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader:   BACKDROP_VS,
    fragmentShader: BACKDROP_FS,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(85, 32, 32), backdropMat));

  // ── STARFIELD (1600 distant points) ──────────────────────────
  {
    const N = 1600;
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const seedA = ((i * 91) % 1000) / 1000;
      const seedB = ((i * 67) % 1000) / 1000;
      const seedC = ((i * 41) % 1000) / 1000;
      const r  = 45 + seedA * 55;
      const th = seedB * Math.PI * 2;
      const ph = Math.acos(2 * seedC - 1);
      a[i*3]   = r * Math.sin(ph) * Math.cos(th);
      a[i*3+1] = r * Math.cos(ph);
      a[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.8,
    })));
  }

  // ── CAMERA CHOREOGRAPHY ──────────────────────────────────────
  const parallaxTarget = new THREE.Vector2(0, 0);
  const onMouseMove = (e) => {
    const x = (e.clientX / window.innerWidth)  * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    parallaxTarget.set(x * 0.45, -y * 0.30);
  };
  window.addEventListener('mousemove', onMouseMove);

  let dragging = false;
  controls.addEventListener('start', () => { dragging = true; });
  controls.addEventListener('end',   () => { setTimeout(() => { dragging = false; }, 1800); });

  // ── POST-PROCESSING ──────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(stage.clientWidth, stage.clientHeight),
    0.78,   // strength
    0.72,   // radius
    0.15    // threshold
  );
  composer.addPass(bloom);
  const finalPass = new ShaderPass({
    uniforms: {
      tDiffuse:    { value: null },
      uTime:       { value: 0 },
      uAberration: { value: 0.0028 },
      uVignette:   { value: 1.10 },
      uGrain:      { value: 0.040 },
      uResolution: { value: new THREE.Vector2(stage.clientWidth, stage.clientHeight) },
    },
    vertexShader:   POST_GRAIN_VS,
    fragmentShader: POST_GRAIN_FS,
  });
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());

  // ── HOVER TOOLTIP ────────────────────────────────────────────
  const hoverables = [coreMesh, ...cats.map(c => growthTips[c.id].coreSphere)];
  const dataNodesById = {};
  data.nodes.forEach(n => { dataNodesById[n.id] = n; });
  const hoverCtl = createTooltip({
    stage, tooltip, camera,
    hoverables, pollenGeom, leafNodes, leafToPollenIndex, dataNodesById,
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloom.setSize(w, h);
    finalPass.uniforms.uResolution.value.set(w, h);
    pollenMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    mistMat.uniforms.uPixelRatio.value   = renderer.getPixelRatio();
    labelRenderer.setSize(w, h);
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

    dendriteUniforms.uTime.value  = t;
    dendriteUniforms.uPulse.value = voicePulse;

    cats.forEach((cat, i) => {
      const tip  = growthTips[cat.id];
      const base = nodePositions[cat.id];
      const dx = Math.sin(t * 0.42 + i * 1.7) * 0.08;
      const dy = Math.cos(t * 0.35 + i * 2.1) * 0.06;
      const dz = Math.sin(t * 0.30 + i * 0.9) * 0.07;
      const anchor = base.clone().add(new THREE.Vector3(dx, dy, dz));

      const ws = workStates[cat.id];
      advanceState(ws, t, cat.id);
      const tSince = t - ws.stateStartTime;
      const floatOffset = computeFloatOffset(ws, tSince);
      const np = anchor.clone().add(floatOffset);
      tip.group.position.copy(np);

      const outwardBase = base.clone().normalize();
      const lookTarget = np.clone().add(outwardBase);
      tip.group.lookAt(lookTarget);
      tip.group.rotateZ(t * 0.05 + i * 0.3);

      const haloPulse = ws.state === 'working'
        ? 1.0 + Math.sin(t * 3.2 + i) * 0.18
        : 1.0 + Math.sin(t * 1.1 + i) * 0.07;
      tip.halo.scale.setScalar(haloPulse);
      tip.coreSphere.material.opacity = 0.7 + cat.freshness * 0.25 + voicePulse * 0.05 + (ws.state === 'working' ? 0.1 : 0);

      const leash = leashes[cat.id];
      const lpos = leash.geometry.attributes.position.array;
      lpos[0] = anchor.x; lpos[1] = anchor.y; lpos[2] = anchor.z;
      lpos[3] = np.x;     lpos[4] = np.y;     lpos[5] = np.z;
      leash.geometry.attributes.position.needsUpdate = true;
      if (ws.state === 'working') {
        leash.material.opacity = 0.32 + 0.28 * Math.abs(Math.sin(t * 5));
      } else if (ws.state === 'returning') {
        leash.material.opacity = 0.45 * (1 - Math.min(1, tSince / 1.6));
      } else {
        leash.material.opacity = 0;
      }
      lastTipPositions[cat.id] = np;
    });

    const arr = pollenGeom.attributes.position.array;
    for (let ci = 0; ci < cats.length; ci++) {
      const cat = cats[ci];
      const tipPos = lastTipPositions[cat.id];
      for (let i = 0; i < POLLEN_PER_CAT; i++) {
        const gi = ci * POLLEN_PER_CAT + i;
        const speed = pollenSpeed[gi];
        pollenTheta[gi] += 0.0025 * speed;
        pollenPhi[gi]   += Math.sin(t * 0.5 + pollenPhase[gi]) * 0.0006;
        const r  = pollenRadius[gi] + Math.sin(t * (0.8 + speed) + pollenPhase[gi]) * 0.07;
        const th = pollenTheta[gi];
        const ph = pollenPhi[gi];
        arr[gi*3]   = tipPos.x + Math.cos(th) * Math.cos(ph) * r;
        arr[gi*3+1] = tipPos.y + Math.sin(ph) * r;
        arr[gi*3+2] = tipPos.z + Math.sin(th) * Math.cos(ph) * r;
      }
    }
    pollenGeom.attributes.position.needsUpdate = true;
    pollenMat.uniforms.uTime.value = t;

    const ma = mistGeom.attributes.position.array;
    for (let i = 0; i < MIST_N; i++) {
      const v = mistVel[i];
      ma[i*3] += v[0]; ma[i*3+1] += v[1]; ma[i*3+2] += v[2];
      const R = 30;
      if (ma[i*3]   >  R)     ma[i*3]   = -R; if (ma[i*3]   < -R)     ma[i*3]   =  R;
      if (ma[i*3+1] >  R*0.7) ma[i*3+1] = -R*0.7; if (ma[i*3+1] < -R*0.7) ma[i*3+1] = R*0.7;
      if (ma[i*3+2] >  R)     ma[i*3+2] = -R; if (ma[i*3+2] < -R)     ma[i*3+2] =  R;
    }
    mistGeom.attributes.position.needsUpdate = true;
    mistMat.uniforms.uTime.value     = t;
    backdropMat.uniforms.uTime.value = t;

    const ox = Math.sin(t * 0.06) * 2.2 + Math.sin(t * 0.025) * 0.8;
    const oy = Math.sin(t * 0.05 + 1.0) * 0.55;
    const oz = Math.cos(t * 0.06) * 1.0 + Math.cos(t * 0.022) * 0.6;
    const desired = new THREE.Vector3(ox, 0.8 + oy, 15.5 + oz);
    desired.x += parallaxTarget.x * 0.8;
    desired.y += parallaxTarget.y * 0.5;
    if (!dragging) camera.position.lerp(desired, 0.012);
    camera.fov = 42 + Math.sin(t * 0.22) * 0.9;
    camera.updateProjectionMatrix();
    controls.update();
    finalPass.uniforms.uTime.value = t;
    hoverCtl.update();
    composer.render();
    labelRenderer.render(scene, camera);
  }
  animate();

  return {
    setWorkStates(next) {
      Object.keys(next).forEach(slug => {
        if (!workStates[slug]) return;
        const incomingState = next[slug].state;
        if (incomingState && incomingState !== workStates[slug].state) {
          if (incomingState === 'returning') {
            const tSince = clock.getElapsedTime() - workStates[slug].stateStartTime;
            workStates[slug].floatStartOffset.copy(computeFloatOffset(workStates[slug], tSince));
          }
          workStates[slug].state = incomingState;
          workStates[slug].stateStartTime = clock.getElapsedTime();
        }
      });
    },
    dispose() {
      hoverCtl.dispose();
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    },
  };
}
