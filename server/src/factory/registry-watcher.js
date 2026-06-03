import { getSupabase } from '../supabase.js';
import { buildDispatchTool } from './dispatch-tool.js';
import { ConfigDrivenAgent } from './runtime.js';

const POLL_FALLBACK_MS = Number(process.env.FACTORY_POLL_MS || 60_000);

/**
 * Watches the spawned_agents table via Supabase Realtime and (un)registers
 * dispatch_to_<slug> tools in the provided ToolRegistry. First subscriber to
 * Supabase Realtime in this codebase (spec §1.2).
 *
 * ToolRegistry contract:
 *   register(toolDef, executor)
 *   unregister(toolName)
 *
 * Where executor(input, onEvent) → Promise<any> is called by callTool when
 * the dispatcher sees `dispatch_to_<slug>`.
 */
export class RegistryWatcher {
  constructor(toolRegistry) {
    this._registry = toolRegistry;
    this._known = new Map();   // slug → row
    this._pollTimer = null;
    this._started = false;
  }

  async start() {
    if (this._started) return;
    this._started = true;
    await this.refresh();
    const sb = getSupabase();
    if (!sb) {
      console.warn('[registry-watcher] no Supabase — Factory hot-reload disabled');
      return;
    }
    sb.channel('factory-agents')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'spawned_agents' },
        () => { this.refresh().catch(err => console.error('[registry-watcher] refresh error:', err.message)); })
      .subscribe((status) => {
        console.log(`[registry-watcher] realtime channel: ${status}`);
      });
    // Fallback poll every 60s for safety (per spec §12)
    this._pollTimer = setInterval(() => {
      this.refresh().catch(() => {});
    }, POLL_FALLBACK_MS);
  }

  stop() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = null;
  }

  async refresh() {
    const sb = getSupabase();
    if (!sb) return;
    const { data: rows, error } = await sb
      .from('spawned_agents')
      .select('*')
      .in('status', ['shadow', 'active']);
    if (error) {
      console.error('[registry-watcher] fetch error:', error.message);
      return;
    }
    const live = new Map((rows || []).map(r => [r.slug, r]));

    // Register new
    for (const [slug, row] of live) {
      if (!this._known.has(slug)) {
        const tool = buildDispatchTool(slug, row);
        const executor = async (input, onEvent) => {
          const current = this._known.get(slug) || row;
          const agent = new ConfigDrivenAgent(current);
          return agent.run(input?.message || '', onEvent);
        };
        this._registry.register(tool, executor);
        console.log(`[registry-watcher] + dispatch_to_${slug} (${row.status})`);
      }
    }

    // Unregister gone (archived or deleted)
    for (const slug of this._known.keys()) {
      if (!live.has(slug)) {
        this._registry.unregister(`dispatch_to_${slug}`);
        console.log(`[registry-watcher] - dispatch_to_${slug}`);
      }
    }

    this._known = live;
  }
}
