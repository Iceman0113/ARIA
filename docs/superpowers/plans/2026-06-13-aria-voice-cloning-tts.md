# ARIA Self-Hosted Voice Cloning (TTS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ARIA a self-hosted, zero-shot voice-cloning TTS — upload a short reference clip, ARIA speaks any text in that voice — with an in-app upload tab and an architecture that survives a later phone/VPS port.

**Architecture:** A native (non-Docker) Python FastAPI microservice wraps XTTS-v2 on the Mac's Metal GPU and exposes `/synthesize`, `/voices`, `/health`. ARIA's Node server proxies `POST /speak` to it via the single `CLONE_TTS_URL` config var, owns Supabase Storage for clip durability, and falls back to Edge TTS on any failure. A React "Voice" tab uploads clips and selects the active voice. Clients only ever talk to ARIA's server, so the future phone app needs no voice-specific code.

**Tech Stack:** Python 3.11 + FastAPI + `coqui-tts` (XTTS-v2) + soundfile; Node/Express + `@supabase/supabase-js` + vitest/supertest; React 19 + @testing-library/react; ffmpeg (host).

**Spec:** `docs/superpowers/specs/2026-06-13-aria-voice-cloning-tts-design.md`

---

## File Structure

**New — Python service (`tts-service/`, native, NOT containerized):**
- `tts-service/app.py` — FastAPI app: `/health`, `/voices`, `/voices/{voice_id}` (register), `/synthesize`. Reads `request.app.state.engine`.
- `tts-service/engine.py` — `XttsEngine`: lazy model load, latent cache per `voice_id`, `synthesize()`, `register()`, `has_voice()`, `list_voices()`. Designed for stub injection in tests.
- `tts-service/requirements.txt` — runtime deps.
- `tts-service/requirements-dev.txt` — `pytest`, `httpx`.
- `tts-service/tests/test_app.py` — FastAPI tests with a `FakeEngine` (no model download).
- `tts-service/voices/` — local clip cache (gitignored except `.gitkeep`).
- `tts-service/README.md` — venv + model + run instructions.

**New — Node voice subsystem (`server/src/voice/`):**
- `server/src/voice/storage.js` — Supabase Storage + tables: `uploadClip`, `getClip`, `listProfiles`, `deleteProfile`, `getActiveVoice`, `setActiveVoice`.
- `server/src/voice/client.js` — Python proxy: `synthesizeClone`, `registerVoice`, `CLONE_TTS_URL`.
- `server/src/voice/normalize.js` — `normalizeClip(inputBuffer)` → clean WAV buffer via ffmpeg.
- `server/src/voice/routes.js` — `mountVoiceRoutes(app)`.
- `server/src/test/voice-routes.test.js`, `server/src/test/voice-speak.test.js`, `server/src/test/voice-normalize.test.js`.

**Modified — Node:**
- `server/src/index.js` — branch `POST /speak` to clone-with-Edge-fallback; mount voice routes; boot log line.

**New/Modified — React client (`client/src/`):**
- `client/src/pages/Voice.jsx` — voice management tab (list, upload, set active, preview).
- `client/src/pages/Voice.test.jsx` — component test.
- `client/src/shell/NavChips.jsx` — add `voice` chip.
- `client/src/App.jsx` — render `<Voice/>` when `activeRoute === 'voice'`.

**New — DB:**
- `server/migrations/2026-06-13-voice.sql` — bucket + `voice_profiles` + `voice_settings`.

---

## PHASE 0 — Prerequisites (one-time, no tests)

### Task 0: Environment prep

**Files:** none (environment only)

- [ ] **Step 1: Install Python 3.11 (coqui-tts/PyTorch have no 3.14 wheels)**

Run:
```bash
brew install python@3.11 ffmpeg
/opt/homebrew/bin/python3.11 --version
```
Expected: `Python 3.11.x`. (ffmpeg already present at `/opt/homebrew/bin/ffmpeg` — install is a no-op confirmation.)

- [ ] **Step 2: Create the service venv**

Run:
```bash
cd ~/ARIA && mkdir -p tts-service && cd tts-service
/opt/homebrew/bin/python3.11 -m venv .venv
./.venv/bin/python --version
```
Expected: `Python 3.11.x`.

---

## PHASE 1 — Python TTS microservice

### Task 1: Scaffold service + `/health` (TDD)

**Files:**
- Create: `tts-service/requirements.txt`, `tts-service/requirements-dev.txt`, `tts-service/app.py`, `tts-service/engine.py`, `tts-service/tests/test_app.py`, `tts-service/voices/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Write requirements files**

`tts-service/requirements.txt`:
```
coqui-tts==0.25.1
soundfile==0.12.1
fastapi==0.115.6
uvicorn==0.34.0
python-multipart==0.0.20
```

`tts-service/requirements-dev.txt`:
```
-r requirements.txt
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Write the failing test for `/health`**

`tts-service/tests/test_app.py`:
```python
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/pip install -r requirements-dev.txt && ./.venv/bin/python -m pytest tests/test_app.py::test_health_reports_loaded -v`
Expected: FAIL — `ImportError` (no `app` / no `engine.py`). (The pip install also downloads torch/coqui — allow several minutes the first time.)

- [ ] **Step 4: Write minimal `engine.py`**

`tts-service/engine.py`:
```python
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
```

- [ ] **Step 5: Write minimal `app.py`**

`tts-service/app.py`:
```python
from fastapi import FastAPI, Request, Response, HTTPException
from pydantic import BaseModel
from engine import XttsEngine

app = FastAPI(title="ARIA TTS")
app.state.engine = XttsEngine()


def get_engine(request: Request):
    return request.app.state.engine


@app.get("/health")
def health(request: Request):
    eng = get_engine(request)
    return {"status": "ok", "model_loaded": eng.loaded, "voices": eng.list_voices()}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/python -m pytest tests/test_app.py::test_health_reports_loaded -v`
Expected: PASS.

- [ ] **Step 7: Add gitignore entries + .gitkeep**

Append to `.gitignore`:
```
tts-service/.venv/
tts-service/voices/*.wav
tts-service/__pycache__/
tts-service/**/__pycache__/
```
Create empty file `tts-service/voices/.gitkeep`.

- [ ] **Step 8: Commit**

```bash
cd ~/ARIA
git add tts-service/ .gitignore
git commit -m "feat(tts): scaffold XTTS voice-clone service with /health"
```

### Task 2: `/voices` register + list endpoints (TDD)

**Files:**
- Modify: `tts-service/app.py`
- Modify: `tts-service/tests/test_app.py`

- [ ] **Step 1: Write the failing tests**

Append to `tts-service/tests/test_app.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/python -m pytest tests/test_app.py -k "list_voices or register_voice" -v`
Expected: FAIL — 404 (routes not defined).

- [ ] **Step 3: Add the endpoints to `app.py`**

Append to `tts-service/app.py`:
```python
@app.get("/voices")
def list_voices(request: Request):
    return {"voices": get_engine(request).list_voices()}


@app.post("/voices/{voice_id}")
async def register_voice(voice_id: str, request: Request):
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty clip body")
    eng = get_engine(request)
    eng.register(voice_id, body)
    return {"voices": eng.list_voices()}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/python -m pytest tests/test_app.py -k "list_voices or register_voice" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add tts-service/app.py tts-service/tests/test_app.py
git commit -m "feat(tts): add /voices register + list endpoints"
```

### Task 3: `/synthesize` endpoint (TDD)

**Files:**
- Modify: `tts-service/app.py`
- Modify: `tts-service/tests/test_app.py`

- [ ] **Step 1: Write the failing tests**

Append to `tts-service/tests/test_app.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/python -m pytest tests/test_app.py -k synthesize -v`
Expected: FAIL — 404 on the first test (route not defined).

- [ ] **Step 3: Add the endpoint to `app.py`**

Add to `tts-service/app.py` (the `SynthesizeRequest` model near the top imports, the route at the bottom):
```python
class SynthesizeRequest(BaseModel):
    text: str
    voice_id: str = "aria"


@app.post("/synthesize")
def synthesize(req: SynthesizeRequest, request: Request):
    eng = get_engine(request)
    try:
        wav = eng.synthesize(req.text, req.voice_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown voice_id '{req.voice_id}'")
    return Response(content=wav, media_type="audio/wav")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/python -m pytest tests/test_app.py -v`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add tts-service/app.py tts-service/tests/test_app.py
git commit -m "feat(tts): add /synthesize endpoint (WAV out, 404 on unknown voice)"
```

### Task 4: Pre-warm on boot + README (no new tests)

**Files:**
- Modify: `tts-service/app.py`
- Create: `tts-service/README.md`

- [ ] **Step 1: Add startup pre-warm (loads model so first real `/synthesize` isn't slow)**

Add to `tts-service/app.py`:
```python
@app.on_event("startup")
def _prewarm():
    import os
    if os.environ.get("TTS_SKIP_PREWARM") == "1":
        return
    try:
        app.state.engine.load_model()
        print("TTS: XTTS-v2 model loaded")
    except Exception as exc:  # pragma: no cover - boot-time only
        print(f"TTS prewarm failed: {exc}")
```

- [ ] **Step 2: Write `tts-service/README.md`**

```markdown
# ARIA TTS service (XTTS-v2 voice cloning)

Native (NOT Docker — macOS Docker has no Metal GPU access).

## Setup
    brew install python@3.11 ffmpeg
    cd tts-service
    /opt/homebrew/bin/python3.11 -m venv .venv
    ./.venv/bin/pip install -r requirements.txt

First run downloads the XTTS-v2 model (~2GB) to ~/Library/Application Support/tts.

## Run
    ./.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8020

## Test (no model download)
    ./.venv/bin/pip install -r requirements-dev.txt
    TTS_SKIP_PREWARM=1 ./.venv/bin/python -m pytest -v
```

- [ ] **Step 3: Verify the service boots and serves (live, manual)**

Run: `cd ~/ARIA/tts-service && ./.venv/bin/pip install -r requirements.txt && ./.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8020`
Then in another shell: `curl -s localhost:8020/health`
Expected: `{"status":"ok","model_loaded":true,"voices":[]}` (voices empty until a clip is registered). Stop the server with Ctrl-C after confirming.

- [ ] **Step 4: Commit**

```bash
cd ~/ARIA
git add tts-service/app.py tts-service/README.md
git commit -m "feat(tts): pre-warm model on boot + service README"
```

---

## PHASE 2 — Node voice subsystem

### Task 5: ffmpeg clip normalizer (TDD)

**Files:**
- Create: `server/src/voice/normalize.js`, `server/src/test/voice-normalize.test.js`

- [ ] **Step 1: Write the failing test** (uses a real ffmpeg-generated tone — ffmpeg is installed)

`server/src/test/voice-normalize.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { normalizeClip } from '../voice/normalize.js';

// Generate a 3s 440Hz stereo MP3 in memory as the "uploaded" source.
function sampleMp3() {
  return execFileSync('ffmpeg', [
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-ac', '2', '-f', 'mp3', 'pipe:1',
  ], { maxBuffer: 1 << 24 });
}

describe('normalizeClip', () => {
  it('returns a mono 24kHz WAV buffer', async () => {
    const out = await normalizeClip(sampleMp3());
    expect(out.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(out.subarray(8, 12).toString('ascii')).toBe('WAVE');
    // num-channels field in the WAV fmt chunk (offset 22) must be 1 (mono)
    expect(out.readUInt16LE(22)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-normalize.test.js`
Expected: FAIL — cannot import `normalizeClip`.

- [ ] **Step 3: Write `server/src/voice/normalize.js`**

```javascript
import { spawn } from 'node:child_process';

// Normalize any uploaded audio into the clip XTTS wants: mono, 24kHz, <=15s,
// leading/trailing silence trimmed. Pipes through ffmpeg with no temp files.
export function normalizeClip(inputBuffer) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ac', '1',
      '-ar', '24000',
      '-t', '15',
      '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:stop_periods=1:stop_threshold=-50dB',
      '-f', 'wav', 'pipe:1',
    ];
    const ff = spawn('ffmpeg', args);
    const chunks = [];
    const errChunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => errChunks.push(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(errChunks)}`));
      resolve(Buffer.concat(chunks));
    });
    ff.stdin.on('error', () => {}); // ignore EPIPE if ffmpeg rejects input early
    ff.stdin.write(inputBuffer);
    ff.stdin.end();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-normalize.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add server/src/voice/normalize.js server/src/test/voice-normalize.test.js
git commit -m "feat(voice): ffmpeg clip normalizer (mono/24kHz/trim)"
```

### Task 6: Supabase storage layer (TDD)

**Files:**
- Create: `server/src/voice/storage.js`, `server/src/test/voice-storage.test.js`

- [ ] **Step 1: Write the failing test** (Supabase fully mocked — no network)

`server/src/test/voice-storage.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { rows: [], settings: {}, files: {} };

vi.mock('../supabase.js', () => ({
  getTenantId: async () => 'tenant-1',
  getSupabase: () => ({
    storage: {
      from: () => ({
        upload: async (path, buf) => { state.files[path] = buf; return { error: null }; },
        download: async (path) => ({ data: { arrayBuffer: async () => state.files[path] }, error: null }),
        remove: async (paths) => { paths.forEach(p => delete state.files[p]); return { error: null }; },
      }),
    },
    from: (table) => ({
      upsert: async (row) => {
        if (table === 'voice_settings') state.settings[row.tenant_id] = row.active_voice_id;
        else state.rows.push(row);
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          // voice_profiles list
          order: async () => ({ data: state.rows, error: null }),
          // voice_settings single
          maybeSingle: async () => ({
            data: state.settings['tenant-1'] ? { active_voice_id: state.settings['tenant-1'] } : null,
            error: null,
          }),
        }),
      }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }),
}));

import { uploadClip, listProfiles, getActiveVoice, setActiveVoice } from '../voice/storage.js';

beforeEach(() => { state.rows = []; state.settings = {}; state.files = {}; });

describe('voice storage', () => {
  it('uploads a clip and lists the profile', async () => {
    await uploadClip('echo', 'Echo', Buffer.from('RIFFfake'));
    const profiles = await listProfiles();
    expect(profiles.map(p => p.voice_id)).toContain('echo');
  });

  it('sets and gets the active voice', async () => {
    await setActiveVoice('echo');
    expect(await getActiveVoice()).toBe('echo');
  });

  it('returns null active voice when none set', async () => {
    expect(await getActiveVoice()).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-storage.test.js`
Expected: FAIL — cannot import from `../voice/storage.js`.

- [ ] **Step 3: Write `server/src/voice/storage.js`**

```javascript
import { getSupabase, getTenantId } from '../supabase.js';

const BUCKET = 'voice-clips';

function clipPath(tenantId, voiceId) {
  return `${tenantId}/${voiceId}.wav`;
}

export async function uploadClip(voiceId, name, wavBuffer) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');

  const path = clipPath(tenantId, voiceId);
  const up = await sb.storage.from(BUCKET).upload(path, wavBuffer, {
    contentType: 'audio/wav',
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);

  const row = await sb.from('voice_profiles').upsert({
    tenant_id: tenantId,
    voice_id: voiceId,
    name,
    storage_path: path,
  });
  if (row.error) throw new Error(row.error.message);
  return { voice_id: voiceId, name };
}

export async function listProfiles() {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) return [];
  const { data, error } = await sb
    .from('voice_profiles')
    .select('voice_id,name,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getClip(voiceId) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');
  const { data, error } = await sb.storage.from(BUCKET).download(clipPath(tenantId, voiceId));
  if (error) throw new Error(error.message);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteProfile(voiceId) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');
  await sb.storage.from(BUCKET).remove([clipPath(tenantId, voiceId)]);
  await sb.from('voice_profiles').delete().eq('tenant_id', tenantId).eq('voice_id', voiceId);
}

export async function getActiveVoice() {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) return null;
  const { data } = await sb
    .from('voice_settings')
    .select('active_voice_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data?.active_voice_id || null;
}

export async function setActiveVoice(voiceId) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');
  const { error } = await sb
    .from('voice_settings')
    .upsert({ tenant_id: tenantId, active_voice_id: voiceId });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-storage.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add server/src/voice/storage.js server/src/test/voice-storage.test.js
git commit -m "feat(voice): Supabase storage layer for clips + active-voice setting"
```

### Task 7: Python proxy client (TDD)

**Files:**
- Create: `server/src/voice/client.js`, `server/src/test/voice-client.test.js`

- [ ] **Step 1: Write the failing test** (global `fetch` mocked)

`server/src/test/voice-client.test.js`:
```javascript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { synthesizeClone, registerVoice, UnknownVoiceError } from '../voice/client.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('voice client', () => {
  it('returns a Buffer of WAV bytes on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      arrayBuffer: async () => new TextEncoder().encode('RIFFdata').buffer,
    })));
    const buf = await synthesizeClone('hello', 'aria');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe('RIFF');
  });

  it('throws UnknownVoiceError on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => 'nope' })));
    await expect(synthesizeClone('hi', 'ghost')).rejects.toBeInstanceOf(UnknownVoiceError);
  });

  it('registerVoice POSTs clip bytes to the service', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ voices: ['aria'] }) }));
    vi.stubGlobal('fetch', fetchMock);
    await registerVoice('aria', Buffer.from('RIFFfake'));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/voices\/aria$/);
    expect(opts.method).toBe('POST');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-client.test.js`
Expected: FAIL — cannot import `../voice/client.js`.

- [ ] **Step 3: Write `server/src/voice/client.js`**

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-client.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add server/src/voice/client.js server/src/test/voice-client.test.js
git commit -m "feat(voice): Node->Python proxy client with timeout + UnknownVoiceError"
```

### Task 8: Voice management routes (TDD)

**Files:**
- Create: `server/src/voice/routes.js`, `server/src/test/voice-routes.test.js`

- [ ] **Step 1: Write the failing test** (storage + client mocked, supertest drives Express)

`server/src/test/voice-routes.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const store = { profiles: [], active: null };

vi.mock('../voice/storage.js', () => ({
  uploadClip: vi.fn(async (voiceId, name) => { store.profiles.push({ voice_id: voiceId, name }); return { voice_id: voiceId, name }; }),
  listProfiles: vi.fn(async () => store.profiles),
  deleteProfile: vi.fn(async (voiceId) => { store.profiles = store.profiles.filter(p => p.voice_id !== voiceId); }),
  getActiveVoice: vi.fn(async () => store.active),
  setActiveVoice: vi.fn(async (voiceId) => { store.active = voiceId; }),
  getClip: vi.fn(async () => Buffer.from('RIFFfake')),
}));
vi.mock('../voice/normalize.js', () => ({ normalizeClip: vi.fn(async (b) => Buffer.concat([Buffer.from('RIFF'), b])) }));
vi.mock('../voice/client.js', () => ({ registerVoice: vi.fn(async () => ({ voices: [] })), synthesizeClone: vi.fn(), UnknownVoiceError: class extends Error {} }));

import { mountVoiceRoutes } from '../voice/routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  mountVoiceRoutes(app);
  return app;
}

beforeEach(() => { store.profiles = []; store.active = null; });

describe('voice routes', () => {
  it('GET /voices returns profiles + active', async () => {
    store.profiles = [{ voice_id: 'aria', name: 'ARIA' }];
    store.active = 'aria';
    const res = await request(makeApp()).get('/voices');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ voices: [{ voice_id: 'aria', name: 'ARIA' }], active: 'aria' });
  });

  it('POST /voices uploads, normalizes, registers, returns voice_id', async () => {
    const res = await request(makeApp())
      .post('/voices?name=Echo')
      .set('Content-Type', 'audio/mpeg')
      .send(Buffer.from('sourceaudio'));
    expect(res.status).toBe(200);
    expect(res.body.voice_id).toBe('echo');
    expect(store.profiles.map(p => p.voice_id)).toContain('echo');
  });

  it('POST /voices/active sets active voice', async () => {
    const res = await request(makeApp()).post('/voices/active').send({ voice_id: 'echo' });
    expect(res.status).toBe(200);
    expect(store.active).toBe('echo');
  });

  it('DELETE /voices/:id removes profile', async () => {
    store.profiles = [{ voice_id: 'echo', name: 'Echo' }];
    const res = await request(makeApp()).delete('/voices/echo');
    expect(res.status).toBe(200);
    expect(store.profiles).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-routes.test.js`
Expected: FAIL — cannot import `mountVoiceRoutes`.

- [ ] **Step 3: Write `server/src/voice/routes.js`**

```javascript
import express from 'express';
import { uploadClip, listProfiles, deleteProfile, getActiveVoice, setActiveVoice } from './storage.js';
import { normalizeClip } from './normalize.js';
import { registerVoice } from './client.js';

// Derive a filesystem/url-safe voice_id from a display name.
function slugify(name) {
  return String(name || 'voice')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'voice';
}

export function mountVoiceRoutes(app) {
  // GET /voices — list profiles + which one is active
  app.get('/voices', async (req, res) => {
    try {
      const [voices, active] = await Promise.all([listProfiles(), getActiveVoice()]);
      res.json({ voices, active });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /voices?name=Echo  — raw audio body (any format ffmpeg reads)
  app.post('/voices', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
    try {
      const name = String(req.query.name || 'Voice');
      const voiceId = slugify(name);
      if (!req.body || !req.body.length) return res.status(400).json({ error: 'empty upload' });
      const wav = await normalizeClip(req.body);
      await uploadClip(voiceId, name, wav);     // durable in Supabase
      await registerVoice(voiceId, wav);          // compute latents in Python now
      res.json({ voice_id: voiceId, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /voices/active  { voice_id }
  app.post('/voices/active', async (req, res) => {
    try {
      const { voice_id } = req.body || {};
      if (!voice_id) return res.status(400).json({ error: 'voice_id required' });
      await setActiveVoice(voice_id);
      res.json({ active: voice_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /voices/:id
  app.delete('/voices/:id', async (req, res) => {
    try {
      await deleteProfile(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-routes.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add server/src/voice/routes.js server/src/test/voice-routes.test.js
git commit -m "feat(voice): voice management routes (list/upload/active/delete)"
```

### Task 9: `/speak` clone branch with rehydrate + Edge fallback (TDD)

**Files:**
- Create: `server/src/voice/speak.js`, `server/src/test/voice-speak.test.js`
- Modify: `server/src/index.js`

This isolates the clone-or-fallback decision into a tested helper so `index.js` stays thin and the Edge code is untouched.

- [ ] **Step 1: Write the failing test**

`server/src/test/voice-speak.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = {
  getActiveVoice: vi.fn(),
  synthesizeClone: vi.fn(),
  registerVoice: vi.fn(),
  getClip: vi.fn(),
};
class UnknownVoiceError extends Error {}

vi.mock('../voice/storage.js', () => ({
  getActiveVoice: (...a) => mocks.getActiveVoice(...a),
  getClip: (...a) => mocks.getClip(...a),
}));
vi.mock('../voice/client.js', () => ({
  synthesizeClone: (...a) => mocks.synthesizeClone(...a),
  registerVoice: (...a) => mocks.registerVoice(...a),
  UnknownVoiceError,
}));

import { cloneSpeak } from '../voice/speak.js';

beforeEach(() => { Object.values(mocks).forEach(m => m.mockReset()); });

describe('cloneSpeak', () => {
  it('returns null when no active voice (caller falls back to Edge)', async () => {
    mocks.getActiveVoice.mockResolvedValue(null);
    expect(await cloneSpeak('hello')).toBe(null);
  });

  it('returns WAV buffer when active voice synthesizes', async () => {
    mocks.getActiveVoice.mockResolvedValue('aria');
    mocks.synthesizeClone.mockResolvedValue(Buffer.from('RIFFok'));
    const buf = await cloneSpeak('hello');
    expect(buf.toString()).toBe('RIFFok');
  });

  it('rehydrates from Supabase then retries on UnknownVoiceError', async () => {
    mocks.getActiveVoice.mockResolvedValue('aria');
    mocks.synthesizeClone
      .mockRejectedValueOnce(new UnknownVoiceError('aria'))
      .mockResolvedValueOnce(Buffer.from('RIFFafter'));
    mocks.getClip.mockResolvedValue(Buffer.from('RIFFclip'));
    mocks.registerVoice.mockResolvedValue({});
    const buf = await cloneSpeak('hello');
    expect(mocks.getClip).toHaveBeenCalledWith('aria');
    expect(mocks.registerVoice).toHaveBeenCalledWith('aria', expect.any(Buffer));
    expect(buf.toString()).toBe('RIFFafter');
  });

  it('returns null when clone service errors (caller falls back to Edge)', async () => {
    mocks.getActiveVoice.mockResolvedValue('aria');
    mocks.synthesizeClone.mockRejectedValue(new Error('connection refused'));
    expect(await cloneSpeak('hello')).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-speak.test.js`
Expected: FAIL — cannot import `cloneSpeak`.

- [ ] **Step 3: Write `server/src/voice/speak.js`**

```javascript
import { getActiveVoice, getClip } from './storage.js';
import { synthesizeClone, registerVoice, UnknownVoiceError } from './client.js';

// Returns a WAV Buffer for the active cloned voice, or null if cloning is
// unavailable/failed — in which case the caller falls back to Edge TTS.
// If the Python service was restarted and lost the voice, rehydrate it once
// from Supabase Storage and retry.
export async function cloneSpeak(text) {
  let voiceId;
  try {
    voiceId = await getActiveVoice();
  } catch {
    return null;
  }
  if (!voiceId) return null;

  try {
    return await synthesizeClone(text, voiceId);
  } catch (err) {
    if (err instanceof UnknownVoiceError) {
      try {
        const clip = await getClip(voiceId);
        await registerVoice(voiceId, clip);
        return await synthesizeClone(text, voiceId);
      } catch {
        return null;
      }
    }
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/server && npx vitest run src/test/voice-speak.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire `cloneSpeak` + voice routes into `index.js`**

In `server/src/index.js`, add imports after the existing factory imports (~line 18):
```javascript
import { mountVoiceRoutes } from './voice/routes.js';
import { cloneSpeak } from './voice/speak.js';
```

Mount voice routes next to the factory mount (~line 241, after `mountFactoryRoutes(app, broadcast);`):
```javascript
mountVoiceRoutes(app);
```

Replace the body of `app.post('/speak', ...)` (the handler at ~line 284) with the clone-first version. The Edge code is moved into an inline fallback; everything below `// EDGE FALLBACK` is the original logic unchanged:
```javascript
app.post('/speak', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  // Clone-first: use the active cloned voice when TTS_PROVIDER=clone.
  if (process.env.TTS_PROVIDER === 'clone') {
    try {
      const wav = await cloneSpeak(text);
      if (wav && wav.length) {
        res.set('Content-Type', 'audio/wav');
        res.set('Content-Length', wav.length);
        res.set('Cache-Control', 'no-store');
        return res.send(wav);
      }
    } catch (err) {
      console.error('Clone TTS error (falling back to Edge):', err.message);
    }
    // fall through to Edge fallback below
  }

  // EDGE FALLBACK ──────────────────────────────────────────────────
  const voice = process.env.EDGE_TTS_VOICE || 'en-GB-SoniaNeural';
  const myTurn = _ttsChain.then(async () => {
    const tts = await getEdgeTts(voice);
    return synthToBuffer(tts, text);
  });
  _ttsChain = myTurn.catch(() => {});

  try {
    const buffer = await myTurn;
    if (!buffer.length) return res.status(500).json({ error: 'Edge TTS returned no audio' });
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', buffer.length);
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    console.error('Edge TTS error:', err.message);
    _edgeTts = null; _edgeVoiceLoaded = null;
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Run the full server suite to confirm no regressions**

Run: `cd ~/ARIA/server && npx vitest run`
Expected: PASS — all suites, including the existing `smoke.test.js` and `neural-map.test.js`.

- [ ] **Step 7: Commit**

```bash
cd ~/ARIA
git add server/src/voice/speak.js server/src/test/voice-speak.test.js server/src/index.js
git commit -m "feat(voice): /speak clone branch with Supabase rehydrate + Edge fallback"
```

---

## PHASE 3 — React Voice tab

### Task 10: Add `voice` nav chip (TDD)

**Files:**
- Modify: `client/src/shell/NavChips.jsx`
- Modify: `client/src/shell/NavChips.test.jsx`

- [ ] **Step 1: Add the failing assertion**

Append a test to `client/src/shell/NavChips.test.jsx` (match the existing file's import style):
```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavChips from './NavChips.jsx';

describe('<NavChips> voice tab', () => {
  it('renders a Voice chip and fires onNav("voice")', () => {
    const onNav = vi.fn();
    render(<NavChips active="console" onNav={onNav} />);
    const chip = screen.getByRole('button', { name: /Voice/i });
    fireEvent.click(chip);
    expect(onNav).toHaveBeenCalledWith('voice');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/client && npx vitest run src/shell/NavChips.test.jsx`
Expected: FAIL — no button named "Voice".

- [ ] **Step 3: Add the chip to `NavChips.jsx`**

In `client/src/shell/NavChips.jsx`, add to the `ROUTES` array (after `factory`):
```javascript
  { id: 'voice',    label: 'Voice' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/client && npx vitest run src/shell/NavChips.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add client/src/shell/NavChips.jsx client/src/shell/NavChips.test.jsx
git commit -m "feat(client): add Voice nav chip"
```

### Task 11: Voice management page (TDD)

**Files:**
- Create: `client/src/pages/Voice.jsx`, `client/src/pages/Voice.test.jsx`

- [ ] **Step 1: Write the failing test** (`fetch` stubbed)

`client/src/pages/Voice.test.jsx`:
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Voice from './Voice.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).endsWith('/voices')) {
      return { ok: true, json: async () => ({ voices: [{ voice_id: 'aria', name: 'ARIA' }], active: 'aria' }) };
    }
    return { ok: true, json: async () => ({}) };
  }));
});
afterEach(() => vi.restoreAllMocks());

describe('<Voice>', () => {
  it('lists voices and marks the active one', async () => {
    render(<Voice serverUrl="ws://localhost:3001" />);
    await waitFor(() => expect(screen.getByText('ARIA')).toBeInTheDocument());
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ARIA/client && npx vitest run src/pages/Voice.test.jsx`
Expected: FAIL — cannot import `Voice.jsx`.

- [ ] **Step 3: Write `client/src/pages/Voice.jsx`**

```jsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/ARIA/client && npx vitest run src/pages/Voice.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/ARIA
git add client/src/pages/Voice.jsx client/src/pages/Voice.test.jsx
git commit -m "feat(client): Voice management page (upload/list/active/preview)"
```

### Task 12: Render Voice page in App (no new test — wiring)

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Import the page**

In `client/src/App.jsx`, add after the `Factory` import (~line 9):
```javascript
import Voice from './pages/Voice.jsx';
```

- [ ] **Step 2: Render it on the `voice` route**

In `client/src/App.jsx`, add after the `{activeRoute === 'factory' && <Factory ws={wsRef.current} />}` line (~line 369):
```jsx
      {activeRoute === 'voice' && <Voice serverUrl={config.serverUrl} />}
```

- [ ] **Step 3: Verify client suite + build**

Run: `cd ~/ARIA/client && npx vitest run && npm run build`
Expected: tests PASS; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd ~/ARIA
git add client/src/App.jsx
git commit -m "feat(client): wire Voice page into the voice route"
```

---

## PHASE 4 — Supabase schema, config, docs, live verification

### Task 13: Supabase migration + run docs

**Files:**
- Create: `server/migrations/2026-06-13-voice.sql`
- Modify: `server/.env.example`, `README.md`, `docker-compose.yml`

- [ ] **Step 1: Write the migration**

`server/migrations/2026-06-13-voice.sql`:
```sql
-- Voice-cloning storage + settings.
-- Run in the Supabase SQL editor (or psql) against the ARIA project.

-- 1. Private bucket for reference clips.
insert into storage.buckets (id, name, public)
values ('voice-clips', 'voice-clips', false)
on conflict (id) do nothing;

-- 2. Voice profiles (one row per cloned voice).
create table if not exists public.voice_profiles (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  voice_id     text not null,
  name         text not null,
  storage_path text not null,
  created_at   timestamptz not null default now(),
  primary key (tenant_id, voice_id)
);

-- 3. Active-voice selection (one row per tenant).
create table if not exists public.voice_settings (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  active_voice_id  text
);
```

- [ ] **Step 2: Apply the migration (manual)**

Open the Supabase SQL editor for the ARIA project, paste the file contents, run.
Expected: bucket + two tables created, no errors. Confirm under Storage → `voice-clips` exists and Table editor shows `voice_profiles` and `voice_settings`.

- [ ] **Step 3: Document env vars in `server/.env.example`**

Append:
```
# Voice cloning (self-hosted XTTS). Leave TTS_PROVIDER unset to use Edge TTS.
TTS_PROVIDER=clone
CLONE_TTS_URL=http://localhost:8020
CLONE_TTS_TIMEOUT_MS=20000
```

- [ ] **Step 4: Add a "Voice cloning" section to `README.md`**

Append:
```markdown
## Voice cloning (self-hosted)

ARIA can speak in a cloned voice via a local XTTS-v2 service (no third party).

Run three processes locally:

    # 1. TTS engine (native — NOT Docker; needs the Mac GPU)
    cd tts-service && ./.venv/bin/uvicorn app:app --port 8020
    # 2. server
    cd server && npm run dev
    # 3. client
    cd client && npm run dev

Set `TTS_PROVIDER=clone` in `server/.env`, open the **Voice** tab, upload a
6–15s clip, set it active, and hit **Preview**. If the engine is down, ARIA
automatically falls back to Edge TTS.

See `tts-service/README.md` for first-time setup (Python 3.11 venv + model download).
```

- [ ] **Step 5: Note the GPU caveat in `docker-compose.yml`**

Add a comment block at the top of `docker-compose.yml`:
```yaml
# NOTE: the voice-cloning TTS service (tts-service/) is intentionally NOT a
# compose service. Docker on macOS has no Metal/GPU access, so XTTS must run
# natively on the host. Reach it from the server via CLONE_TTS_URL.
```

- [ ] **Step 6: Commit**

```bash
cd ~/ARIA
git add server/migrations/2026-06-13-voice.sql server/.env.example README.md docker-compose.yml
git commit -m "chore(voice): Supabase migration, env vars, run docs"
```

### Task 14: Live end-to-end verification

**Files:** none (manual verification with real model + real clip)

- [ ] **Step 1: Record/grab a reference clip**

Get a 6–15s clean WAV/M4A/MP3 of the voice you have the right to clone (your own, or with consent). Save it anywhere accessible.

- [ ] **Step 2: Start all three processes**

In three shells:
```bash
cd ~/ARIA/tts-service && ./.venv/bin/uvicorn app:app --port 8020
cd ~/ARIA/server && TTS_PROVIDER=clone npm run dev
cd ~/ARIA/client && npm run dev
```
Expected: TTS logs "XTTS-v2 model loaded"; server logs Supabase ✓.

- [ ] **Step 3: Upload + activate via the Voice tab**

Open http://localhost:5174, go to **Voice**, name it "ARIA", choose your clip, **Upload clip**, then **Set active**.
Expected: the voice appears in the list with an "active" badge. Confirm in Supabase that `voice-clips/<tenant>/aria.wav` exists and `voice_settings.active_voice_id = 'aria'`.

- [ ] **Step 4: Hear it**

Click **Preview active**.
Expected: you hear the preview line spoken in the cloned voice (not the British Edge voice). Then send ARIA a normal chat message and confirm her spoken reply uses the cloned voice.

- [ ] **Step 5: Confirm fallback**

Stop the `tts-service` process (Ctrl-C). Send another chat message.
Expected: ARIA still speaks, now via Edge TTS (`en-GB-SoniaNeural`) — no error, graceful degrade. Restart the TTS service and confirm the cloned voice rehydrates from Supabase on the next reply (no re-upload needed).

- [ ] **Step 6: Run `graphify update .` to keep the knowledge graph current**

Run: `cd ~/ARIA && graphify update . 2>/dev/null || echo "graphify not available — skip"`

---

## Self-Review

**Spec coverage:**
- Local XTTS-v2 native service → Tasks 1–4. ✓
- Node `/speak` proxy + Edge fallback → Task 9. ✓
- `CLONE_TTS_URL` single-knob portability → Task 7 (client.js) + Task 13 (env). ✓
- Voice management API (list/upload/active/delete) → Task 8. ✓
- ffmpeg normalize server-side → Task 5. ✓
- Supabase Storage as source of truth + active-voice persistence → Task 6 + Task 13. ✓
- Rehydrate-on-restart (Python stays Supabase-free) → Task 9. ✓
- React Voice tab w/ upload + preview → Tasks 10–12. ✓
- Three-tier fallback (clone→Edge→browser) → Task 9 (clone→Edge); browser tier already in `Voice.js`. ✓
- Tests for upload round-trip, active-voice change, unknown voice 404, Supabase mocked → Tasks 6, 8, 9, 3. ✓
- Out-of-scope items (mic record, per-agent auto-assign, token streaming, phone app, GPU-cloud) correctly omitted. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type/name consistency:** `voice_id`/`name`/`active_voice_id` consistent across Python, storage.js, routes.js, SQL, and client. `synthesizeClone`/`registerVoice`/`UnknownVoiceError`/`cloneSpeak`/`normalizeClip`/`mountVoiceRoutes` names match across definitions and call sites. Python `register`/`has_voice`/`list_voices`/`synthesize` consistent between engine.py, app.py, and the FakeEngine stub. ✓

**Note on Python deps:** `coqui-tts` 0.25.x is the maintained community fork of Coqui TTS and exposes the same `TTS.api.TTS` import used in engine.py. If the exact pin is unavailable at build time, install the latest `coqui-tts` and pin whatever resolves — the `TTS.api` interface is stable. Python **3.11** is required (3.12+ wheels for torch/coqui lag; 3.14 has none).
