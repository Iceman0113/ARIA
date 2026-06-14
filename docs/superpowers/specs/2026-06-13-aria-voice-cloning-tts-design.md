# ARIA Self-Hosted Voice Cloning (TTS) — Design

**Date:** 2026-06-13
**Status:** Approved (brainstorming → spec)
**Author:** Randy + Claude

## Goal

Give ARIA a self-hosted, **zero-shot voice-cloning** TTS: provide a short reference
clip of a voice and ARIA speaks any text in that voice. No third-party TTS service,
no per-use cost. Include an in-app way to upload/change the voice profile, and build
the subsystem so it stays usable when ARIA is later ported to a phone app that
integrates with the Mac or a VPS.

## Context (current state)

- TTS today runs **in-process in the Node server** via `msedge-tts` (Microsoft Edge
  neural voices), returning MP3 blobs from `POST /speak`. Default voice
  `en-GB-SoniaNeural`. See `server/src/index.js` (~line 243+).
- The React client (`client/src/Voice.js`) already has a **sentence-chunked streaming
  pipeline**: it splits replies into sentences, fetches `/speak` per chunk, and
  overlaps fetch+playback. Fallback chain today: server `/speak` → browser Web Speech.
- Deployed via `docker-compose` (Node server + nginx client) on a VPS, but **primary
  usage is local on the Mac in dev mode** (`npm run dev` for server + client).
- Hardware target: **Apple M5 MacBook Air, 16GB**, Apple Silicon GPU (Metal/MPS).

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Local Mac GPU | User runs ARIA locally; near real-time on M-series |
| Model | **XTTS-v2** (Coqui community fork `coqui-tts`) | Native streaming inference → lowest time-to-first-sound; fits existing chunk pipeline; proven zero-shot cloning from ~6s reference |
| Containerization | **Native (NOT Docker)** for the TTS service | Docker on macOS has no Metal/GPU access — would force slow CPU inference |
| Client changes | **None to the speak path** | `/speak` contract (text→audio blob) preserved; client untouched for playback |
| Voice count | One active voice now, `voice_id`-addressable | Single voice MVP; per-agent voices later = just more clips, no rebuild |
| Clip storage | **Supabase Storage** (source of truth) + local cache | Voices survive moving server Mac↔VPS and stay consistent across phone/devices |
| Output format | WAV (MVP) | Browsers play WAV fine over localhost; MP3 encoding deferred |

## Architecture

```
Browser / future phone app
        │  /speak, /voices*           (clients ONLY ever talk to ARIA's server)
        ▼
ARIA Node server (server/src/index.js)
        │  HTTP via CLONE_TTS_URL
        ▼
Python TTS microservice (tts-service/, native on host)
        │
        ▼
XTTS-v2 on MPS  ◀── reference clip (cached from Supabase Storage)
```

**Portability principle:** clients only know ARIA's server. The TTS engine's location
is a single server-side config var, `CLONE_TTS_URL`. This is what makes the phone port
and any future relocation trivial:

| Topology | `CLONE_TTS_URL` |
|---|---|
| All local on Mac (MVP) | `http://localhost:8020` |
| Phone app → server on Mac (same Wi-Fi) | Mac LAN IP |
| Server on VPS, GPU on Mac | Tailscale/cloudflared address for the Mac |
| Full GPU-VPS route | GPU box private address |

The phone app needs **no voice-specific code** — it's just another client of the same
server endpoints.

## Components

### 1. Python TTS microservice — `tts-service/` (new top-level dir, native)

- `app.py` — FastAPI:
  - `POST /synthesize {text, voice_id?}` → WAV bytes. `voice_id` optional (caller may
    pin a voice); the *active* voice is resolved by the Node server, not here.
  - `POST /voices {voice_id, clip}` (or `/reload`) — register/normalize a new reference
    clip and (re)compute its speaker latents.
  - `GET /voices` — list known voice_ids.
  - `GET /health` — readiness (model loaded?).
- `engine.py` — XTTS-v2 wrapper:
  - Load model once at startup (~2GB) on MPS (CPU fallback).
  - **Cache speaker latents per `voice_id`** so they are not recomputed each request.
  - Synthesize behind an **internal async lock** (one GPU → one synth at a time).
  - **Pre-warm** on boot (mirrors existing Edge pre-warm) to avoid first-call stall.
- `scripts/prepare_clip.sh` — ffmpeg helper (also invoked server-side): any input →
  clean mono WAV, trim silence, clamp to ~6–15s.
- `requirements.txt`, `README.md` (venv + model download + run instructions).
- `voices/` — local cache dir for reference clips pulled from Supabase Storage.

### 2. Node server voice subsystem — `server/src/`

- New env: `TTS_PROVIDER=clone` (vs current implicit `edge`), `CLONE_TTS_URL`,
  `CLONE_TTS_TIMEOUT_MS`.
- `POST /speak` branches: when provider is `clone`, resolve **active voice_id**, POST to
  `${CLONE_TTS_URL}/synthesize`. **On any error/timeout → fall through to the existing
  Edge TTS path unchanged.** Edge code stays as the safety net.
- Voice management endpoints (proxy + persistence):
  - `POST /voices` — multipart upload. Server normalizes via ffmpeg, uploads the clean
    WAV to **Supabase Storage**, registers it with the Python service, returns `voice_id`.
  - `GET /voices` — list (from Supabase / Python service).
  - `POST /voices/active {voice_id}` — persist active voice (Supabase settings row).
  - `DELETE /voices/:id` — remove clip + dereference.
- Persistence uses existing `server/src/supabase.js` (`getSupabase()`, `getTenantId()`).
- The Python service stays Supabase-free. Instead of a startup sync, Node **lazily
  rehydrates** it: on an `UnknownVoiceError` (engine restarted / cold cache), Node fetches
  the clip from Supabase Storage, re-registers it with the Python service, and retries
  once. This keeps the engine a portable, credential-free unit (see also the Boot note).

### 3. Client — Voice settings tab — `client/src/`

- A **Voice tab/panel** in the console:
  - Drag-or-pick a clip → name it → upload (`POST /voices`) → appears in a list.
  - Select which voice is **active** (`POST /voices/active`).
  - **Preview** button: speaks a fixed sample line so the user hears the clone before
    committing.
- The speak/playback path in `Voice.js` is **unchanged**; it just gets the active
  cloned voice transparently from `/speak`.

## Data flow

**Speak:** client splits reply → per-sentence `POST /speak` → Node resolves active voice
→ `POST /synthesize` to Python → WAV → client overlaps fetch+play (existing pipeline).
Failure at any step degrades: clone → Edge → browser TTS.

**Upload:** Voice tab → `POST /voices` (multipart) → Node ffmpeg-normalizes → Supabase
Storage upload → register with Python service (compute latents) → returns `voice_id` →
tab refreshes list.

**Boot:** Python service loads the XTTS model and pre-warms. Its `voices/` cache starts
empty after a restart; the first `/speak` for the active voice triggers Node's lazy
rehydrate (fetch clip from Supabase → re-register → retry), so no startup Supabase sync
is needed.

## Error handling & fallback

Three-tier degrade, prepending clone to the existing chain:

1. Clone service (`/synthesize`) — primary.
2. Edge TTS (`msedge-tts`, in-process) — on clone error/timeout/down.
3. Browser Web Speech — on server failure (already present client-side).

Unknown `voice_id` → 404 from Python; Node falls back to Edge for that request rather
than failing the reply.

## Testing

- **Python:** `/synthesize` returns non-empty WAV for sample text + bundled tiny
  reference clip; unknown `voice_id` → 404; `/health` reflects model-loaded state.
- **Node** (existing vitest + supertest): `/speak` proxies to clone when
  `TTS_PROVIDER=clone` (clone URL mocked) and **falls back to Edge when clone errors**;
  upload→normalize→list round-trip; `POST /voices/active` changes what `/speak` requests;
  Supabase Storage mocked.
- **Live:** generate a sample from a real reference clip and listen before declaring done.

## Run story (local MVP — 3 processes)

- `tts-service`: `python app.py` (native venv, port 8020)
- `server`: `npm run dev`
- `client`: `npm run dev`

README + a convenience script document launching all three. `docker-compose` documents
the Python service as **host-run, not a container** (GPU reason).

## Out of scope (YAGNI / follow-ons)

- In-browser **mic recording** ("record 10s here") — MVP is file upload only.
- Automatic **per-agent voice assignment** for the 6 cosmic agents (the `voice_id`
  plumbing makes it easy later).
- **True token-level audio streaming** end-to-end (MVP uses sentence chunks).
- Building the **phone app** itself — we only make the server *ready* for it.
- **GPU-cloud deployment** — supported by `CLONE_TTS_URL` but not set up here.

## Legal note

Only clone voices the user has the right to use (own voice, or with explicit consent).
