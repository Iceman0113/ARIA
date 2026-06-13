import io
import os
import threading

VOICES_DIR = os.path.join(os.path.dirname(__file__), "voices")


class XttsEngine:
    """Lazy XTTS-v2 wrapper. Model loads on first use; latents cached per voice."""

    def __init__(self, voices_dir=VOICES_DIR):
        self.voices_dir = voices_dir
        os.makedirs(self.voices_dir, exist_ok=True)
        self._tts = None
        self._latents = {}            # voice_id -> (gpt_cond_latent, speaker_embedding)
        self._lock = threading.Lock()  # one GPU -> one synth at a time
        self.loaded = False

    # -- model lifecycle ------------------------------------------------
    def load_model(self):
        if self._tts is not None:
            return
        import torch
        from TTS.api import TTS
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        self._tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        self.loaded = True

    def _clip_path(self, voice_id):
        return os.path.join(self.voices_dir, f"{voice_id}.wav")

    # -- voice management -----------------------------------------------
    def has_voice(self, voice_id):
        return os.path.exists(self._clip_path(voice_id))

    def list_voices(self):
        return sorted(
            f[:-4] for f in os.listdir(self.voices_dir) if f.endswith(".wav")
        )

    def register(self, voice_id, wav_bytes):
        with open(self._clip_path(voice_id), "wb") as fh:
            fh.write(wav_bytes)
        self._latents.pop(voice_id, None)  # force recompute on next synth

    def _ensure_latents(self, voice_id):
        if voice_id in self._latents:
            return self._latents[voice_id]
        self.load_model()
        gpt, spk = self._tts.synthesizer.tts_model.get_conditioning_latents(
            audio_path=[self._clip_path(voice_id)]
        )
        self._latents[voice_id] = (gpt, spk)
        return gpt, spk

    # -- synthesis ------------------------------------------------------
    def synthesize(self, text, voice_id):
        import soundfile as sf
        if not self.has_voice(voice_id):
            raise KeyError(voice_id)
        with self._lock:
            self.load_model()
            gpt, spk = self._ensure_latents(voice_id)
            out = self._tts.synthesizer.tts_model.inference(
                text, "en", gpt, spk, temperature=0.7
            )
            buf = io.BytesIO()
            sf.write(buf, out["wav"], 24000, format="WAV")
            return buf.getvalue()
