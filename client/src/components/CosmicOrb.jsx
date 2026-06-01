import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

const COLOR_IDLE     = new THREE.Color('#2DD4A8');
const COLOR_THINKING = new THREE.Color('#8B5CF6');
const COLOR_SPEAKING = new THREE.Color('#E6FFFA');

const NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
`;

function NebulaLayer({ z, speed, scale, teal, purple, blue, intensity }) {
  const matRef = useRef();
  useFrame((s) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = s.clock.elapsedTime * speed;
    matRef.current.uniforms.uIntensity.value = intensity.current;
  });
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 0.3 },
    uScale: { value: scale },
    uTeal: { value: new THREE.Color(teal) },
    uPurple: { value: new THREE.Color(purple) },
    uBlue: { value: new THREE.Color(blue) },
  }), [scale, teal, purple, blue]);
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[180, 110]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform float uTime;
          uniform float uIntensity;
          uniform float uScale;
          uniform vec3 uTeal;
          uniform vec3 uPurple;
          uniform vec3 uBlue;
          varying vec2 vUv;
          ${NOISE_GLSL}
          void main() {
            vec2 p = (vUv - 0.5) * uScale + vec2(uTime * 0.04, uTime * 0.025);
            float n1 = fbm(p);
            float n2 = fbm(p * 1.7 + n1);
            float n3 = fbm(p * 0.55 - uTime * 0.012);
            vec3 col = mix(uBlue, uPurple, n2);
            col = mix(col, uTeal, smoothstep(0.45, 0.95, n1));
            float d = length(vUv - 0.5);
            float vignette = smoothstep(0.7, 0.05, d);
            float a = vignette * n3 * (0.35 + uIntensity * 0.55);
            gl_FragColor = vec4(col, a);
          }
        `}
      />
    </mesh>
  );
}

function HexGrid() {
  const matRef = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((s) => { if (matRef.current) matRef.current.uniforms.uTime.value = s.clock.elapsedTime; });
  return (
    <mesh position={[0, 0, -28]}>
      <planeGeometry args={[160, 100]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          varying vec2 vUv;
          float hexDist(vec2 p) {
            p = abs(p);
            return max(p.x * 0.866 + p.y * 0.5, p.y);
          }
          void main() {
            vec2 p = (vUv - 0.5) * 60.0;
            vec2 cell = vec2(1.5, 0.866);
            vec2 a = mod(p, cell) - cell * 0.5;
            vec2 b = mod(p + cell * 0.5, cell) - cell * 0.5;
            vec2 g = dot(a, a) < dot(b, b) ? a : b;
            float d = hexDist(g);
            float line = smoothstep(0.74, 0.75, d) - smoothstep(0.75, 0.76, d);
            float fade = smoothstep(0.7, 0.0, length(vUv - 0.5));
            gl_FragColor = vec4(vec3(0.18, 1.0, 0.85), line * 0.05 * fade);
          }
        `}
      />
    </mesh>
  );
}

const GLOW_VERT = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function glowFrag(power, alphaScale) {
  return `
    uniform vec3 uColor;
    uniform float uVoiceBright;
    uniform float uState;
    varying vec3 vNormal;
    void main() {
      float facing = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
      float rim = 1.0 - facing;
      float intensity = pow(rim, ${power.toFixed(2)});
      float bias = clamp(dot(vec3(-0.4, 0.55, 0.75), vNormal), -0.5, 1.0) * 0.5 + 0.5;
      float boost = 1.0 + uVoiceBright * 1.3 + uState * 0.25;
      float a = intensity * (0.45 + bias * 0.55) * boost * ${alphaScale.toFixed(2)};
      gl_FragColor = vec4(uColor * boost, a);
    }
  `;
}

function Orb({ uniforms }) {
  const groupRef = useRef();

  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    groupRef.current.position.x = Math.sin(t * 0.31) * 0.09 + Math.sin(t * 0.13) * 0.05;
    groupRef.current.position.y = Math.cos(t * 0.27) * 0.07 + Math.sin(t * 0.17) * 0.04;
    const state = uniforms.uState.value;
    const idleBreath = (Math.sin(t * (2.0 * Math.PI / 4.0)) + Math.sin(t * (2.0 * Math.PI / 6.3))) * 0.5;
    const breath = (1.0 - state) * idleBreath * 0.05 + uniforms.uVoiceBright.value * 0.14 + state * 0.02;
    groupRef.current.scale.setScalar(1.0 + breath);
  });

  return (
    <group ref={groupRef}>
      {/* Wide atmospheric bloom shell */}
      <mesh>
        <sphereGeometry args={[2.6, 48, 48]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={GLOW_VERT}
          fragmentShader={glowFrag(2.6, 0.9)}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Medium halo */}
      <mesh>
        <sphereGeometry args={[1.55, 48, 48]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={GLOW_VERT}
          fragmentShader={glowFrag(1.5, 1.4)}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Bright inner core */}
      <mesh>
        <sphereGeometry args={[0.85, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={GLOW_VERT}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uVoiceBright;
            uniform float uState;
            varying vec3 vNormal;
            void main() {
              float facing = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
              float bias = clamp(dot(vec3(-0.4, 0.55, 0.75), vNormal), 0.0, 1.0);
              float core = pow(facing, 0.7);
              float rimGlow = pow(1.0 - facing, 3.0);
              float bright = 1.0 + uVoiceBright * 1.6 + uState * 0.45;
              vec3 col = uColor * (0.55 + bias * 0.55) * bright;
              float a = core * 0.95 + rimGlow * 0.55;
              gl_FragColor = vec4(col, a);
            }
          `}
        />
      </mesh>
    </group>
  );
}

function ParticleRing({ uniforms }) {
  const ref = useRef();
  const COUNT = 120;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    const R = 3.3;
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
      const r = R + (Math.random() - 0.5) * 0.5;
      positions[i*3 + 0] = Math.cos(a) * r;
      positions[i*3 + 1] = (Math.random() - 0.5) * 0.12;
      positions[i*3 + 2] = Math.sin(a) * r;
      phases[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return g;
  }, []);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: uniforms.uColor,
      uVoiceBright: uniforms.uVoiceBright,
      uTime: uniforms.uTime,
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPhase;
      varying float vPhase;
      uniform float uTime;
      void main() {
        vPhase = aPhase;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.8 + 1.6 * sin(uTime * 1.7 + aPhase * 6.28)) * (55.0 / -mv.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uVoiceBright;
      varying float vPhase;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * (1.0 + uVoiceBright * 0.9), a * 0.85);
      }
    `,
  }), [uniforms]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const state = uniforms.uState.value;
    const thinkingBoost = 1.0 - Math.min(1.0, Math.abs(state - 0.5) * 2.0);
    ref.current.rotation.y += dt * (0.08 + thinkingBoost * 0.09 + uniforms.uVoiceBright.value * 0.05);
  });

  return (
    <group rotation={[Math.PI * 0.22, 0, Math.PI * 0.08]}>
      <points ref={ref} geometry={geom} material={mat} />
    </group>
  );
}

function SceneController({ uniforms, uStateTarget, voiceIntensityRef, nebulaIntensity }) {
  const tmpColor = useMemo(() => new THREE.Color(), []);
  useFrame((s, dt) => {
    uniforms.uTime.value = s.clock.elapsedTime;
    const k = 1.0 - Math.exp(-dt / 0.3);
    uniforms.uState.value += (uStateTarget - uniforms.uState.value) * k;
    const targetVB = voiceIntensityRef?.current ?? 0;
    uniforms.uVoiceBright.value += (targetVB - uniforms.uVoiceBright.value) * k;

    const state = uniforms.uState.value;
    if (state <= 0.5) tmpColor.copy(COLOR_IDLE).lerp(COLOR_THINKING, state / 0.5);
    else             tmpColor.copy(COLOR_THINKING).lerp(COLOR_SPEAKING, (state - 0.5) / 0.5);
    uniforms.uColor.value.copy(tmpColor);

    const nebTarget = 0.55 + state * 0.45 + uniforms.uVoiceBright.value * 0.35;
    nebulaIntensity.current += (nebTarget - nebulaIntensity.current) * k;
  });
  return null;
}

export default function CosmicOrb({ uStateTarget = 0.0, voiceIntensityRef, dim = false }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uState: { value: uStateTarget },
    uVoiceBright: { value: 0 },
    uColor: { value: new THREE.Color('#2DD4A8') },
  }), []);
  const nebulaIntensity = useMemo(() => ({ current: 0.3 }), []);

  // Some environments (e.g. embedded iframes that resize after mount) leave R3F's
  // ResizeObserver stuck on the initial container size — nudge it on mount.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(fire, 50);
    const t2 = setTimeout(fire, 250);
    const t3 = setTimeout(fire, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        opacity: dim ? 0.55 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      <color attach="background" args={['#0E0F13']} />
      <SceneController
        uniforms={uniforms}
        uStateTarget={uStateTarget}
        voiceIntensityRef={voiceIntensityRef}
        nebulaIntensity={nebulaIntensity}
      />

      <NebulaLayer z={-32} speed={0.15} scale={3.5} teal="#1B7A6E" purple="#5A248C" blue="#143A6B" intensity={nebulaIntensity} />
      <NebulaLayer z={-18} speed={0.30} scale={5.5} teal="#2BA395" purple="#7A36D6" blue="#1E5A9C" intensity={nebulaIntensity} />
      <HexGrid />
      <Stars radius={80} depth={40} count={2400} factor={3.2} saturation={0} fade speed={0.6} />

      <ParticleRing uniforms={uniforms} />
      <Orb uniforms={uniforms} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.8} luminanceThreshold={0.15} luminanceSmoothing={0.7} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
