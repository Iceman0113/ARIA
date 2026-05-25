import { useEffect, useRef } from 'react';

const STATE_COLORS = {
  sleeping:   { core: '#080415', mid: '#100828', glow: '#3322aa', ring: '#3322aa' },
  idle:       { core: '#1a0a4a', mid: '#2a1060', glow: '#6655ff', ring: '#6655ff' },
  listening:  { core: '#001a3a', mid: '#003060', glow: '#00aaff', ring: '#00ccff' },
  thinking:   { core: '#1a1000', mid: '#2a2000', glow: '#f0c040', ring: '#ffaa00' },
  speaking:   { core: '#001a12', mid: '#002a1e', glow: '#00d4aa', ring: '#00ffcc' },
  error:      { core: '#2a0010', mid: '#440020', glow: '#ff4466', ring: '#ff6688' },
};

const STATE_LABELS = {
  sleeping:  'say hey aria...',
  idle:      'tap to speak',
  listening: 'listening...',
  thinking:  'thinking...',
  speaking:  'speaking',
  error:     'error',
};

export default function Orb({ state, audioLevel = 0, onClick, disabled }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const levelRef = useRef(0);
  const frameRef = useRef(0);

  const colors = STATE_COLORS[state] || STATE_COLORS.idle;

  useEffect(() => { levelRef.current = audioLevel; }, [audioLevel]);

  // Canvas animations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const frame = ++frameRef.current;
      ctx.clearRect(0, 0, size, size);

      if (state === 'sleeping') {
        // Slow sonar rings — scans outward
        for (let i = 0; i < 2; i++) {
          const progress = ((frame * 0.3 + i * 45) % 90) / 90;
          const radius = 105 + progress * 50;
          const alpha = (1 - progress) * 0.25;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = colors.ring;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (state === 'listening') {
        const level = levelRef.current;
        for (let i = 0; i < 3; i++) {
          const progress = ((frame * 0.6 + i * 30) % 90) / 90;
          const radius = 110 + level * 30 + progress * 60;
          const alpha = (1 - progress) * 0.5 * (0.3 + level * 0.7);
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = colors.ring;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (state === 'thinking') {
        for (let i = 0; i < 3; i++) {
          const offset = (i / 3) * Math.PI * 2;
          const speed = 0.03 + i * 0.01;
          const start = frame * speed + offset;
          const sweep = 0.8 + Math.sin(frame * 0.05 + i) * 0.3;
          ctx.beginPath();
          ctx.arc(cx, cy, 118 + i * 6, start, start + sweep);
          ctx.strokeStyle = colors.ring;
          ctx.globalAlpha = 0.6 - i * 0.15;
          ctx.lineWidth = 2 - i * 0.3;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (state === 'speaking') {
        const numBars = 32;
        const r = 118;
        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
          const h = 4 + Math.sin(frame * 0.12 + i * 0.5) * 8 + Math.sin(frame * 0.07 + i) * 4;
          const x1 = cx + Math.cos(angle) * r;
          const y1 = cy + Math.sin(angle) * r;
          const x2 = cx + Math.cos(angle) * (r + h);
          const y2 = cy + Math.sin(angle) * (r + h);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = colors.ring;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [state, colors]);

  const orbAnimation = {
    sleeping:  'breathe 8s ease-in-out infinite',
    idle:      'breathe 4s ease-in-out infinite',
    listening: 'listen-pulse 0.8s ease-in-out infinite',
    thinking:  'none',
    speaking:  'listen-pulse 0.4s ease-in-out infinite',
    error:     'breathe 2s ease-in-out infinite',
  }[state] || 'breathe 4s ease-in-out infinite';

  const glowIntensity =
    state === 'sleeping' ? 0.15 :
    state === 'idle'     ? 0.3  :
    state === 'listening' ? 0.6 + (levelRef.current * 0.4) :
    0.7;

  const glowHex = (v) => Math.round(v * 99).toString(16).padStart(2, '0');
  const orbOpacity = state === 'sleeping' ? 0.6 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, userSelect: 'none' }}>
      <div style={{ position: 'relative', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        />

        {/* Outer glow */}
        <div style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          boxShadow: `0 0 60px ${colors.glow}${glowHex(glowIntensity)}`,
          transition: 'box-shadow 0.5s ease',
        }} />

        {/* Orb */}
        <button
          onClick={!disabled ? onClick : undefined}
          aria-label={STATE_LABELS[state]}
          style={{
            position: 'relative',
            width: 200,
            height: 200,
            borderRadius: '50%',
            border: `1px solid ${colors.glow}${glowHex(glowIntensity * 0.6)}`,
            background: `radial-gradient(circle at 35% 30%, ${colors.mid}, ${colors.core} 70%)`,
            boxShadow: [
              `0 0 40px ${colors.glow}${glowHex(glowIntensity * 0.6)}`,
              `0 0 80px ${colors.glow}${glowHex(glowIntensity * 0.3)}`,
              `inset 0 0 60px #00000055`,
              `inset 0 30px 60px ${colors.glow}18`,
            ].join(', '),
            opacity: orbOpacity,
            cursor: disabled ? 'not-allowed' : 'pointer',
            animation: orbAnimation,
            transition: 'background 0.5s ease, box-shadow 0.5s ease, opacity 0.5s ease',
            zIndex: 1,
            outline: 'none',
          }}
        >
          {/* Inner highlight */}
          <div style={{
            position: 'absolute',
            top: '18%', left: '22%',
            width: '40%', height: '28%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.glow}22, transparent)`,
          }} />

          {/* Icon */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(state === 'idle' || state === 'sleeping') && (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ opacity: state === 'sleeping' ? 0.4 : 0.8 }}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill={colors.glow} />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={colors.glow} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="22" stroke={colors.glow} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {state === 'listening' && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 32 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2,
                    background: colors.glow,
                    animation: `listen-pulse ${0.4 + i * 0.1}s ease-in-out ${i * 0.08}s infinite`,
                    minHeight: 4, maxHeight: 28,
                    height: 8 + i * 4,
                  }} />
                ))}
              </div>
            )}
            {state === 'thinking' && (
              <div style={{
                width: 32, height: 32,
                border: `2px solid ${colors.glow}44`,
                borderTop: `2px solid ${colors.glow}`,
                borderRadius: '50%',
                animation: 'think-spin 0.8s linear infinite',
              }} />
            )}
            {state === 'speaking' && (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill={colors.glow} fillOpacity="0.8" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Label */}
      <div style={{
        fontSize: 13,
        letterSpacing: state === 'sleeping' ? 2 : 3,
        color: state === 'idle' || state === 'sleeping' ? 'var(--text-faint)' : colors.glow,
        textTransform: 'uppercase',
        fontFamily: "'JetBrains Mono', monospace",
        transition: 'color 0.4s ease',
        minHeight: 20,
      }}>
        {STATE_LABELS[state]}
      </div>
    </div>
  );
}
