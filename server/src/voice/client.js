const BASE = process.env.CLONE_TTS_URL || 'http://localhost:8020';
const TIMEOUT_MS = Number(process.env.CLONE_TTS_TIMEOUT_MS || 20000);

export class UnknownVoiceError extends Error {
  constructor(voiceId) {
    super(`clone service does not have voice '${voiceId}'`);
    this.name = 'UnknownVoiceError';
    this.voiceId = voiceId;
  }
}

function withTimeout() {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

export async function synthesizeClone(text, voiceId) {
  const t = withTimeout();
  try {
    const res = await fetch(`${BASE}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voiceId }),
      signal: t.signal,
    });
    if (res.status === 404) throw new UnknownVoiceError(voiceId);
    if (!res.ok) throw new Error(`clone synth failed: ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    t.clear();
  }
}

export async function registerVoice(voiceId, wavBuffer) {
  const t = withTimeout();
  try {
    const res = await fetch(`${BASE}/voices/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wavBuffer,
      signal: t.signal,
    });
    if (!res.ok) throw new Error(`clone register failed: ${res.status}`);
    return res.json();
  } finally {
    t.clear();
  }
}
