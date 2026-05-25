import { useState } from 'react';

export default function Setup({ onComplete }) {
  const [company, setCompany] = useState('');
  const [cofounderName, setCofounderName] = useState('ARIA');
  const [serverUrl, setServerUrl] = useState('ws://localhost:3001');
  const [businessDescription, setBusinessDescription] = useState('');

  const handleStart = () => {
    if (!company.trim()) return;
    onComplete({
      company: company.trim(),
      cofounderName: cofounderName.trim() || 'ARIA',
      serverUrl: serverUrl.trim() || 'ws://localhost:3001',
      businessDescription: businessDescription.trim(),
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      {/* Logo area */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #2a1060, #050508)',
          border: '1px solid #6655ff44',
          boxShadow: '0 0 40px #6655ff33',
          margin: '0 auto 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="#6655ff" fillOpacity="0.9" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#6655ff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
            <line x1="12" y1="19" x2="12" y2="22" stroke="#6655ff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
          </svg>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text)', letterSpacing: 6, marginBottom: 6 }}>
          ARIA
        </h1>
        <div style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          Adaptive Response &amp; Intelligence Architecture
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', maxWidth: 340, lineHeight: 1.6 }}>
          A partner with live access to your revenue, code, and customers. You talk. She watches.
        </p>
      </div>

      {/* Form */}
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <Field
          label="Company name"
          value={company}
          onChange={setCompany}
          placeholder="Acme Corp"
          autoFocus
        />
        <Field
          label="Co-founder name"
          value={cofounderName}
          onChange={setCofounderName}
          placeholder="ARIA"
          hint="Her name — ARIA by default, or make it your own."
        />
        <Field
          label="Server URL"
          value={serverUrl}
          onChange={setServerUrl}
          placeholder="ws://localhost:3001"
          hint="WebSocket endpoint for the backend server"
          monospace
        />
        <TextAreaField
          label="What does your firm do?"
          value={businessDescription}
          onChange={setBusinessDescription}
          placeholder="IT consulting, app development, digital transformation for mid-market clients..."
          hint="ARIA uses this to tailor her thinking to your business."
        />

        <div style={{ padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Before you start</div>
            <div>1. Copy <code style={{ color: 'var(--accent)', fontSize: 11 }}>apps/server/.env.example</code> to <code style={{ color: 'var(--accent)', fontSize: 11 }}>.env</code></div>
            <div>2. Add your <code style={{ color: 'var(--accent)', fontSize: 11 }}>ANTHROPIC_API_KEY</code></div>
            <div>3. Add Stripe, GitHub, Intercom keys</div>
            <div>4. Run <code style={{ color: 'var(--teal)', fontSize: 11 }}>npm run dev</code> in <code style={{ color: 'var(--teal)', fontSize: 11 }}>apps/server/</code></div>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!company.trim()}
          style={{
            padding: '14px 24px',
            borderRadius: 10,
            border: 'none',
            background: company.trim() ? 'var(--accent)' : 'var(--surface2)',
            color: company.trim() ? '#fff' : 'var(--text-faint)',
            fontSize: 15,
            fontWeight: 500,
            cursor: company.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
        >
          Launch ARIA
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-faint)' }}>
        No data is stored. All conversations stay local.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, hint, autoFocus, monospace }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          fontSize: 14,
          fontFamily: monospace ? "'JetBrains Mono', monospace" : 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          resize: 'vertical',
          transition: 'border-color 0.2s ease',
          boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
