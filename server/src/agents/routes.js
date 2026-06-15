import { getSupabase } from '../supabase.js';
import { ConfigDrivenAgent } from '../factory/runtime.js';
import {
  createTask,
  listTasks,
  listByState,
  getTask,
  setState,
  deleteTask,
} from './tasks-repo.js';

/**
 * Load a single spawned_agents row by slug (shadow or active).
 * Returns null if not found or not in a runnable status.
 */
async function loadAgentRow(slug) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('spawned_agents')
    .select('*')
    .eq('slug', slug)
    .in('status', ['shadow', 'active'])
    .maybeSingle();
  if (error) {
    console.error(`[agent-routes] loadAgentRow(${slug}) error:`, error.message);
    return null;
  }
  return data;
}

/**
 * Background runner — executes an agent task via ConfigDrivenAgent.
 * Catches ALL errors; never throws. Updates task state and broadcasts events.
 */
async function runTask(task, row, broadcast) {
  const { id, slug, text } = task;
  try {
    await setState(id, 'running');
    broadcast({ type: 'agent_state', slug, state: 'working' });
    broadcast({ type: 'agent_task.updated', id });

    const agent = new ConfigDrivenAgent(row);
    const result = await agent.run(text, () => {});

    // result is { text, shadow } from ConfigDrivenAgent.run()
    const resultText = (result && typeof result.text === 'string')
      ? result.text
      : String(result ?? '');

    await setState(id, 'awaiting_approval', { result: resultText });
    broadcast({ type: 'agent_state', slug, state: 'idle' });
    broadcast({ type: 'agent_task.updated', id });
  } catch (err) {
    console.error(`[agent-routes] runTask(${id}) failed:`, err?.message || err);
    try {
      await setState(id, 'failed', { result: String(err?.message || err) });
    } catch (stateErr) {
      console.error(`[agent-routes] runTask(${id}) setState(failed) also failed:`, stateErr?.message);
    }
    broadcast({ type: 'agent_state', slug, state: 'idle' });
    broadcast({ type: 'agent_task.updated', id });
  }
}

export function mountAgentRoutes(app, { broadcast }) {
  // ── GET /agents/tasks?state=... ──────────────────────────────────
  // MUST be mounted before /:slug routes so Express doesn't match 'tasks' as a slug
  app.get('/agents/tasks', async (req, res) => {
    try {
      const state = req.query.state || 'awaiting_approval';
      const tasks = await listByState(state);
      res.json({ tasks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /agents/tasks/:id/approve ──────────────────────────────
  app.post('/agents/tasks/:id/approve', async (req, res) => {
    try {
      const task = await getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'task not found' });
      if (task.state !== 'awaiting_approval') {
        return res.status(409).json({ error: `task is in state '${task.state}', not approvable` });
      }
      await setState(req.params.id, 'approved');
      broadcast({ type: 'agent_task.updated', id: req.params.id });
      res.json({ status: 'approved', id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /agents/tasks/:id/reject ───────────────────────────────
  app.post('/agents/tasks/:id/reject', async (req, res) => {
    try {
      const task = await getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'task not found' });
      if (task.state !== 'awaiting_approval') {
        return res.status(409).json({ error: `task is in state '${task.state}', not rejectable` });
      }
      await setState(req.params.id, 'rejected');
      broadcast({ type: 'agent_task.updated', id: req.params.id });
      res.json({ status: 'rejected', id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /agents/:slug/tasks ─────────────────────────────────────
  app.post('/agents/:slug/tasks', async (req, res) => {
    try {
      const { slug } = req.params;
      const text = (req.body?.text || '').toString().trim();
      if (!text) return res.status(400).json({ error: 'text is required' });

      // Load the agent row (404 if not found/active)
      const row = await loadAgentRow(slug);
      if (!row) {
        return res.status(404).json({ error: `agent '${slug}' not found or not active` });
      }

      // Create task in queued state and respond immediately
      const task = await createTask({ slug, text });
      res.status(201).json({ task });

      // Fire-and-forget background execution — wrapped so it can NEVER crash the server
      Promise.resolve()
        .then(() => runTask(task, row, broadcast))
        .catch((err) => {
          console.error(`[agent-routes] runTask uncaught (should not happen):`, err?.message);
        });
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  // ── GET /agents/:slug/tasks ──────────────────────────────────────
  app.get('/agents/:slug/tasks', async (req, res) => {
    try {
      const tasks = await listTasks(req.params.slug);
      res.json({ tasks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /agents/:slug/tasks/:id ──────────────────────────────
  app.delete('/agents/:slug/tasks/:id', async (req, res) => {
    try {
      const task = await getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'task not found' });
      if (task.state !== 'queued') {
        return res.status(409).json({ error: `task is in state '${task.state}', only queued tasks may be deleted` });
      }
      await deleteTask(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
