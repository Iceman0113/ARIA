from fastapi.testclient import TestClient
from app import app


class FakeEngine:
    """Stub engine — no model download, deterministic output."""
    def __init__(self):
        self.voices = {"aria"}
        self.loaded = True

    def has_voice(self, voice_id):
        return voice_id in self.voices

    def list_voices(self):
        return sorted(self.voices)

    def register(self, voice_id, wav_bytes):
        self.voices.add(voice_id)

    def synthesize(self, text, voice_id):
        # 44-byte WAV header + 1 sample of silence — enough to assert "non-empty audio"
        return (b"RIFF$\x00\x00\x00WAVEfmt "
                b"\x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00"
                b"\x02\x00\x10\x00data\x00\x00\x00\x00")


def make_client():
    app.state.engine = FakeEngine()
    return TestClient(app)


def test_health_reports_loaded():
    client = make_client()
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "model_loaded": True, "voices": ["aria"]}
