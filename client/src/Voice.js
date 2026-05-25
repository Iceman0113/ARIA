// Voice engine: wraps Web Speech API for STT + TTS

class VoiceEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.audioCtx = null;
    this.analyser = null;
    this.stream = null;
    this.levelInterval = null;
    this.supported = typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // ── STT ──────────────────────────────────────────────────────────

  init() {
    if (!this.supported) throw new Error('Speech recognition not supported in this browser. Try Chrome.');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  async startListening({ onInterim, onFinal, onError, onEnd, onLevel }) {
    if (!this.recognition) this.init();

    // Start audio level monitoring
    if (onLevel) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioCtx = new AudioContext();
        const source = this.audioCtx.createMediaStreamSource(this.stream);
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
        const text = result[0].transcript;
        if (result.isFinal) {
          finalText = text;
          onFinal?.(text);
        } else {
          onInterim?.(text);
        }
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

      try {
        this.recognition.start();
      } catch {
        resolve('');
      }
    });
  }

  stopListening() {
    try { this.recognition?.stop(); } catch {}
    this.stopLevelMonitor();
  }

  stopLevelMonitor() {
    if (this.levelInterval) { clearInterval(this.levelInterval); this.levelInterval = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.audioCtx) { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
  }

  // ── TTS ──────────────────────────────────────────────────────────

  speak(text, { onWord, onEnd, onStart } = {}) {
    if (!this.synthesis) return;
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick best available voice
    const voices = this.synthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Neural') || v.name.includes('Premium') || v.name.includes('Samantha') || v.name.includes('Google'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = onStart;
    utterance.onword = onWord;
    utterance.onend = onEnd;
    utterance.onerror = () => onEnd?.();

    this.synthesis.speak(utterance);
    return utterance;
  }

  cancelSpeaking() {
    this.synthesis?.cancel();
  }

  get isSpeaking() {
    return this.synthesis?.speaking || false;
  }
}

export const voice = new VoiceEngine();
