import { getSupabase } from '../supabase.js';
import { ConfigDrivenAgent } from '../factory/runtime.js';
import { callTool } from '../tools.js';
import { runScout } from '../subagents/scout.js';
import { runHunter } from '../subagents/hunter.js';
import { runCreative } from '../subagents/creative.js';
import { runHermes } from '../subagents/hermes.js';
import {
  createTask,
  listTasks,
  listByState,
  getTask,
  setState,
  deleteTask,
} from './tasks-repo.js';

/**
 * Routing map for the 4 rich subagents.
 * Each entry is an async (text, onEvent) => string runner.
 *
 * Input adaptation:
 *   scout    — task=text, focus=undefined  (focus is optional)
 *   hunter   — { notes: text }  (industry not required at runtime; notes carries the free-text intent)
 *   creative — { objective: text }  (objective is the only required field)
 *   hermes   — { task: text }
 *
 * Return normalization:
 *   scout/hunter/creative always return structured objects → JSON.stringify
 *   hermes returns { response, sessionId, durationMs } or { error } → use .response or .error
 */
const RICH_AGENTS = {
  scout: async (text, onEvent) => {
    const result = await runScout(text, undefined, onEvent);
    return typeof result === 'string' ? result : JSON.stringify(result);
  },
  hunter: async (text, onEvent) => {
    const result = await runHunter({ notes: text }, onEvent);
    return typeof result === 'string' ? result : JSON.stringify(result);
  },
  creative: async (text, onEvent) => {
    const result = await runCreative({ objective: text }, onEvent);
    return typeof result === 'string' ? result : JSON.stringify(result);
  },
  hermes: async (text, onEvent) => {
    const result = await runHermes({ task: text }, onEvent);
    if (result && typeof result.response === 'string') return result.response;
    if (result && typeof result.error === 'string') return result.error;
    return JSON.stringify(result ?? '');
  },
};

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
 * Background runner — executes an agent task.
 * For the 4 rich slugs (scout, hunter, creative, hermes) delegates to the real
 * subagent; all others fall back to ConfigDrivenAgent.
 * Catches ALL errors; never throws. Updates task state and broadcasts events.
 * Results are always parked as awaiting_approval — never auto-approved.
 */
async function runTask(task, row, broadcast) {
  const { id, slug, text } = task;
  try {
    await setState(id, 'running');
    broadcast({ type: 'agent_state', slug, state: 'working' });
    broadcast({ type: 'agent_task.updated', id });

    let resultText;
    let proposedActions;
    if (RICH_AGENTS[slug]) {
      // Route to the real subagent; result is already normalized to a string.
      // Rich subagents do not return proposedActions — gating is only on the
      // generic ConfigDrivenAgent path in v1.
      resultText = await RICH_AGENTS[slug](text, () => {});
    } else {
      // Generic config-driven path for beacon, verse, and any future agents.
      const agent = new ConfigDrivenAgent(row);
      const result = await agent.run(text, () => {});
      // result is { text, shadow, proposedActions } from ConfigDrivenAgent.run()
      resultText = (result && typeof result.text === 'string')
        ? result.text
        : String(result ?? '');
      proposedActions = result?.proposedActions;
    }

    // If any gated outward-action was captured, persist the first as proposed_action.
    const approvalPatch = { result: resultText };
    if (Array.isArray(proposedActions) && proposedActions.length > 0) {
      approvalPatch.proposed_action = proposedActions[0];
    }
    await setState(id, 'awaiting_approval', approvalPatch);
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

      if (task.proposed_action) {
        // Atomic claim: transition awaiting_approval → publishing BEFORE calling
        // the real publish tool. The optimistic lock in setState ensures only ONE
        // concurrent approve request can win this transition; the loser's setState
        // throws 'state changed concurrently' and never reaches callTool.
        try {
          await setState(req.params.id, 'publishing');
        } catch (claimErr) {
          return res.status(409).json({ error: 'already being processed' });
        }

        // Execute the gated outward action now that a human has approved it.
        // Caller kind 'human_approved' bypasses the GATED_TOOLS interception —
        // this is the ONLY path where publish_to_linkedin actually fires.
        try {
          const execResult = await callTool(
            task.proposed_action.tool,
            task.proposed_action.input,
            undefined,
            undefined,
            { caller: { kind: 'human_approved' } },
          );
          await setState(req.params.id, 'approved', {
            result: (task.result || '') + '\n\n[published] ' + JSON.stringify(execResult).slice(0, 500),
          });
          broadcast({ type: 'agent_task.updated', id: req.params.id });
          return res.json({ status: 'approved', id: req.params.id, executed: true });
        } catch (execErr) {
          await setState(req.params.id, 'failed', {
            result: (task.result || '') + '\n\n[publish failed] ' + String(execErr?.message || execErr),
          });
          broadcast({ type: 'agent_task.updated', id: req.params.id });
          return res.status(500).json({ status: 'failed', id: req.params.id, error: String(execErr?.message || execErr) });
        }
      }

      // No proposed_action — plain approval (review/content tasks).
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
