import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * createScene — mounts the ARIA cosmic luminous-orb scene into the given canvas.
 *
 * Ported from mockups/aria-cosmic/index.html initThree() (lines 444–656):
 *   - CDN THREE r128 globals → ESM three@0.174
 *   - Dropped: teal ring (ringTex + ring mesh), plasma energy core (NOISE_GLSL + coreUniforms + coreMat + coreSphere)
 *   - Kept: starfield, nebula sprites, atmos backlight, cosmic-orb image plane (orbMat luminance→alpha shader),
 *           red+teal halo (haloTex + halo mesh), corona rays, UnrealBloom
 *   - r128 → 0.174 API: outputEncoding/sRGBEncoding → outputColorSpace/SRGBColorSpace;
 *                        texture.encoding → texture.colorSpace
 *   - DOM reads replaced with locals + onStatus? callback
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ onStatus?: (status: 'speaking'|'listening'|'idle') => void }} [opts]
 * @returns {{ setSpeaking(sec?:number):void, setListening(on:boolean):void, setAmpDriver(fn:()=>number|null):void, resize():void, dispose():void }}
 */
export function createScene(canvas, { onStatus } = {}) {
  // ── Sizing helpers ───────────────────────────────────────────────
  function canvasW() { return canvas.clientWidth  || window.innerWidth;  }
  function canvasH() { return canvas.clientHeight || window.innerHeight; }

  // ── Texture tracking (GPU resource management) ───────────────────
  const textures = [];
  const trackTex = (t) => { textures.push(t); return t; };

  // ── Renderer ─────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  // Cap at 1.5 (not 2): on integrated GPUs the bloom pass at full 2x retina
  // density is the main source of choppiness; 1.5 nearly halves the pixel
  // count through render+bloom with little visible loss.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(canvasW(), canvasH(), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;          // r128: outputEncoding = sRGBEncoding
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(55, canvasW() / canvasH(), 0.1, 100);
  cam.position.z = 11;

  // ── Starfield ────────────────────────────────────────────────────
  const sg = new THREE.BufferGeometry();
  const N = 1300;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 55;
    pos[i * 3 + 2] = -Math.random() * 40 - 2;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    sg,
    new THREE.PointsMaterial({
      color: 0xbfe9dd,
      size: 0.07,
      map: trackTex(radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)')),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(stars);

  // ── Nebula clouds (additive sprites) ────────────────────────────
  const neb = [];
  [
    ['rgba(45,212,168,.55)', -6,  2, -12],
    ['rgba(124,108,230,.5)',  7, -3, -15],
    ['rgba(90,150,220,.45)',  2,  5, -18],
  ].forEach(([col, x, y, z]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshBasicMaterial({
        map: trackTex(radialTex(col, 'rgba(0,0,0,0)')),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.5,
      })
    );
    m.position.set(x, y, z);
    scene.add(m);
    neb.push(m);
  });

  // ── Atmos backlight (soft teal glow behind ARIA) ─────────────────
  const orb = new THREE.Group();
  scene.add(orb);
  const atmos = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15),
    new THREE.MeshBasicMaterial({
      map: trackTex(radialTex('rgba(45,212,168,.30)', 'rgba(0,0,0,0)')),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.8,
    })
  );
  atmos.position.z = -2;
  orb.add(atmos);

  // ── Corona rays ──────────────────────────────────────────────────
  const rayCount = 120, innerR = 2.35;
  const rayGeo = new THREE.BufferGeometry();
  const rayPos = new Float32Array(rayCount * 2 * 3);
  rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3));
  const rayMat = new THREE.LineBasicMaterial({
    color: 0xff1a2a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const corona = new THREE.LineSegments(rayGeo, rayMat);
  orb.add(corona);

  // ── Voice/speaking locals (no globals, no DOM) ───────────────────
  let speaking = false, speakEnd = 0, sAmp = 0, voiceBright = 0, voiceTarget = 0, ampGetter = null;

  // ── Cosmic ORB image (black bg → transparent via luminance alpha) ─
  const orbTex = trackTex(new THREE.TextureLoader().load('/models/cosmic-orb.png'));
  orbTex.colorSpace = THREE.SRGBColorSpace;                  // r128: encoding = sRGBEncoding
  const orbUniforms = { map: { value: orbTex }, uVoice: { value: 0 } };
  const orbMat = new THREE.ShaderMaterial({
    uniforms: orbUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float uVoice;
      varying vec2 vUv;
      void main(){
        vec4 c=texture2D(map,vUv);
        float lum=dot(c.rgb, vec3(0.299,0.587,0.114));
        float a=smoothstep(0.025,0.16,lum);
        gl_FragColor=vec4(c.rgb*(1.0+uVoice*0.6), a);
      }
    `,
  });
  const orbPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), orbMat);
  scene.add(orbPlane);

  // ── Red + teal halo ──────────────────────────────────────────────
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({
      map: trackTex(haloTex()),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 1,
    })
  );
  scene.add(halo);

  // ── UnrealBloom post-processing ──────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(canvasW(), canvasH()),
      0.35,  // strength
      0.5,   // radius
      0.93   // threshold — high so only glows bloom
    )
  );

  // ── Pointer parallax ─────────────────────────────────────────────
  let tpx = 0, tpy = 0, cpx = 0, cpy = 0;
  const onPointerMove = (e) => {
    tpx = (e.clientX / canvasW() - 0.5);
    tpy = (e.clientY / canvasH() - 0.5);
  };
  window.addEventListener('pointermove', onPointerMove);

  // ── Resize listener (declared before api so dispose() can reference it) ──
  const onResize = () => api.resize();
  window.addEventListener('resize', onResize);

  // ── Public API ───────────────────────────────────────────────────
  const api = {
    setSpeaking(sec = 4.5) {
      speaking = true;
      speakEnd = performance.now() + sec * 1000;
      onStatus?.('speaking');
    },
    setListening(on) {
      voiceTarget = on ? 0.9 : 0;
    },
    setAmpDriver(fn) {
      ampGetter = fn;
    },
    resize() {
      const w = canvasW(), h = canvasH();
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      composer.setSize(w, h);
    },
    dispose() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.dispose();
      composer.passes.forEach(p => p.dispose?.());
      composer.dispose();
      textures.forEach(t => t.dispose());
      scene.traverse(o => {
        o.geometry?.dispose?.();
        if (o.material) {
          const m = o.material;
          (Array.isArray(m) ? m : [m]).forEach(x => x.dispose?.());
        }
      });
    },
  };

  // ── Animation loop ───────────────────────────────────────────────
  const clock = new THREE.Clock();
  let lastT = 0;
  let rafId = 0;

  (function loop() {
    rafId = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    lastT = t;

    voiceBright += (voiceTarget - voiceBright) * 0.08;

    if (speaking && performance.now() > speakEnd) {
      speaking = false;
      onStatus?.(voiceTarget > 0 ? 'listening' : 'idle');
    }

    const speakTarget = speaking
      ? Math.max(0, 0.45 + 0.55 * (0.6 * Math.sin(t * 9.0) + 0.4 * Math.sin(t * 14.3 + 1.3)))
      : 0;

    // Allow external amplitude driver (P2 feeds real audio; P1 stays null)
    const ext = ampGetter ? ampGetter() : null;
    const target = (ext != null) ? ext : speakTarget;
    sAmp += (target - sAmp) * 0.25;

    const idle = 0.5 + Math.sin(t * (Math.PI * 2 / 4)) * 0.12;   // ~4s breathing
    const b = Math.min(1, idle + voiceBright * 0.9 + sAmp * 0.7);

    // Atmos backlight
    atmos.material.opacity = 0.22 + b * 0.4;
    const as = 1 + b * 0.12;
    atmos.scale.set(as, as, 1);
    atmos.quaternion.copy(cam.quaternion);

    // Corona rays
    for (let i = 0; i < rayCount; i++) {
      const ang = i / rayCount * Math.PI * 2;
      const flutter = 0.5 + 0.5 * Math.sin(t * 13 + i * 0.8) * Math.sin(t * 7.3 + i * 0.27);
      const len = innerR + (0.7 + flutter * 3.8) * sAmp;
      const o = i * 6;
      rayPos[o]     = Math.cos(ang) * innerR; rayPos[o + 1] = Math.sin(ang) * innerR; rayPos[o + 2] = 0;
      rayPos[o + 3] = Math.cos(ang) * len;    rayPos[o + 4] = Math.sin(ang) * len;    rayPos[o + 5] = 0;
    }
    rayGeo.attributes.position.needsUpdate = true;
    rayMat.opacity = Math.min(1, sAmp * 2.15);
    corona.rotation.z += 0.0025;

    // Cosmic orb image: slow swirl + breathing + voice brightness
    orbUniforms.uVoice.value = Math.min(1.0, Math.max(0.0, (b - 0.45)) * 0.4 + sAmp * 0.9);
    const orbScale = 0.9 + sAmp * 0.10;
    orbPlane.rotation.z += 0.0032;   // clearly-visible galaxy swirl
    orbPlane.scale.setScalar(orbScale);

    // Halo
    halo.material.opacity = Math.min(1, 0.9 + Math.max(0, (b - 0.5)) * 0.4 + sAmp * 0.6);
    halo.scale.setScalar(orbScale + 0.02 + sAmp * 0.04);
    halo.rotation.z -= 0.0006;

    // Stars
    stars.material.opacity = 0.7 + Math.sin(t * 1.3) * 0.15;

    // Nebula clouds
    neb.forEach((m, i) => {
      m.position.x += Math.sin(t * 0.05 + i) * 0.003;
      m.position.y += Math.cos(t * 0.04 + i) * 0.002;
      m.rotation.z = t * 0.01 * (i + 1) + Math.sin(t * 0.02);
    });

    // Pointer parallax camera drift
    cpx += (tpx - cpx) * 0.05;
    cpy += (tpy - cpy) * 0.05;
    cam.position.x = cpx * 1.3;
    cam.position.y = -cpy * 1.0;
    cam.lookAt(0, 0, 0);

    composer.render();
  })();

  return api;
}

// ── Texture helpers ───────────────────────────────────────────────

/** Radial canvas gradient texture: centre→edge colours. */
function radialTex(center, edge) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, center);
  grd.addColorStop(1, edge);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Red + teal ring halo texture matching the approved mockup. */
function haloTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.00, 'rgba(0,0,0,0)');
  grd.addColorStop(0.50, 'rgba(0,0,0,0)');
  grd.addColorStop(0.60, 'rgba(45,212,168,0.85)');   // teal inner edge
  grd.addColorStop(0.68, 'rgba(150,255,238,1.0)');   // bright blend
  grd.addColorStop(0.77, 'rgba(255,55,75,0.95)');    // red outer
  grd.addColorStop(0.88, 'rgba(255,30,50,0.45)');
  grd.addColorStop(1.00, 'rgba(255,30,50,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
