# ARIA — Master Context File
**Jack & Jewell Consulting LLC | Greenwood, Indiana**
*Paste this at the start of a new session to bring Claude up to speed instantly.*

---

## What ARIA Is

ARIA (Adaptive Reasoning & Intelligent Automation) is the AI co-founder and operating brain of Jack & Jewell Consulting LLC — Randy's IT managed services + AI consulting firm. It's a voice-first web app: Randy speaks to it, it responds with audio (Microsoft Edge Neural TTS — free, en-GB-SoniaNeural by default), and it has full access to business data, memory, and tools.

**Business context:**
- Side project transitioning to full-time MSP
- Immediate goal: $16,500 gross MRR (replaces Randy's $8,200/mo take-home + $2,800/mo insurance as sole proprietor)
- Bridge-to-full-time target displayed in HUD: $11,000/mo net
- North star: $1,000,000 ARR within 18–24 months of going full-time
- Currently: a few break-fix clients, no recurring revenue yet

**Service tiers:**
- Starter Managed IT: $750–$1,000/mo (up to 5 users)
- Standard Managed IT: $1,500–$2,500/mo (6–15 users)
- Growth Managed IT: $3,000–$5,000/mo (15+ users, AI/automation included)
- Break-fix to retainer converts: $600–$900/mo
- AI consulting projects: $2,500–$8,000 one-time

---

## Project Location

```
/Users/randyjewell/ARIA/
├── server/                   # Node.js/Express + WebSocket backend
│   ├── src/
│   │   ├── index.js          # Entry point, WS server, REST endpoints, ElevenLabs TTS proxy
│   │   ├── agent.js          # Claude claude-sonnet-4-6 agent loop, system prompt, session summarizer
│   │   ├── tools.js          # All 14 tool definitions + dispatchers (Stripe, Buffer, Serper, etc.)
│   │   ├── memory.js         # Supabase-backed persistent memory (JSON fallback)
│   │   ├── clients.js        # Supabase-backed client roster (JSON fallback)
│   │   ├── monitor.js        # Background cron: MRR checks every 15 min, Scout every 4 hours
│   │   ├── supabase.js       # Supabase client + tenant resolution
│   │   └── subagents/
│   │       ├── scout.js      # Web research sub-agent (Serper + Anthropic)
│   │       ├── hunter.js     # Lead generation sub-agent
│   │       ├── creative.js   # LinkedIn/ad content sub-agent
│   │       └── shared.js     # Shared sub-agent utilities
│   ├── schema.sql            # Supabase schema — run once in SQL editor to create tables
│   ├── .env                  # Live credentials (see env section below)
│   └── .env.example
└── client/                   # React + Vite frontend
    ├── index.html            # Loads Orbitron, Share Tech Mono, Rajdhani fonts
    ├── src/
    │   ├── App.jsx           # Full HUD layout + all state/WebSocket/voice logic (single file)
    │   ├── index.css         # HUD CSS — teal sci-fi theme, all animations, panel styles
    │   ├── Voice.js          # STT (Web Speech API) + TTS (ElevenLabs via server, sentence-streaming)
    │   ├── WakeWord.js       # Wake-word detection ("hey aria")
    │   └── components/
    │       ├── Setup.jsx     # First-run config screen (only component still in use)
    │       ├── Chat.jsx      # UNUSED — chat is now the Intel Feed panel
    │       ├── Dashboard.jsx # UNUSED — metrics are in HUD panels
    │       ├── Clients.jsx   # UNUSED — clients shown in left column
    │       ├── Memory.jsx    # UNUSED
    │       ├── Orb.jsx       # UNUSED — orb rebuilt inline in App.jsx
    │       ├── Alert.jsx     # UNUSED — alerts in Intel Feed
    │       └── TextInput.jsx # UNUSED — text input is in bottom bar
    └── vite.config.js
```

---

## How to Start

```bash
# Terminal 1 — backend
cd /Users/randyjewell/ARIA/server
npm run dev           # starts on :3001

# Terminal 2 — frontend
cd /Users/randyjewell/ARIA/client
npm run dev           # starts on :5174
```

Open `http://localhost:5174` in **Chrome** (Web Speech API requires Chrome/Edge).

First run shows a Setup screen — fill in company name, co-founder name, server URL (`ws://localhost:3001`), and business description, then click Launch ARIA.

**Port conflict note:** If :3001 is already in use (e.g. a stale background process), run:
```bash
lsof -ti :3001 | xargs kill -9
```

---

## UI — The HUD Dashboard

Full-screen sci-fi HUD. Teal-on-black terminal aesthetic. No chat bubbles.

**Layout (CSS Grid: 280px | 1fr | 280px / 48px | 1fr | 80px):**

| Zone | Content |
|---|---|
| Top bar | A.R.I.A. brand, WS status pill, clock + date (live), location, convo/wake toggles, reset |
| Left column | Client Status panel · Revenue Bridge panel · System Diagnostics panel |
| Center | Neural network canvas (bg) · ARIA orb with 4 spinning rings · voice waveform strip · mic button · CONVO MODE toggle button · power bar |
| Right column | Priority Tasks panel · ARIA Intel Feed panel · Operations panel |
| Bottom bar | Scrolling ticker (live MRR data) · TYPE COMMAND text input · timestamp |

**Key CSS variables** (`index.css`):
```css
--teal: #00E5CC         /* primary — everything interactive and healthy */
--teal-dim: #00A896
--teal-glow: rgba(0,229,204,0.15)
--amber: #FF9F1C        /* warning / pipeline items ONLY */
--red: #FF3B3B
--bg: #040C10           /* near-black background */
```

**Fonts:** Orbitron (headings/values) · Share Tech Mono (body) · Rajdhani (panel titles)

**Orb states** — CSS class `state-{orbState}` on both `.hud-root` and `.col-center` drives color shifts:
- `idle` → teal rings, "READY" label
- `listening` → bright cyan rings, pulsing core, mic button shows "LISTENING..."
- `thinking` → amber rings, rotating core animation
- `speaking` → teal rings, voice waveform strip visible
- `sleeping` → dim rings (always-on wake word mode)

**Canvas animations** (all `useEffect` + `requestAnimationFrame`, started on mount):
- `#neuralCanvas` — 72-node network with travelling pulse particles; fires bursts when voice is active
- `#voiceStrip` — frequency bar visualizer, opacity driven by `voiceIntensityRef`
- `#waveCanvas` — decorative sine wave in Operations panel

---

## App.jsx Architecture

All state, WebSocket, voice, and rendering live in one file (`App.jsx`). Key refs:

| Ref | Purpose |
|---|---|
| `voiceActiveRef` | Mirrors `orbState === 'listening' \| 'speaking'` — read by canvas loop without re-renders |
| `voiceIntensityRef` | Smooth 0→1 interpolation used by voice strip + neural canvas |
| `neuralCanvasRef` | Neural canvas DOM element |
| `voiceStripRef` | Voice waveform canvas DOM element |
| `waveCanvasRef` | Bottom wave canvas DOM element |
| `wsRef` | Live WebSocket connection |
| `historyRef` | Last 20 conversation turns (sent to server with each message) |
| `convoModeRef` | Mirrors `convoMode` state — read from callbacks without stale closure |
| `alwaysOnRef` | Mirrors `alwaysOn` state — same pattern |
| `startListeningRef` | Ref to `startListening` function — avoids circular dependency in `returnToBase` |

**Key state defaults:**
- `convoMode` defaults to ON — `useState(() => localStorage.getItem(CONVO_KEY) !== '0')`
- `alwaysOn` defaults to OFF — `useState(() => localStorage.getItem(ALWAYSON_KEY) === '1')`

**Data wired into HUD panels:**

| Panel | Data source |
|---|---|
| Client Status | `clients` state (WebSocket `{type:'clients'}` broadcast from server) |
| Revenue Bridge | `metrics` state — `metrics?.mrr?.grossMrr ?? metrics?.revenue?.mrr ?? metrics?.currentMrr ?? metrics?.current_mrr ?? 1950` |
| System Diag | Simulated via `setInterval` (cpu/ram/swap fluctuate randomly every 3s — not real system metrics) |
| ARIA Intel Feed | Merged `alerts` + last 4 `messages` reversed |
| Operations quick stats | Derived from `clients` + `metrics` |
| Ticker | Live `currentMrr` and `bridgePct` interpolated into text |

**MRR_TARGET in client = 11000 (net)** — the gross target ($16,500) lives in `server/.env` as `BRIDGE_MRR_TARGET`. This is intentional.

---

## How a Conversation Works

1. User speaks → Chrome Web Speech API (STT) → text sent over WebSocket to server
2. Server calls `runAgent()` in `agent.js` → Claude claude-sonnet-4-6 with full system prompt + memory
3. If Claude calls a tool, `tools.js` dispatches it (Stripe, Supabase, Serper, sub-agents, etc.)
4. Streamed tokens flow back over WebSocket as `{type:'token'}` events → displayed in streaming overlay + Intel Feed
5. On `{type:'done'}`, client sentence-splits response, fetches ElevenLabs TTS **sequentially** (free tier = 2 concurrent max)
6. Audio chunks play back-to-back as they arrive (sentence-streaming for low latency)
7. After speak completes, if Convo Mode is ON → auto-restarts listening (`returnToBase` → `startListening`)
8. When WS closes (≥4 messages), session is summarized by claude-haiku and stored in Supabase memory

**Monitor (background):**
- Every 15 minutes: checks MRR vs bridge target, revenue drops, at-risk clients
- Every 4 hours: Scout runs a competitive intelligence sweep
- Alerts broadcast to all connected clients as `{type:'alert'}` events → appear in Intel Feed

---

## Voice (Voice.js)

**STT:** Web Speech API — Chrome/Edge only. `continuous: false`, `interimResults: true`.

**TTS:** Microsoft Edge Neural TTS via server proxy (`POST /speak`). Free, no API key, no quota. Default voice `en-GB-SoniaNeural` (configurable via `EDGE_TTS_VOICE` in `server/.env`). Server uses the `msedge-tts` npm package over Edge's public WebSocket endpoint.

**Streaming TTS pipeline (the path that matters):**
1. Client opens a stream controller via `voice.startStream(serverUrl, { onEnd, onError })` as soon as Claude emits the first token.
2. App.jsx scans each `token` event for completed sentences (regex: `[.!?]+\s`) and pushes each one via `stream.push(sentence)`.
3. Each `push()` **immediately fires a `fetch('/speak')`** — fetches run in parallel; the controller's playback loop awaits the in-flight promises in submission order so audio plays sequentially without gaps.
4. On `done`, App.jsx pushes the tail (any non-terminated remainder) and calls `stream.end()`.

**Server `/speak` (`server/src/index.js`):**
- Single `MsEdgeTTS` instance cached per voice. Pre-warmed at boot (`getEdgeTts(...)` after `server.listen` callback) so first reply doesn't pay the ~2s `setMetadata` handshake.
- `_ttsChain = Promise.resolve()` serializes concurrent synth calls — one WebSocket can't multiplex synth requests safely.
- `escapeForSsml(text)` escapes `&`, `<`, `>`, `"`, `'` before handing off. **Without this, "Jack & Jewell" makes Edge return a 0-byte stream silently.**
- `synthToBuffer` collects the audio stream into a Buffer and `res.send(buffer)`. Streaming pipe was abandoned because each synth is fast (~100–300ms) and buffering is simpler.

**`_playBlob` returns a boolean:**
`true` if audio actually played, `false` if blocked/errored. The stream controller uses this to mark `serverFailed` and fall back to `_browserSpeak` for the failed chunk.

**Fallback:** If `/speak` returns 5xx, the controller calls `_browserSpeak(chunk)` (Mac SpeechSynthesis). On macOS the picker prefers known en-GB female names (Kate, Serena, Stephanie, Susan, Sandy, Tessa, Fiona, Moira, Martha), then any en-GB voice, then en-US females. Log `[aria voice] <name> (<lang>)` appears in DevTools every browser-TTS call. Console helpers: `aria.voice('Daniel')`, `aria.voice.list()`, `aria.voice.reset()`.

**Cancellation:** `cancelSpeaking()` calls `AbortController.abort()` → cascades to all in-flight fetches and stops the current `<Audio>`. `startStream` calls this on entry, so a new reply automatically pre-empts the previous one. `App.jsx` checks `ttsStreamRef.current.aborted` and recreates the controller if the previous one was cancelled.

**ElevenLabs:** Free-tier quota exhausted as of 2026-05-28 (0/10K credits remaining). `ELEVENLABS_API_KEY=` is empty in `.env` (key is preserved as a `#`-prefixed line directly above for easy restoration after monthly reset or upgrade). The endpoint code path was removed entirely — Edge TTS replaces it. To switch back to ElevenLabs, revert the `/speak` rewrite.

**Performance after streaming TTS + pre-warm + parallel fetch (measured):**
- Time-to-first-audio: ~5.7s after submit (was 7–8s)
- Gap between sentences in a reply: ~0s (was 5–13s)
- First-call `/speak` latency: ~770ms warm (was ~2000ms cold; was ~135ms after pre-warm hits a previous synth)
- Per-sentence synth: ~100–300ms via Edge TTS

---

## Agent (agent.js)

**Lazy Anthropic client:**
```js
let _client = null;
const getClient = () => {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
};
```
This is critical. Without it, the client was created at module load time before dotenv had run, so `apiKey` would be `undefined`.

**System prompt** is rebuilt every turn via `buildSystemPrompt()`. It includes:
- Full ARIA persona (snarky co-founder, voice-first, 4-sentence max unless asked for detail)
- Business context + financial targets
- Service menu + operating mandate
- Communication rules
- Memory block from Supabase (appended at end)

**Tool loop:** Max 10 iterations. Runs until `stop_reason !== 'tool_use'`, then streams tokens word-by-word with 15ms delay between words.

**Silent tools** (no `tool_call`/`tool_result` UI events): `save_to_memory`, `update_client`

**Session summarizer:** After WS disconnect with ≥4 messages, `summarizeSession()` runs — uses claude-haiku to produce a 1–2 sentence summary + key points array, stored in Supabase memory.

---

## Server (index.js) — Critical Fixes Applied

**dotenv override:**
```js
import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
```
Claude Code injects `ANTHROPIC_API_KEY=''` (empty string) into process env. Without `override: true`, dotenv silently skips the real key from `.env`. This was the root cause of ARIA never responding.

**WebSocket message listener registered before async calls:**
```js
wss.on('connection', async (ws) => {
  connectedClients.add(ws);
  sessionLogs.set(ws, []);

  // Register FIRST — before any async calls so no messages are dropped
  ws.on('message', async (raw) => { ... });

  // Async initial data pushes come AFTER listener is registered
  try { const metrics = await getAllMetrics(); ... } catch {}
  ...
});
```
Without this ordering, messages sent within the first few seconds of connection (while initial data was being fetched from Supabase) were silently dropped.

**REST endpoints:**
- `GET /health`
- `GET /memory` · `DELETE /memory/:key`
- `GET /clients` · `POST /clients` · `DELETE /clients/:id`
- `POST /speak` — ElevenLabs TTS proxy (keeps API key server-side)

---

## Environment Variables (`server/.env`)

| Variable | Status | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Set | Powers ARIA's brain (claude-sonnet-4-6) |
| `SUPABASE_URL` | ✅ Set | `https://jopardijgbzvfncfborn.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ Set | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | |
| `ELEVENLABS_API_KEY` | ⚠️ Disabled | Quota exhausted 2026-05-28 (0/10K credits). Commented out; key preserved on `#` line for restoration after monthly reset. Edge TTS replaces it. |
| `ELEVENLABS_VOICE_ID` | (unused) | Sarah (`EXAVITQu4vr4xnSDxMaL`) — only matters if ElevenLabs is re-enabled |
| `EDGE_TTS_VOICE` | (optional) | Defaults to `en-GB-SoniaNeural`. Other free Edge neural voices: `en-GB-LibbyNeural`, `en-GB-OliviaNeural`, `en-GB-RyanNeural`, `en-GB-ThomasNeural`, `en-US-JennyNeural`, `en-US-AriaNeural` |
| `SERPER_API_KEY` | ✅ Set | 2,500 free searches/month — powers Scout + Hunter |
| `STRIPE_SECRET_KEY` | ⚠️ Empty | Revenue metrics run in demo mode (MRR = $0) until set |
| `BUFFER_ACCESS_TOKEN` | ⚠️ Empty | LinkedIn scheduling disabled until set |
| `BUFFER_PROFILE_ID` | ⚠️ Empty | LinkedIn scheduling disabled until set |
| `COMPETITOR_URLS` | ⚠️ Empty | Competitor monitoring disabled until set |
| `BRIDGE_MRR_TARGET` | ✅ Set | `16500` (gross target) |
| `BRIDGE_NET_TARGET` | ✅ Set | `11000` (net — displayed in HUD revenue panel) |
| `DAY_JOB_INCOME` | ✅ Set | `8200` |
| `PORT` | ✅ Set | `3001` |

**Supabase setup:** Go to supabase.com → your project → SQL editor → paste `server/schema.sql` → run it. Creates `aria_memory`, `aria_clients`, and `aria_tenants` tables. Must be done before memory/clients work.

---

## ARIA's Tools

| Tool | What it does |
|---|---|
| `track_mrr_vs_bridge` | Gross MRR vs $16,500 target from client roster |
| `get_revenue_metrics` | Live Stripe MRR, ARR, churn (demo mode without Stripe key) |
| `get_business_summary` | Full snapshot: revenue + clients + competitors |
| `get_client_roster` | All clients with status, MRR, tier, notes |
| `update_client` | Create/update client in Supabase roster |
| `save_to_memory` | Save goals/decisions/issues/context to Supabase |
| `get_memory` | Read all persistent memory + session summaries |
| `check_competitors` | Detect changes on competitor websites (hash diff) |
| `draft_conversion_email` | Break-fix → retainer conversion email via Claude sub-call |
| `generate_proposal` | Full MSP proposal from discovery call notes |
| `schedule_linkedin_post` | Schedule post via Buffer API |
| `delegate_to_scout` | Web research sub-agent (Serper search + page reading) |
| `delegate_to_hunter` | Lead generation sub-agent (finds Indianapolis SMB prospects) |
| `delegate_to_creative` | Content sub-agent (LinkedIn posts, ad copy in Randy's voice) |

**Disabled until Phase 3:** GitHub, Linear, PostHog, Intercom

---

## Known Issues / Next Steps

**Immediate (unblocking revenue):**
- **Stripe not connected** — revenue data shows $0. Add `STRIPE_SECRET_KEY` to get real MRR tracking. HUD falls back to `$1,950` placeholder only if `metrics` is entirely `null`; if Stripe returns `0` explicitly, that's what shows.
- **Buffer not connected** — `schedule_linkedin_post` returns error. Add `BUFFER_ACCESS_TOKEN` + `BUFFER_PROFILE_ID`.
- **MRR showing $0 in HUD** — because `metrics.mrr.grossMrr === 0` from Supabase (no clients with MRR entered). Add client MRR data to Supabase or connect Stripe. The `??` operator only falls back on `null`/`undefined`, not `0`.

**Supabase:**
- Schema must be run manually in Supabase SQL editor (`server/schema.sql`) before memory/clients work.
- If memory or clients panel is empty, that's likely why.

**Code cleanup (non-urgent):**
- Old components unused: `Chat.jsx`, `Dashboard.jsx`, `Clients.jsx`, `Memory.jsx`, `Orb.jsx`, `Alert.jsx`, `TextInput.jsx` — safe to delete.
- Model ID inconsistency — `draft_conversion_email` and `generate_proposal` in `tools.js` may reference `claude-sonnet-4-20250514`; should use `claude-sonnet-4-6`.
- System Diag (CPU/RAM/swap) is simulated random data — not real system metrics.

**Chrome only for STT** — Web Speech API is Chrome/Edge only. Text input in bottom bar works everywhere.

**`MAX_TTS_CHARS = 850`** in `App.jsx` is a leftover from the ElevenLabs era — it truncates long responses with "Full response is in the chat." It's only consulted by `speakText` (the non-streaming path used for alerts and tool-only turns). The streaming path doesn't apply it. Safe to delete the truncation when convenient, since Edge TTS has no quota.

**Server runs via `node src/index.js`** — no nodemon/auto-reload. Restart manually after server-side edits: `kill <pid> && cd /Users/randyjewell/ARIA/server && nohup node src/index.js > /tmp/aria-server.log 2>&1 &`. Pre-warm log line `TTS: ✓ Edge pre-warmed (en-GB-SoniaNeural)` confirms boot is healthy.

---

## What Was Built (Session History)

### Session 1 (original build)
- Full HUD UI replacing the mobile-first chat interface
- 3-column CSS Grid layout with neural canvas, ARIA orb, voice waveform strip
- All tools (Stripe, Supabase, Serper, ElevenLabs, Buffer, sub-agents)
- WebSocket server with session summarization

### Session 2 (debugging + fixes)
1. **dotenv `override: true`** — critical fix; without it ARIA never responded (empty API key)
2. **Lazy Anthropic client** — created on first use, after dotenv has run
3. **WebSocket listener ordering** — message handler registered before async Supabase calls; prevented dropped messages
4. **ElevenLabs sequential TTS** — changed from parallel to sequential sentence fetching; eliminated `too_many_concurrent_requests` errors on free tier
5. **`_playBlob` returns boolean** — enables proper detection of whether ElevenLabs played at all, so browser TTS fallback fires correctly
6. **MRR display fix** — `metrics.mrr` was the full `trackMrrVsBridge()` result object, not a number; fixed with multi-path fallback chain using `??`
7. **Orb label fix** — "IDLE" → "READY" via state→label mapping object
8. **J&J CONSULTING ACTIVE dot** — was amber (wrong, amber = warnings only); changed to teal
9. **STT error messages** — human-readable errors ("MIC BLOCKED — CHECK CHROME PERMISSIONS" etc.) instead of raw error codes
10. **WS disconnect feedback** — shows state code when WebSocket isn't open
11. **`state-sleeping` CSS** — dim ring styles for always-on wake word mode
12. **CONVO MODE button** — prominent teal button below mic in center panel; defaults to ON
13. **ARIA personality** — confirmed fully active now that API key fix is in place; snarky co-founder, voice-first, warm/direct

### Session 3 (2026-05-28 — Cosmic orb + voice rebuild + streaming TTS)

**Visual: cosmic orb replaces ring stack**
- New `client/src/components/CosmicOrb.jsx` — Three.js scene via react-three-fiber. Three nested additive-blended glow shells (atmospheric bloom + halo + bright inner core), tilted Saturn-style particle ring, two parallax nebula planes (teal/purple/blue noise), drei `<Stars>`, faint hex grid plane.
- Bloom postprocessing via `@react-three/postprocessing`. Shared uniforms `uTime`, `uState` (0=idle/sleeping, 0.5=listening/thinking, 1=speaking — lerped over ~300ms), `uVoiceBright` (driven by `voiceIntensityRef`), `uColor` (piecewise lerp teal → violet → near-white).
- Mounted at fixed `inset:0; z-index:1` outside `<div class="hud-root">` (which is bumped to `z-index:2`). `.col-center` is `background: transparent` so the cosmic shows through. `.panel` and `.bottom-bar` are now `rgba(7,18,24,0.72) + backdrop-filter: blur(6px)` so the scene bleeds behind translucent panels.
- Dependencies added in `client/package.json`: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.
- **Quirk:** the iframe preview can lose R3F's initial ResizeObserver — `CosmicOrb` dispatches a 3-stage delayed `window.dispatchEvent(new Event('resize'))` on mount as a defensive measure. Harmless in normal browsers.
- Removed: the 153-line `#neuralCanvas` rAF loop, 4 ring divs, `.aria-core` button, plus 6 unused keyframes (`spin`, `spin-rev`, `core-pulse`, `listen-throb`, `think-throb`, `speak-throb`) and the `neuralCanvasRef`/`neuralStateRef` refs. Replaced the click target with an invisible `.cosmic-orb-hit` button over the scene.

**Voice: ElevenLabs out, Edge Neural TTS in (free, no quota)**
- Free-tier ElevenLabs quota hit 0/10K — every `/speak` was failing with `quota_exceeded`, client was falling back to browser TTS which sounded robotic. `ELEVENLABS_API_KEY` commented out (with `#`-prefixed line preserving the key for monthly reset / paid upgrade).
- Installed `msedge-tts@2.0.5` in `server/`. Rewrote the `/speak` endpoint to use Edge's free WebSocket TTS. Default voice `en-GB-SoniaNeural` (BBC-style female). Other free options listed in env-vars table.
- Pre-warm at startup eliminates the ~2s cold-start handshake.
- Promise-chain serialization (`_ttsChain`) makes concurrent client fetches safe (single MsEdgeTTS WS can't multiplex).
- SSML escape fix (`& < > " '` → entities) — Edge silently returns 0-byte audio if these appear unescaped in inputs like "Jack & Jewell".

**Streaming TTS (the perceived-latency fix)**
- `client/src/Voice.js`: new `startStream(serverUrl, { onStart, onEnd, onError })` returns a `{ push, end, cancel, aborted }` controller. Each `push(sentence)` immediately starts the fetch and queues the promise. The playback loop awaits promises in order — fetches overlap with playback so the next sentence's audio is already buffered by the time the current one ends.
- `client/src/App.jsx`: `handleServerEvent` now detects sentence boundaries on every `token` event (regex `/[.!?]+\s/g`) and pushes to the stream as sentences close, instead of waiting for `done`. On `done`, flushes the tail and calls `stream.end()`. Falls back to non-streaming `speakText` for tool-only turns (no tokens streamed).
- New refs: `ttsStreamRef`, `ttsBufferRef`. The buffer keeps a cursor into the accumulated text so we don't re-detect old sentences.
- `ensureTtsStream` checks `aborted` before reusing — handles user interruption cleanly.
- **Measured improvement:** time-to-first-audio dropped from ~7–8s to ~5.7s; gaps between sentences dropped from 5–13s to 0s.

**Out-of-tree artifacts in `~/Downloads/` (separate from the React app, vanilla HTML)**
- `aria-hud.html` — earlier vanilla mockup, updated this session with the Glass Shell layer:
  - Fixed 56px header overlay (A.R.I.A. wordmark + JACK & JEWELL on left; persona pill RANDY/CLIENT with state-only toggle, 3 ghost icon buttons (neural map, alerts with badge, settings), status mirror, mic reference on right)
  - Collapsible Activity panel at the top of `col-right`: CLIENT QUEUE / ACTIVE ENGAGEMENTS / STAGED OUTREACH with URGENT/PENDING/HANDLED badges and slide-in animation
  - Floating glass response cards near bottom-center: standard 240px + revenue 300px variant; `window.showARIACard(type, content)` console helper; types `insight`, `task-complete`, `alert`, `warn`, `revenue`
  - `pointer-events: none` discipline on all overlay containers; verified clicks through empty header reach `.top-clock` underneath
  - All previous elements (orb rings, neural canvas, voice strip, mic, side panels) intact
- `aria-mic-bar.html` — new standalone single-file component built from a fresh spec:
  - 64×64 mic button fixed at bottom-center, transparent bar, `pointer-events: all` only on the button + pip
  - Three states (idle / listening / thinking) with their own borders, glows, icons, hint text
  - Mode pip (bottom-right of button): amber for randy, teal for client; click toggles + custom tooltip
  - Listening confidence ring driven by `--ring-duration` / `--ring-opacity` CSS vars set via `ARIAMicBar.setInputLevel(0–1)`; auto-simulates while listening (toggle via `ARIAMicBar.simulateInput = false`)
  - Wake-word flash: 300ms border + scale animation, triggered via `ARIAMicBar.triggerWakeWord()` or pressing `W`
  - Custom events `aria:mic-toggle`, `aria:mode-toggle`, `aria:state-change` with the spec'd payloads
  - Demo wrapper page: dark `#0D0E12`, top-left debug panel showing state/mode/last event, top-right keyboard shortcuts (Space/T/M/W)
  - Verified at 1280×800 desktop and 375×812 mobile; zero console errors

**Preview infrastructure note**
- `~/.claude/launch.json` now has an `aria-hud` config (python3 http.server on :5179, cwd `~/Downloads`) for serving the standalone HTML files. The existing `aria-client` config on :5174 still launches the React Vite dev server.

**Memory persisted to** `~/.claude/projects/-Users-randyjewell/memory/project_aria_build.md` — updated with the ElevenLabs disabled state, Edge TTS pre-warm note, and server-restart instructions. Future sessions auto-load this.

**Still blocked (unchanged from Session 2):**
- Stripe key → real MRR
- Buffer key + profile ID → LinkedIn scheduling
- Competitor URLs → competitor monitoring
- Verify Supabase schema actually ran (empty memory/clients panels = sign it didn't)

---

## Daily Driver Runbook (added 2026-05-29)

ARIA runs as two local processes managed by shell scripts. No Claude session, Docker, or pm2 required.

```bash
# Start
/Users/randyjewell/ARIA/bin/start.sh

# Check
/Users/randyjewell/ARIA/bin/status.sh

# Tail logs
tail -f /Users/randyjewell/ARIA/logs/server.log
tail -f /Users/randyjewell/ARIA/logs/client.log

# Stop
/Users/randyjewell/ARIA/bin/stop.sh

# Restart (= stop + start)
/Users/randyjewell/ARIA/bin/restart.sh
```

`start.sh` is idempotent — refuses if `:3001` or `:5174` is already in use. It writes PIDs to `logs/server.pid` and `logs/client.pid` and waits for `/health`, the TTS pre-warm log line, and Vite ready before exiting. Typical boot is ~10s.

`stop.sh` reads the PID files, kills the process groups (npm → node → children), then sweeps the ports as a backstop. Safe to run when nothing is running.

`status.sh` probes both ports + reports PID state + last 5 server log lines.

**HUD URL:** [http://localhost:5174](http://localhost:5174) — works in Chrome only for voice (Web Speech API).

**Future: auto-start at Mac login** — when Randy wants always-on, the answer is a `~/Library/LaunchAgents/com.jackandjewell.aria.plist` that runs `start.sh` at login. Skipping for now per his preference (start manually for control).

---

## Hermes CLI Integration — Installed and Wired (2026-05-29)

Hermes Agent (Nous Research, OSS, v0.15.1) is installed at `~/.local/bin/hermes`. It works as ARIA's 4th sub-agent — `delegate_to_hermes` next to `delegate_to_scout/hunter/creative`.

### What's wired
- **`server/src/subagents/hermes.js`** — spawns `hermes chat -Q -q "<task>"` via `child_process.spawn`. Parses stdout, strips `session_id:` line, returns `{ response, sessionId, durationMs }`. 60s default timeout (`HERMES_TIMEOUT_MS`). Binary path configurable via `HERMES_BIN` env var, defaults to `~/.local/bin/hermes`.
- **`server/src/tools.js`** — `delegate_to_hermes` tool definition in `TOOL_DEFINITIONS`, dispatch case in `callTool`.
- **`server/src/agent.js`** — system prompt now has a "YOUR SUB-AGENTS" section explaining when to use each, including Hermes ("background brain, persistent memory, 5s spawn cost, don't use for quick lookups").

### Smoke-test result (2026-05-29)
End-to-end via WebSocket → `delegate_to_hermes` → Hermes spawn → Anthropic call → response back → ARIA token stream:
- Tool fired at 2.76s
- Hermes response at 7.19s (4.4s Hermes wall time)
- First token to client at 10.07s
- `done` at 10.45s

Cold spawn = ~4–5s per `delegate_to_hermes` call. Acceptable for "delegate this background task" but slow for "quick lookup." ARIA's prompt is tuned to only delegate when the depth actually warrants it.

### Hermes config quirks discovered during install
1. **Default `base_url: https://openrouter.ai/api/v1`** — Hermes ships routing through OpenRouter. We removed the `base_url` line from `~/.hermes/config.yaml` so it hits `api.anthropic.com` directly with the Anthropic key. Without that change you'd need an OpenRouter API key.
2. **Stale `ANTHROPIC_API_KEY` in `~/.hermes/.env`** — replaced with the working key from `server/.env`. Both ends with `...zU7zuwAA` now.
3. **`model.default: ""`** — pinned to `claude-sonnet-4-5` in `~/.hermes/config.yaml` so `hermes chat -Q -q "..."` works with no flags.
4. **Backups** — `~/.hermes/config.yaml.bak.<timestamp>` and `~/.hermes/.env.bak.<timestamp>` preserve the previous state. Safe to delete once Hermes has been used for a week.
5. **Doctor warning** — `Update available: 656 commits behind`. Run `hermes update` when you have a quiet hour.
6. **Optional packages not installed** — `python-telegram-bot`, `discord.py`. Install when ready to wire those channels.

### Suggested first real Hermes use case
Per the integration plan: **"Scheduled 8am MRR-vs-bridge check"** — exercises persistent memory, scheduling (Hermes cron), and channel reach simultaneously. Don't broaden Hermes's role until that one task ships end-to-end.

---

## Next Up — Hermes CLI Integration (decided 2026-05-28)

Add Nous Research's Hermes Agent as a 4th sub-agent ARIA can delegate to. **The HUD does not change. Claude sonnet-4-6 stays ARIA's primary brain.** Hermes brings persistent memory, 40+ tools, MCP support, and channel adapters (Telegram, Discord, Slack, WhatsApp, etc.) that ARIA doesn't have today.

### Architecture
```
Randy speaks → ARIA (Claude sonnet-4-6, voice + HUD)
                  ↓ decides to delegate
                tools.js: delegate_to_hermes(prompt)
                  ↓ spawn
                hermes chat --quiet --json -q "<prompt>"
                  ↓ Hermes loop (uses ITS OWN LLM — start with same Claude key)
                JSON result back to ARIA's agent loop
                  ↓
                ARIA responds in voice
```

### Phase 1 plan (~30 minutes of work)
1. **Install Hermes CLI:** `npm i -g @nousresearch/hermes-agent` (or `docker run -it --rm -v ~/.hermes:/opt/data nousresearch/hermes-agent setup`)
2. **Run `hermes setup`** — point it at the same `ANTHROPIC_API_KEY` ARIA uses, pick `claude-sonnet-4-6` as Hermes's LLM (matches ARIA's voice)
3. **Verify standalone:** `hermes chat -q "Hello"` returns a response. `hermes doctor` shows green
4. **Add tool to `server/src/tools.js`:** new `delegate_to_hermes` next to existing `delegate_to_scout/hunter/creative`. Use `execa` (already a dep? if not, install) to spawn `hermes chat --quiet --json -q "<prompt>"`, parse stdout
5. **Update agent system prompt** in `server/src/agent.js` to mention the new sub-agent and when to use it (persistent memory, multi-channel reach, scheduled work)
6. **Smoke test:** ask ARIA "delegate to Hermes to confirm the bridge target" — should fire the tool, return Hermes's reply, ARIA speaks the result in Kate's voice

### Use case to validate Phase 1 with
**"Scheduled 8am MRR-vs-bridge check"** — exercises persistent memory (yesterday's MRR), scheduling (cron-ish via Hermes), and channel reach (Hermes posts the report to a chosen channel) all at once. Don't broaden Hermes's role until that one task works end-to-end.

### Hosting decision
Stay on **shape A (spawn-per-call)** until usage proves you need more.
- A. **Spawn-per-call** — ~200–500ms overhead per `delegate_to_hermes`, no new infra. Start here.
- B. **Local Hermes daemon** — `hermes serve` + `pm2` or `launchd`. Migrate when calling Hermes 3+ times per ARIA conversation
- C. **Hetzner VPS $4/mo** — only when you have at least one paying client needing 24/7 monitoring

### Memory split rule (non-negotiable)
- **Supabase** = ARIA's business state: MRR, clients, decisions, session summaries
- **`~/.hermes/`** = Hermes-internal: self-improving skills, channel state, Hermes's session memory
- Don't cross-write. If you need a value in both places, one is the system of record and the other syncs from it.

### LLM-for-Hermes decision
Start with **same Anthropic key as ARIA** (simplest, most coherent personality). Measure Hermes's monthly token spend after 2 weeks. Only swap in DeepSeek V4 (~$0.30/1M vs Claude ~$15/1M) if Hermes is burning tokens on background tasks and the cost is meaningful.

### Don't do (out of scope for Phase 1)
- Don't migrate to Hermes Desktop (vaporware, would throw away the cosmic orb / HUD work)
- Don't put Hermes on a VPS yet (overkill — no recurring tasks justifying it)
- Don't wire multi-channel adapters yet — first prove the CLI sub-agent works
- Don't install Superpowers (Randy explicitly deferred this 2026-05-28)
