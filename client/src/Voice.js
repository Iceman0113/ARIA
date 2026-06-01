// Voice engine: wraps Web Speech API for STT + ElevenLabs/browser TTS

class VoiceEngine {
  constructor() {
    this.recognition  = null;
    this.synthesis    = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.audioCtx     = null;
    this.analyser     = null;
    this.stream       = null;
    this.levelInterval = null;
    this._currentAudio = null;   // tracks playing ElevenLabs audio
    this.supported    = typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // ── STT ──────────────────────────────────────────────────────────

  init() {
    if (!this.supported) throw new Error('Speech recognition not supported in this browser. Try Chrome.');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous     = false;
    this.recognition.interimResults = true;
    this.recognition.lang           = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  async startListening({ onInterim, onFinal, onError, onEnd, onLevel }) {
    if (!this.recognition) this.init();

    if (onLevel) {
      try {
        this.stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioCtx = new AudioContext();
        const source  = this.audioCtx.createMediaStreamSource(this.stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        const buf = new Uint8Array(this.analyser.frequencyBinCount);
        this.levelInterval = setInterval(() => {
          this.analyser.getByteTimeDomainData(buf);
          const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length);
          onLevel(Math.min(1, rms / 30));
        }, 50);
      } catch {}
    }

    return new Promise((resolve) => {
      let finalText = '';

      this.recognition.onresult = (e) => {
        const result = e.results[e.results.length - 1];
        const text   = result[0].transcript;
        if (result.isFinal) { finalText = text; onFinal?.(text); }
        else                { onInterim?.(text); }
      };

      this.recognition.onerror = (e) => {
        if (e.error !== 'aborted') onError?.(e.error);
        resolve(finalText);
      };

      this.recognition.onend = () => {
        this.stopLevelMonitor();
        onEnd?.();
        resolve(finalText);
      };

      try { this.recognition.start(); } catch { resolve(''); }
    });
  }

  stopListening() {
    try { this.recognition?.stop(); } catch {}
    this.stopLevelMonitor();
  }

  stopLevelMonitor() {
    if (this.levelInterval) { clearInterval(this.levelInterval); this.levelInterval = null; }
    if (this.stream)        { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.audioCtx)      { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
  }

  // ── TTS — ElevenLabs via server proxy (preferred) ─────────────────

  _splitSentences(text) {
    const raw = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    const chunks = [];
    let buf = '';
    for (const s of raw) {
      buf += s;
      if (buf.trim().length >= 60) { chunks.push(buf.trim()); buf = ''; }
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks.length ? chunks : [text];
  }

  // ── Streaming TTS controller ──────────────────────────────────────
  // Push sentences as the agent emits them. Each push immediately starts a
  // fetch (parallel), while playback drains them in order. The fetch+play
  // pipelines overlap so by the time sentence N finishes playing, sentence
  // N+1's audio is already downloaded and ready.
  startStream(serverUrl, { onStart, onEnd, onError } = {}) {
    this.cancelSpeaking();
    this._abortController = new AbortController();
    const { signal } = this._abortController;
    const httpUrl = serverUrl.replace(/^ws/, 'http');

    const pipeline = [];        // [{ chunk, blobPromise }]  in-order
    let endRequested = false;
    let startEmitted = false;
    let endEmitted = false;
    let anyPlayed = false;
    let serverFailed = false;
    let wake = null;            // wakes the play loop when a new item is queued

    const emitEnd = () => {
      if (endEmitted) return;
      endEmitted = true;
      if (!signal.aborted) onEnd?.();
    };

    const fetchOne = async (chunk) => {
      try {
        const res = await fetch(`${httpUrl}/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk }),
          signal,
        });
        return res.ok ? await res.blob() : null;
      } catch { return null; }
    };

    // Play loop runs once for the lifetime of the stream.
    const playLoop = async () => {
      try {
        while (!signal.aborted) {
          if (pipeline.length === 0) {
            if (endRequested) break;
            await new Promise(resolve => { wake = resolve; });
            wake = null;
            continue;
          }
          const { chunk, blobPromise } = pipeline.shift();
          const blob = await blobPromise;
          if (signal.aborted) break;
          if (!blob) {
            serverFailed = true;
            if (!startEmitted) { startEmitted = true; onStart?.(); }
            await new Promise(resolve => this._browserSpeak(chunk, { onEnd: resolve }));
            continue;
          }
          if (!startEmitted) { startEmitted = true; onStart?.(); }
          const played = await this._playBlob(blob, signal);
          if (played) anyPlayed = true;
        }
      } finally {
        if (!anyPlayed && !serverFailed && !signal.aborted) onError?.();
        emitEnd();
      }
    };

    playLoop();

    return {
      push: (text) => {
        if (endRequested || signal.aborted) return;
        const t = (text || '').trim();
        if (!t) return;
        // Start the fetch RIGHT NOW; it races playback in the background.
        pipeline.push({ chunk: t, blobPromise: fetchOne(t) });
        if (wake) wake();
      },
      end: () => {
        if (endRequested) return;
        endRequested = true;
        if (wake) wake();
      },
      cancel: () => this.cancelSpeaking(),
      get aborted() { return signal.aborted; },
    };
  }

  async speakWithServer(text, serverUrl, { onStart, onEnd, onError } = {}) {
    if (!text?.trim()) { onEnd?.(); return; }
    this.cancelSpeaking();

    const httpUrl = serverUrl.replace(/^ws/, 'http');
    const sentences = this._splitSentences(text);

    this._abortController = new AbortController();
    const { signal } = this._abortController;

    const fetchChunk = async (chunk) => {
      try {
        const res = await fetch(`${httpUrl}/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk }),
          signal,
        });
        return res.ok ? res.blob() : null;
      } catch { return null; }
    };

    onStart?.();

    // Sequential fetch+play — free tier allows only 2 concurrent requests,
    // parallel firing blows past that limit immediately.
    try {
      let anyPlayed = false;
      for (const chunk of sentences) {
        if (signal.aborted) break;
        const blob = await fetchChunk(chunk);
        if (!blob || signal.aborted) continue;
        const played = await this._playBlob(blob, signal);
        if (played) anyPlayed = true;
      }
      if (!anyPlayed && !signal.aborted) {
        // ElevenLabs failed or blocked — fall back to browser TTS
        onError?.();
        await new Promise(resolve => this._browserSpeak(text, { onEnd: resolve }));
      }
    } catch {}

    if (!signal.aborted) onEnd?.();
  }

  _playBlob(blob, signal) {
    return new Promise((resolve) => {
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this._currentAudio = audio;

      let done = false;
      const cleanup = (played) => {
        if (done) return; done = true;
        URL.revokeObjectURL(url); this._currentAudio = null; resolve(played);
      };

      audio.onended = () => cleanup(true);
      audio.onerror = () => cleanup(false);
      signal?.addEventListener('abort', () => { audio.pause(); audio.src = ''; cleanup(false); }, { once: true });
      // play() rejects immediately if autoplay is blocked — treat as not-played so fallback fires
      audio.play().catch(() => cleanup(false));
    });
  }

  // ── TTS — Browser built-in (fallback) ─────────────────────────────

  _browserSpeak(text, { onWord, onEnd, onStart } = {}) {
    if (!this.synthesis) { onEnd?.(); return; }
    this.synthesis.cancel();

    const utterance  = new SpeechSynthesisUtterance(text);
    utterance.rate   = 1.05;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    const voices = this.synthesis.getVoices();

    // Voice selection order — biased toward British FEMALE voices for Randy.
    //   1. Explicit override from localStorage  → window.aria?.voice('<name>')
    //   2. Known en-GB female voices (Kate, Serena, Stephanie, Susan, Sandy, Tessa, Fiona, Moira)
    //   3. Any en-GB premium/enhanced voice
    //   4. Any en-GB voice
    //   5. Known en-US female voices (Samantha, Allison, Ava, Susan, Victoria)
    //   6. Any en voice
    const override = (typeof localStorage !== 'undefined' && localStorage.getItem('aria_voice_name')) || null;
    const findByName = (name) => voices.find(v => v.name === name || v.name.startsWith(name + ' '));

    const GB_FEMALE = ['Kate', 'Serena', 'Stephanie', 'Susan', 'Sandy', 'Tessa', 'Fiona', 'Moira', 'Martha'];
    const US_FEMALE = ['Samantha', 'Allison', 'Ava', 'Susan', 'Victoria', 'Karen', 'Joanna'];

    const findFirstByNameList = (names) => {
      for (const n of names) { const v = findByName(n); if (v) return v; }
      return null;
    };

    const preferred =
      (override && findByName(override)) ||
      findFirstByNameList(GB_FEMALE) ||
      voices.find(v => v.lang.startsWith('en-GB') && /Premium|Enhanced|Neural/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en-GB')) ||
      findFirstByNameList(US_FEMALE) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];

    if (preferred) {
      utterance.voice = preferred;
      // Make picks observable — easy to spot when something fell to a fallback.
      try { console.log('[aria voice]', preferred.name, '(' + preferred.lang + ')', override ? '[override]' : ''); } catch (e) {}
    }

    utterance.onstart = onStart;
    utterance.onword  = onWord;
    utterance.onend   = onEnd;
    utterance.onerror = () => onEnd?.();

    this.synthesis.speak(utterance);
    return utterance;
  }

  // Legacy method — kept so nothing breaks if called directly
  speak(text, callbacks = {}) {
    return this._browserSpeak(text, callbacks);
  }

  cancelSpeaking() {
    this.synthesis?.cancel();
    this._abortController?.abort();
    this._abortController = null;
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.src = '';
      this._currentAudio = null;
    }
  }

  get isSpeaking() {
    return (
      this.synthesis?.speaking ||
      (!!this._currentAudio && !this._currentAudio.paused)
    );
  }
}

export const voice = new VoiceEngine();

// Console helper: window.aria.voice('Daniel') | aria.voice.list() | aria.voice.reset()
if (typeof window !== 'undefined') {
  const synth = window.speechSynthesis;
  const setVoice = (name) => {
    if (!name) { console.warn('Usage: aria.voice("Kate")  or  aria.voice.list()'); return; }
    localStorage.setItem('aria_voice_name', name);
    const v = synth?.getVoices().find(v => v.name === name || v.name.startsWith(name + ' '));
    if (!v) { console.warn(`No voice named "${name}". Try aria.voice.list()`); return; }
    const u = new SpeechSynthesisUtterance(`Voice set to ${v.name}. Bridge target: eleven thousand dollars per month.`);
    u.voice = v; u.rate = 1.05;
    synth.cancel(); synth.speak(u);
    console.log(`✓ aria voice set to ${v.name} (${v.lang})`);
  };
  setVoice.list = () => {
    const all = synth?.getVoices() || [];
    const gb = all.filter(v => v.lang.startsWith('en-GB'));
    const en = all.filter(v => v.lang.startsWith('en') && !v.lang.startsWith('en-GB'));
    console.log('── en-GB ──'); gb.forEach(v => console.log(`  ${v.name}  [${v.lang}]${v.default ? ' (default)' : ''}`));
    console.log('── other English ──'); en.forEach(v => console.log(`  ${v.name}  [${v.lang}]`));
    return { gb: gb.map(v => v.name), en: en.map(v => v.name) };
  };
  setVoice.reset = () => { localStorage.removeItem('aria_voice_name'); console.log('✓ voice override cleared — falling back to Kate'); };
  window.aria = window.aria || {};
  window.aria.voice = setVoice;
}
