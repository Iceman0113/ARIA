import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { runAgent, summarizeSession } from './agent.js';
import { startMonitor } from './monitor.js';
import { getAllMetrics } from './tools.js';
import { getMemory, deleteEntry } from './memory.js';
import { getClients, upsertClient, deleteClient } from './clients.js';

const app = express();
app.use(cors({ origin: ['http://localhost:5174', 'http://localhost:5173'] }));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

// Per-connection session tracking for auto-summarization
const sessionLogs = new Map(); // ws -> [{ role, content }]

export function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

wss.on('connection', async (ws) => {
  clients.add(ws);
  sessionLogs.set(ws, []);
  console.log(`Client connected (${clients.size} total)`);

  // Send current metrics immediately
  try {
    const metrics = await getAllMetrics();
    if (metrics) ws.send(JSON.stringify({ type: 'metrics', data: metrics }));
  } catch {}

  // Send current memory state
  try {
    const memory = getMemory();
    ws.send(JSON.stringify({ type: 'memory', data: memory }));
  } catch {}

  // Send current client roster
  try {
    const clients = getClients();
    ws.send(JSON.stringify({ type: 'clients', data: clients }));
  } catch {}

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'chat') {
      // Track user message in session log
      const log = sessionLogs.get(ws) || [];
      log.push({ role: 'user', content: msg.text });

      try {
        const result = await runAgent(msg.text, msg.history || [], msg.context || {}, (event) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));

          // Track ARIA's response in session log
          if (event.type === 'done' && event.text) {
            log.push({ role: 'assistant', content: event.text });
          }
        });

        // After each exchange, send updated memory + clients so UI stays fresh
        try {
          const memory = getMemory();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'memory', data: memory }));
          }
        } catch {}
        try {
          const clients = getClients();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'clients', data: clients }));
          }
        } catch {}
      } catch (err) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      }
    }
  });

  ws.on('close', async () => {
    const log = sessionLogs.get(ws) || [];
    clients.delete(ws);
    sessionLogs.delete(ws);
    console.log(`Client disconnected (${clients.size} remaining)`);

    // Auto-summarize if the session had meaningful conversation
    if (log.length >= 4) {
      console.log(`Summarizing session (${log.length} messages)...`);
      summarizeSession(log).catch(() => {});
    }
  });
});

// ── REST endpoints ────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true, clients: clients.size }));

app.get('/memory', (_, res) => {
  try { res.json(getMemory()); } catch { res.status(500).json({ error: 'Could not read memory' }); }
});

app.delete('/memory/:key', (req, res) => {
  try {
    const result = deleteEntry(req.params.key);
    if (result.deleted) {
      broadcast({ type: 'memory', data: getMemory() });
    }
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not delete entry' }); }
});

app.get('/clients', (_, res) => {
  try { res.json(getClients()); } catch { res.status(500).json({ error: 'Could not read clients' }); }
});

app.post('/clients', (req, res) => {
  try {
    const result = upsertClient(req.body);
    if (result.success) broadcast({ type: 'clients', data: getClients() });
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not save client' }); }
});

app.delete('/clients/:id', (req, res) => {
  try {
    const result = deleteClient(req.params.id);
    if (result.deleted) broadcast({ type: 'clients', data: getClients() });
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not delete client' }); }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🤖 ARIA (Adaptive Response & Intelligence Architecture) running on :${PORT}`);
  console.log(`   Company: ${process.env.COMPANY_NAME || '(not set — add to .env)'}`);
  console.log(`   Claude: claude-opus-4-7`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ connected' : '⚠ demo mode'}`);
  console.log(`   GitHub: ${process.env.GITHUB_TOKEN ? '✓ connected' : '⚠ demo mode'}`);
  console.log(`   Intercom: ${process.env.INTERCOM_TOKEN ? '✓ connected' : '⚠ demo mode'}`);
  console.log(`   Competitors: ${(process.env.COMPETITOR_URLS || '').split(',').filter(Boolean).length} URL(s) configured\n`);

  startMonitor(broadcast);
});
