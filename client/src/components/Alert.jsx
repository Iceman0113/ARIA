import { useState } from 'react';

const SEVERITY_STYLES = {
  critical: { color: '#ff4466', bg: 'rgba(255,68,102,0.08)', border: 'rgba(255,68,102,0.3)', icon: '🚨' },
  warning:  { color: '#ffaa00', bg: 'rgba(255,170,0,0.08)',  border: 'rgba(255,170,0,0.3)',  icon: '⚠️' },
  info:     { color: '#00aaff', bg: 'rgba(0,170,255,0.08)',  border: 'rgba(0,170,255,0.3)',  icon: '📡' },
};

export default function AlertFeed({ alerts, onDismiss }) {
  if (!alerts.length) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      right: 16,
      width: 320,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      {alerts.slice(0, 4).map(alert => (
        <AlertCard key={alert.id} alert={alert} onDismiss={() => onDismiss(alert.id)} />
      ))}
    </div>
  );
}

function AlertCard({ alert, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      onClick={dismiss}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderLeft: `3px solid ${style.color}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        pointerEvents: 'all',
        animation: 'alert-slide 0.3s ease forwards',
        transition: 'opacity 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: style.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
            {alert.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            {alert.body}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
            {new Date(alert.timestamp).toLocaleTimeString()} · click to dismiss
          </div>
        </div>
      </div>
    </div>
  );
}
