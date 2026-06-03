import { runResearch } from './research.js';
import { generateSystemPrompt } from './prompt.js';
import { writeAgentSpec } from './spec.js';
import { sanitize, SanitizeError } from './sanitize.js';
import { slugify, isReserved } from './slug.js';
import { TOOL_DEFINITIONS } from '../tools.js';
import * as repo from './repo.js';

export const _inFlight = new Set();

const DAILY_CAP = Number(process.env.FACTORY_DAILY_CAP || 5);
const MAX_REVISIONS = 3;
const DEFAULT_MODEL = process.env.FACTORY_MODEL || 'claude-sonnet-4-6';

function factoryAllowedToolNames() {
  return TOOL_DEFINITIONS.filter(t => t.factory_allowed !== false).map(t => t.name);
}

export class SpawnPipeline {
  constructor({ broadcast }) {
    this._broadcast = broadcast || (() => {});
  }

  /**
   * Kick off the pipeline for a task and keep a strong reference so V8 can't
   * GC the in-flight promise mid-execution. Returns the promise so tests can
   * await completion.
   */
  kickoff(taskId) {
    const p = this.run(taskId).finally(() => _inFlight.delete(p));
    _inFlight.add(p);
    return p;
  }

  async run(taskId) {
    try {
      const task = await repo.getTask(taskId);
      if (!task) throw new Error(`task ${taskId} not found`);
      if (task.status !== 'pending') {
        throw new Error(`task ${taskId} not in pending status (was ${task.status})`);
      }

      // Pre-LLM guards — fail fast, save API calls.
      const slug = slugify(task.name_hint);
      if (!slug) throw new Error('empty slug after slugify');
      if (isReserved(task.name_hint)) {
        throw new Error(`slug "${slug}" is reserved (scout/hunter/creative/hermes/factory)`);
      }
      // Check daily cap (spec §9). countTasksToday counts non-failed tasks
      // already created today (incl. this one), so `>= DAILY_CAP` rejects once
      // the cap has been reached — i.e. at most DAILY_CAP spawns per day.
      const today = await repo.countTasksToday(task.tenant_id);
      if (today >= DAILY_CAP) {
        throw new Error(`daily spawn cap reached (${DAILY_CAP}/day)`);
      }
      // Sanitize user inputs
      let role, special;
      try {
        role = sanitize(task.role_description);
        special = task.special_requirements ? sanitize(task.special_requirements) : null;
      } catch (err) {
        if (err instanceof SanitizeError) throw new Error(`input rejected: ${err.message}`);
        throw err;
      }

      // 1. pending → researching
      await repo.transition(taskId, 'researching');
      const research = await runResearch(role, factoryAllowedToolNames(), (e) => this._broadcast({ kind: 'factory.event', taskId, ...e }));
      if (!research.ok) throw new Error(`research failed: ${research.error}`);

      // Filter tool_allowlist against the current global factory_allowed set —
      // belt-and-suspenders even though research is told to pick from this list.
      const allowed = new Set(factoryAllowedToolNames());
      const toolAllowlist = (research.report.tools_available || []).filter(n => allowed.has(n));

      // 2. researching → drafting_spec
      await repo.transition(taskId, 'drafting_spec', { research_report_id: research.reportId });
      writeAgentSpec({
        slug,
        name: task.name_hint,
        role,
        specialRequirements: special,
        report: research.report,
      });

      // 3. drafting_spec → writing_prompt
      await repo.transition(taskId, 'writing_prompt');
      const promptResult = await generateSystemPrompt({
        name: task.name_hint,
        role,
        specialRequirements: special,
        report: research.report,
      });
      if (!promptResult.ok) throw new Error(`prompt generation failed: ${promptResult.error}`);

      const proposed_manifest = {
        slug,
        name: task.name_hint,
        specialty: research.report.domain,
        system_prompt: promptResult.prompt,
        tool_allowlist: toolAllowlist,
        model: DEFAULT_MODEL,
        tools_wishlist: research.report.tools_wishlist || [],
      };

      // 4. writing_prompt → awaiting_approval
      await repo.transition(taskId, 'awaiting_approval', { proposed_manifest });

      this._broadcast({ kind: 'factory.task_ready', taskId, slug, name: task.name_hint });
    } catch (err) {
      console.error('[pipeline] error for task', taskId, ':', err.message);
      try {
        await repo.setError(taskId, err.message);
        this._broadcast({ kind: 'factory.task_failed', taskId, error: err.message });
      } catch (cleanupErr) {
        console.error('[pipeline] could not record failure:', cleanupErr.message);
      }
    }
  }

  /**
   * Re-run only Tier 2 (prompt generation) using the cached research report.
   * Called from the reject-with-feedback endpoint.
   */
  async runRevision(taskId) {
    try {
      const task = await repo.getTask(taskId);
      if (!task) throw new Error(`task ${taskId} not found`);
      if (task.approval_iterations >= MAX_REVISIONS) {
        throw new Error(`max revision rounds exceeded (${MAX_REVISIONS})`);
      }
      if (task.status !== 'awaiting_approval') {
        throw new Error(`task ${taskId} not in awaiting_approval (was ${task.status})`);
      }
      // awaiting_approval → writing_prompt
      await repo.transition(taskId, 'writing_prompt');
      const priorPrompt = task.proposed_manifest?.system_prompt;
      const role = sanitize(task.role_description);
      const special = task.special_requirements ? sanitize(task.special_requirements) : null;

      // Re-fetch research report from cache via stored id — we keep the report inline on the manifest as a fallback
      const report = task.proposed_manifest?._research_report || (await loadResearchReport(task.research_report_id));

      const promptResult = await generateSystemPrompt({
        name: task.name_hint,
        role,
        specialRequirements: special,
        report,
        priorPrompt,
        revisionFeedback: task.revision_feedback,
      });
      if (!promptResult.ok) throw new Error(`revision failed: ${promptResult.error}`);

      const proposed_manifest = {
        ...task.proposed_manifest,
        system_prompt: promptResult.prompt,
      };
      // Increment the revision counter so the MAX_REVISIONS guard above can
      // actually be reached (each accepted revision round counts as one).
      await repo.transition(taskId, 'awaiting_approval', {
        proposed_manifest,
        approval_iterations: (task.approval_iterations || 0) + 1,
      });
      this._broadcast({ kind: 'factory.task_ready', taskId, slug: proposed_manifest.slug, name: task.name_hint, revision: true });
    } catch (err) {
      console.error('[pipeline.runRevision] error for task', taskId, ':', err.message);
      try {
        await repo.setError(taskId, err.message);
        this._broadcast({ kind: 'factory.task_failed', taskId, error: err.message });
      } catch {}
    }
  }
}

async function loadResearchReport(reportId) {
  if (!reportId) throw new Error('no research_report_id on task');
  const { getSupabase } = await import('../supabase.js');
  const sb = getSupabase();
  const { data, error } = await sb.from('research_reports').select('report').eq('id', reportId).maybeSingle();
  if (error || !data) throw new Error(`could not load research report ${reportId}`);
  return data.report;
}
