import { useEffect, useState, useCallback, useRef } from 'react';
import { voice as voiceEngine } from '../Voice.js';

const PREVIEW_LINE = 'Hi, this is your cofounder. Bridge target: eleven thousand dollars per month.';

// serverUrl is the ws:// URL from config; HTTP calls reuse the same origin.
function httpBase(serverUrl) {
  return (serverUrl || '').replace(/^ws/, 'http');
}

/* ── Presentational sub-components ── */

function WaveMotif() {
  // Decorative static CSS waveform bars
  const heights = [30, 55, 75, 45, 90, 60, 80, 40, 65, 50, 85, 35, 70, 55, 40];
  return (
    <div className="voice-wave" aria-hidden="true">
      {heights.map((h, i) => (
        <span key={i} className="voice-wave-bar" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function ActiveVoiceHero({ active, voices, onPreview }) {
  const activeVoice = active ? voices.find((v) => v.voice_id === active) : null;

  if (!activeVoice) {
    return (
      <div className="voice-hero voice-hero--empty">
        <span className="voice-hero-empty-text">No active voice yet — set one below.</span>
      </div>
    );
  }

  return (
    <div className="voice-hero">
      <div className="voice-hero-left">
        <div className="voice-hero-orb" aria-hidden="true" />
        <div className="voice-hero-meta">
          <span className="voice-hero-name">{activeVoice.name}</span>
          <span className="pill pill--active">active</span>
        </div>
      </div>
      <WaveMotif />
      <button type="button" className="btn btn--teal" onClick={onPreview}>
        ▶ Preview
      </button>
    </div>
  );
}

function VoiceRow({ voice, isActive, onSetActive, onRemove, busy }) {
  return (
    <div className={`voice-row${isActive ? ' voice-row--active' : ''}`}>
      <div className="voice-row-orb" aria-hidden="true" />
      <span className="voice-row-name">{voice.name}</span>
      <div className="voice-row-actions">
        {isActive
          ? <span className="pill pill--active">active</span>
          : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onSetActive(voice.voice_id)}
              disabled={busy}
            >
              Set active
            </button>
          )}
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => onRemove(voice.voice_id)}
          disabled={busy}
          aria-label={`Delete ${voice.name}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function UploadCard({ name, setName, fileRef, onUpload, busy }) {
  return (
    <div className="voice-upload">
      <div className="voice-upload-header">
        <span className="voice-upload-title">Upload Voice Clip</span>
        <span className="voice-upload-hint">6–15 s, clean audio works best</span>
      </div>
      <div className="voice-upload-fields">
        <input
          type="text"
          className="voice-input"
          placeholder="Voice name (e.g. ARIA)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="voice-file-input"
        />
      </div>
      <button
        type="button"
        className="btn btn--teal voice-upload-btn"
        onClick={onUpload}
        disabled={busy}
      >
        {busy ? 'Working…' : 'Upload clip'}
      </button>
    </div>
  );
}

/* ── Page component — all state + handlers stay here ── */

export default function Voice({ serverUrl }) {
  const [voices, setVoices] = useState([]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const fileRef = useRef(null);
  const base = httpBase(serverUrl);

  const hydrate = useCallback(async () => {
    try {
      const res = await fetch(`${base}/voices`);
      const data = await res.json();
      setVoices(data.voices || []);
      setActive(data.active || null);
    } catch (err) { setError(err.message); }
  }, [base]);

  useEffect(() => { hydrate(); }, [hydrate]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Pick an audio clip first'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${base}/voices?name=${encodeURIComponent(name || file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      setName(''); if (fileRef.current) fileRef.current.value = '';
      await hydrate();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function makeActive(voiceId) {
    setBusy(true); setError(null);
    try {
      await fetch(`${base}/voices/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: voiceId }),
      });
      await hydrate();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function remove(voiceId) {
    setBusy(true); setError(null);
    try {
      await fetch(`${base}/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE' });
      await hydrate();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function preview() {
    voiceEngine.speakWithServer(PREVIEW_LINE, serverUrl, {});
  }

  return (
    <div className="cosmic-root" style={{ height: 'auto', minHeight: '100%', overflow: 'auto' }}>
      <div className="voice-page">
        <div className="glass voice-panel">

          {/* Header */}
          <div className="voice-panel-header">
            <h2 className="voice-panel-title">Voice</h2>
            <p className="voice-panel-sub">ARIA speaks in your active voice.</p>
          </div>

          {/* Active voice hero */}
          <ActiveVoiceHero active={active} voices={voices} onPreview={preview} />

          {/* Voice list */}
          <div className="voice-list">
            {voices.length === 0
              ? <div className="voice-row voice-row--empty">No cloned voices yet — upload one below.</div>
              : voices.map((v) => (
                <VoiceRow
                  key={v.voice_id}
                  voice={v}
                  isActive={v.voice_id === active}
                  onSetActive={makeActive}
                  onRemove={remove}
                  busy={busy}
                />
              ))}
          </div>

          {/* Upload card */}
          <UploadCard
            name={name}
            setName={setName}
            fileRef={fileRef}
            onUpload={upload}
            busy={busy}
          />

          {/* Error line */}
          {error && <div className="voice-error">{error}</div>}

        </div>
      </div>
    </div>
  );
}
