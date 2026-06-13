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
        if voice_id not in self.voices:
            raise KeyError(voice_id)
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


def test_list_voices():
    client = make_client()
    res = client.get("/voices")
    assert res.status_code == 200
    assert res.json() == {"voices": ["aria"]}


def test_register_voice_adds_it():
    client = make_client()
    res = client.post(
        "/voices/echo",
        content=b"RIFFfake",
        headers={"Content-Type": "audio/wav"},
    )
    assert res.status_code == 200
    assert "echo" in res.json()["voices"]


def test_synthesize_returns_wav():
    client = make_client()
    res = client.post("/synthesize", json={"text": "hello", "voice_id": "aria"})
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/wav"
    assert res.content[:4] == b"RIFF"
    assert len(res.content) > 0


def test_synthesize_unknown_voice_404():
    client = make_client()
    res = client.post("/synthesize", json={"text": "hi", "voice_id": "nope"})
    assert res.status_code == 404
