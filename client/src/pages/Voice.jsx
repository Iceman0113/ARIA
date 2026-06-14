import { useEffect, useState, useCallback, useRef } from 'react';
import { voice as voiceEngine } from '../Voice.js';

const PREVIEW_LINE = 'Hi, this is your cofounder. Bridge target: eleven thousand dollars per month.';

// serverUrl is the ws:// URL from config; HTTP calls reuse the same origin.
function httpBase(serverUrl) {
  return (serverUrl || '').replace(/^ws/, 'http');
}

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
    <div className="voice-page">
      <h2>Voice</h2>
      <p className="muted">Upload a short, clean clip (6–15s). ARIA will speak in that voice.</p>

      <div className="voice-upload">
        <input
          type="text"
          placeholder="Voice name (e.g. ARIA)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input ref={fileRef} type="file" accept="audio/*" />
        <button type="button" onClick={upload} disabled={busy}>
          {busy ? 'Working…' : 'Upload clip'}
        </button>
        <button type="button" onClick={preview} disabled={busy}>Preview active</button>
      </div>

      {error && <div className="voice-error">{error}</div>}

      <ul className="voice-list">
        {voices.map((v) => (
          <li key={v.voice_id} className={v.voice_id === active ? 'active' : ''}>
            <span className="voice-name">{v.name}</span>
            {v.voice_id === active
              ? <span className="voice-badge">active</span>
              : <button type="button" onClick={() => makeActive(v.voice_id)} disabled={busy}>Set active</button>}
            <button type="button" onClick={() => remove(v.voice_id)} disabled={busy}>Delete</button>
          </li>
        ))}
        {voices.length === 0 && <li className="muted">No cloned voices yet — upload one above.</li>}
      </ul>
    </div>
  );
}
