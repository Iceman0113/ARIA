import { useState, useRef } from 'react';

export default function TextInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Connecting…' : 'Type a message…'}
        style={{
          flex: 1,
          padding: '9px 14px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          color: disabled ? 'var(--text-faint)' : 'var(--text)',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: 'none',
          background: (disabled || !text.trim()) ? 'var(--surface2)' : 'var(--accent)',
          color: (disabled || !text.trim()) ? 'var(--text-faint)' : '#fff',
          cursor: (disabled || !text.trim()) ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s ease',
        }}
        aria-label="Send"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
