// Always-on wake word detection using continuous SpeechRecognition.
// Listens quietly for trigger phrases, calls onWake(afterText) when detected.
// afterText is whatever was said in the same breath after the phrase —
// "Hey ARIA what's our MRR?" fires with afterText = "what's our MRR?"

const PHRASES = ['hey aria', 'hey, aria', 'ok aria', 'okay aria'];

class WakeWordDetector {
  constructor() {
    this.isActive = false;
    this._recognition = null;
    this._restartTimer = null;
    this._onWake = null;
    this._onPermissionDenied = null;
  }

  get supported() {
    return typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(onWake, onPermissionDenied) {
    if (this.isActive) return;
    this._onWake = onWake;
    this._onPermissionDenied = onPermissionDenied;
    this.isActive = true;
    this._spawn();
  }

  stop() {
    this.isActive = false;
    clearTimeout(this._restartTimer);
    if (this._recognition) {
      try { this._recognition.stop(); } catch {}
      this._recognition = null;
    }
  }

  _spawn() {
    if (!this.isActive) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    this._recognition = r;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.toLowerCase().trim();
        for (const phrase of PHRASES) {
          const idx = text.indexOf(phrase);
          if (idx !== -1) {
            const afterText = text.slice(idx + phrase.length).trim();
            // Mark as handled so onend doesn't restart
            this.isActive = false;
            this._recognition = null;
            try { r.stop(); } catch {}
            this._onWake?.(afterText);
            return;
          }
        }
      }
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed') {
        this.isActive = false;
        this._onPermissionDenied?.();
      }
      // network/no-speech/aborted → let onend handle the restart
    };

    r.onend = () => {
      clearTimeout(this._restartTimer);
      if (this.isActive) {
        // Normal end (silence timeout, network blip) — restart quietly
        this._restartTimer = setTimeout(() => this._spawn(), 200);
      }
    };

    try { r.start(); } catch {}
  }
}

export const wakeWord = new WakeWordDetector();
