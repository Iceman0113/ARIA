import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import axios from 'axios';
import { runAgent, summarizeSession } from './agent.js';
import { startMonitor } from './monitor.js';
import { getAllMetrics } from './tools.js';
import { getMemory, deleteEntry } from './memory.js';
import { getClients, upsertClient, deleteClient } from './clients.js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import crypto from 'crypto';
import { buildAuthorizeUrl, exchangeCodeForTokens, fetchMemberUrn, fetchAdminOrganizations, saveAuth, loadAuth } from './linkedin.js';
import { buildNeuralMap } from './neural-map.js';
import { mountFactoryRoutes } from './factory/routes.js';
import { RegistryWatcher } from './factory/registry-watcher.js';
import { factoryRegistry } from './factory/tool-registry.js';
import { mountVoiceRoutes } from './voice/routes.js';
import { cloneSpeak } from './voice/speak.js';
import { mountAgentRoutes } from './agents/routes.js';

const app = express();
app.use(cors({ origin: ['http://localhost:5174', 'http://localhost:5173'] }));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const connectedClients = new Set();
const sessionLogs = new Map();

export function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const ws of connectedClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

wss.on('connection', async (ws) => {
  connectedClients.add(ws);
  sessionLogs.set(ws, []);
  console.log(`Client connected (${connectedClients.size} total)`);

  // Register message listener FIRST — before any async calls so no messages are dropped
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'chat') {
      console.log(`[chat] "${msg.text?.slice(0,60)}"`);
      const log = sessionLogs.get(ws) || [];
      log.push({ role: 'user', content: msg.text });

      try {
        console.log('[agent] starting...');
        await runAgent(msg.text, msg.history || [], msg.context || {}, async (event) => {
          console.log('[agent event]', event.type);
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));

          if (event.type === 'done' && event.text) {
            log.push({ role: 'assistant', content: event.text });
          }
        }, broadcast);

        // Refresh memory + clients in UI after each exchange
        try {
          const memory = await getMemory();
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'memory', data: memory }));
        } catch {}
        try {
          const roster = await getClients();
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'clients', data: roster }));
        } catch {}
      } catch (err) {
        console.error('[agent error]', err.message);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      }
    }
  });

  ws.on('close', async () => {
    const log = sessionLogs.get(ws) || [];
    connectedClients.delete(ws);
    sessionLogs.delete(ws);
    console.log(`Client disconnected (${connectedClients.size} remaining)`);

    if (log.length >= 4) {
      console.log(`Summarizing session (${log.length} messages)...`);
      summarizeSession(log).catch(() => {});
    }
  });

  // Push initial data after listeners are registered so no messages are missed
  try {
    const metrics = await getAllMetrics();
    if (metrics && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'metrics', data: metrics }));
  } catch {}
  try {
    const memory = await getMemory();
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'memory', data: memory }));
  } catch {}
  try {
    const roster = await getClients();
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'clients', data: roster }));
  } catch {}
});

// ── REST endpoints ────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true, clients: connectedClients.size }));

app.get('/neural-map', async (_, res) => {
  try {
    const payload = await buildNeuralMap();
    res.json(payload);
  } catch (err) {
    console.error('[neural-map] error:', err.message);
    res.status(500).json({ error: 'Could not build neural map' });
  }
});

app.get('/memory', async (_, res) => {
  try { res.json(await getMemory()); }
  catch { res.status(500).json({ error: 'Could not read memory' }); }
});

app.delete('/memory/:key', async (req, res) => {
  try {
    const result = await deleteEntry(req.params.key);
    if (result.deleted) {
      const memory = await getMemory();
      broadcast({ type: 'memory', data: memory });
    }
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not delete entry' }); }
});

app.get('/clients', async (_, res) => {
  try { res.json(await getClients()); }
  catch { res.status(500).json({ error: 'Could not read clients' }); }
});

app.post('/clients', async (req, res) => {
  try {
    const result = await upsertClient(req.body);
    if (result.success) {
      const roster = await getClients();
      broadcast({ type: 'clients', data: roster });
    }
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not save client' }); }
});

app.delete('/clients/:id', async (req, res) => {
  try {
    const result = await deleteClient(req.params.id);
    if (result.deleted) {
      const roster = await getClients();
      broadcast({ type: 'clients', data: roster });
    }
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not delete client' }); }
});

// ── LinkedIn OAuth ────────────────────────────────────────────────
// One-time flow: open /auth/linkedin in browser, log in, get bounced back
// to /auth/linkedin/callback. Tokens persist in linkedin_auth (Supabase).

const linkedinStateStore = new Map(); // state → { issuedAt }
const LINKEDIN_STATE_TTL_MS = 5 * 60 * 1000;

app.get('/auth/linkedin', (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    linkedinStateStore.set(state, { issuedAt: Date.now() });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = buildAuthorizeUrl(state, baseUrl);
    res.redirect(url);
  } catch (err) {
    res.status(500).type('html').send(`<h1>LinkedIn auth not configured</h1><pre>${err.message}</pre>`);
  }
});

app.get('/auth/linkedin/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).type('html').send(`<h1>LinkedIn denied authorization</h1><p>${error}: ${error_description || ''}</p>`);
  }

  const stored = linkedinStateStore.get(state);
  if (!stored || Date.now() - stored.issuedAt > LINKEDIN_STATE_TTL_MS) {
    return res.status(400).type('html').send('<h1>Invalid or expired state</h1><p>Try again — visit /auth/linkedin</p>');
  }
  linkedinStateStore.delete(state);

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const tokens = await exchangeCodeForTokens(code, baseUrl);
    const profile = await fetchMemberUrn(tokens.access_token);
    const orgs = await fetchAdminOrganizations(tokens.access_token);
    await saveAuth({
      accessToken:         tokens.access_token,
      refreshToken:        tokens.refresh_token,
      expiresInSec:        tokens.expires_in,
      refreshExpiresInSec: tokens.refresh_token_expires_in,
      memberUrn:           profile.urn,
      memberName:          profile.name,
      organizations:       orgs,
    });
    const orgsHtml = orgs.length
      ? `<p><strong>Company Pages you admin:</strong></p><ul>${orgs.map(o => `<li>${o.name} <code style="opacity:0.6;">${o.urn}</code></li>`).join('')}</ul>`
      : `<p style="opacity:0.7;">No Company Pages found that you admin. ARIA will post as you personally.</p>`;
    res.type('html').send(`
      <body style="font-family:system-ui;background:#040C10;color:#00E5CC;padding:40px;">
        <h1 style="letter-spacing:6px;">✓ LinkedIn connected</h1>
        <p><strong>Account:</strong> ${profile.name} &lt;${profile.email}&gt;</p>
        <p><strong>URN:</strong> ${profile.urn}</p>
        ${orgsHtml}
        <p style="opacity:0.7;margin-top:24px;">You can close this tab. Go back to ARIA and tell her to post.</p>
      </body>
    `);
  } catch (err) {
    res.status(500).type('html').send(`<h1>Token exchange failed</h1><pre>${err.message}</pre><p>Check LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in server/.env</p>`);
  }
});

app.get('/auth/linkedin/status', async (_, res) => {
  const auth = await loadAuth();
  if (!auth) return res.json({ connected: false });
  res.json({
    connected: true,
    memberUrn: auth.member_urn,
    expiresAt: auth.expires_at,
    needsRefresh: new Date(auth.expires_at).getTime() < Date.now() + 5 * 60 * 1000,
  });
});

// ── Agent Factory ─────────────────────────────────────────────────
mountFactoryRoutes(app, broadcast);
mountVoiceRoutes(app);
mountAgentRoutes(app, { broadcast });

// ── TTS proxy (Microsoft Edge neural voices, free, no API key) ────
// Frontend POSTs text, gets back audio/mpeg. Default voice: en-GB-SoniaNeural.
// Override with EDGE_TTS_VOICE env var. ElevenLabs path kept as a feature-flagged
// fallback if ELEVENLABS_API_KEY is set AND TTS_PROVIDER=elevenlabs.

let _edgeTts = null;
let _edgeVoiceLoaded = null;
async function getEdgeTts(voice) {
  if (_edgeTts && _edgeVoiceLoaded === voice) return _edgeTts;
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  _edgeTts = tts;
  _edgeVoiceLoaded = voice;
  return _edgeTts;
}

// One Edge WS = one synth at a time. Concurrent /speak callers from the
// streaming client would interleave on the wire and corrupt each other's
// audio. This serializes synths through a promise chain so each caller gets
// their own clean MP3 back. Synth cost ~100-300ms; queue depth stays tiny.
let _ttsChain = Promise.resolve();

// msedge-tts wraps text in a minimal SSML envelope but does NOT escape XML
// specials. Unescaped `&` (e.g. "Jack & Jewell") corrupts the SSML and Edge
// returns an empty stream. Escape before handing off.
function escapeForSsml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function synthToBuffer(tts, text) {
  const { audioStream } = tts.toStream(escapeForSsml(text));
  const chunks = [];
  for await (const chunk of audioStream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\nARIA — Adaptive Reasoning & Intelligent Automation`);
  console.log(`Jack & Jewell Consulting LLC | Greenwood, Indiana`);
  console.log(`Running on :${PORT}`);
  console.log(`Model: claude-sonnet-4-6`);
  console.log(`Supabase: ${process.env.SUPABASE_URL ? '✓ connected' : '⚠ fallback to JSON files'}`);
  console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ connected' : '⚠ demo mode'}`);
  console.log(`Buffer: ${process.env.BUFFER_ACCESS_TOKEN ? '✓ connected' : '⚠ not configured'}`);
  console.log(`Serper: ${process.env.SERPER_API_KEY ? '✓ connected' : '⚠ Scout/Hunter limited'}`);
  console.log(`Bridge target: $${process.env.BRIDGE_MRR_TARGET || 16500}/mo gross MRR\n`);

  // Pre-warm Edge TTS — eliminates the ~2s setMetadata handshake on the first /speak call
  const prewarmVoice = process.env.EDGE_TTS_VOICE || 'en-GB-SoniaNeural';
  getEdgeTts(prewarmVoice)
    .then(() => console.log(`TTS: ✓ Edge pre-warmed (${prewarmVoice})\n`))
    .catch((err) => console.error(`TTS pre-warm failed: ${err.message}\n`));

  startMonitor(broadcast);

  // Boot the Factory RegistryWatcher — first Supabase Realtime subscriber.
  const factoryWatcher = new RegistryWatcher(factoryRegistry);
  factoryWatcher.start()
    .then(() => console.log(`Factory: ✓ RegistryWatcher running`))
    .catch((err) => console.error(`Factory: watcher start failed: ${err.message}`));
});
