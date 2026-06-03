import * as repo from './repo.js';
import { SpawnPipeline } from './pipeline.js';

const MAX_REVISIONS = 3;

export function mountFactoryRoutes(app, broadcast) {
  // GET /factory/pending
  app.get('/factory/pending', async (req, res) => {
    try {
      const tasks = await repo.listPending();
      res.json({ tasks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /factory/agents
  app.get('/factory/agents', async (req, res) => {
    try {
      const statuses = req.query.status ? String(req.query.status).split(',') : null;
      const agents = await repo.listAgents(statuses);
      res.json({ agents });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /factory/tasks/:id/approve
  app.post('/factory/tasks/:id/approve', async (req, res) => {
    try {
      const task = await repo.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'task not found' });
      if (task.status !== 'awaiting_approval') {
        return res.status(409).json({ error: `task is in status '${task.status}', not approvable` });
      }
      const p = task.proposed_manifest;
      const agent = {
        tenant_id: task.tenant_id,
        slug: p.slug,
        name: p.name,
        specialty: p.specialty,
        system_prompt: p.system_prompt,
        tool_allowlist: p.tool_allowlist || [],
        model: p.model || 'claude-sonnet-4-6',
        status: 'shadow',           // soft launch
        created_by_task_id: task.id,
      };
      const inserted = await repo.insertAgent(agent);
      await repo.transition(task.id, 'approved');
      broadcast({
        kind: 'agent_added',
        slug: inserted.slug,
        name: inserted.name,
        created_by_task_id: task.id,
      });
      res.json({ status: 'approved', slug: inserted.slug });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /factory/tasks/:id/reject
  app.post('/factory/tasks/:id/reject', async (req, res) => {
    try {
      const task = await repo.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'task not found' });
      if (task.status !== 'awaiting_approval') {
        return res.status(409).json({ error: `task is in status '${task.status}', not rejectable` });
      }
      await repo.transition(task.id, 'rejected');
      broadcast({ kind: 'factory.task_rejected', taskId: task.id });
      res.json({ status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /factory/tasks/:id/feedback
  app.post('/factory/tasks/:id/feedback', async (req, res) => {
    try {
      const feedback = (req.body?.feedback || '').toString().trim();
      if (!feedback) return res.status(400).json({ error: 'feedback is required' });
      const task = await repo.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'task not found' });
      if (task.status !== 'awaiting_approval') {
        return res.status(409).json({ error: `task is in status '${task.status}', not revisable` });
      }
      if ((task.approval_iterations || 0) >= MAX_REVISIONS) {
        return res.status(409).json({ error: 'max revision rounds exceeded' });
      }
      // Persist feedback WITHOUT a state change — runRevision owns the
      // awaiting_approval → writing_prompt → awaiting_approval transitions AND
      // increments approval_iterations. (A self-transition awaiting_approval →
      // awaiting_approval is rejected by the state machine.)
      await repo.setRevisionFeedback(task.id, feedback);
      const pipeline = new SpawnPipeline({ broadcast });
      pipeline.runRevision(task.id); // async — don't block the HTTP response
      // remaining = revision rounds left AFTER this one (runRevision will bump
      // approval_iterations to (current + 1)).
      res.json({ status: 'revising', remaining: MAX_REVISIONS - (task.approval_iterations || 0) - 1 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /factory/agents/:slug/promote
  app.post('/factory/agents/:slug/promote', async (req, res) => {
    try {
      const agent = await repo.getAgentBySlug(req.params.slug);
      if (!agent) return res.status(404).json({ error: 'agent not found' });
      if (agent.status !== 'shadow') {
        return res.status(409).json({ error: `agent is '${agent.status}', not shadow` });
      }
      const updated = await repo.updateAgentStatus(req.params.slug, 'active');
      broadcast({ kind: 'agent_promoted', slug: updated.slug, name: updated.name });
      res.json({ status: 'active', slug: updated.slug });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /factory/agents/:slug/archive
  app.post('/factory/agents/:slug/archive', async (req, res) => {
    try {
      const agent = await repo.getAgentBySlug(req.params.slug);
      if (!agent) return res.status(404).json({ error: 'agent not found' });
      if (agent.status === 'archived') return res.json({ status: 'archived', slug: agent.slug });
      const updated = await repo.updateAgentStatus(req.params.slug, 'archived');
      broadcast({ kind: 'agent_archived', slug: updated.slug });
      res.json({ status: 'archived', slug: updated.slug });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
