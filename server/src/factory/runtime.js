import { getClient } from '../anthropic.js';
import { TOOL_DEFINITIONS, callTool, toApiTools, GATED_TOOLS } from '../tools.js';

const MAX_ITER = Number(process.env.FACTORY_RUNTIME_MAX_ITER || 8);

/**
 * Generic runtime for any Factory-spawned agent. Parameterized entirely by the
 * spawned_agents row — no specialist logic lives here. If you ever find
 * yourself writing `if (this._row.slug === ...)` inside this class, stop.
 * That behavior belongs in the prompt or the allowlist.
 */
export class ConfigDrivenAgent {
  constructor(row) {
    this._row = row;
  }

  _filteredTools() {
    const allow = new Set(this._row.tool_allowlist || []);
    return TOOL_DEFINITIONS.filter(t =>
      // A gated tool (e.g. publish_to_linkedin) is intentionally marked
      // factory_allowed:false so it never RUNS inside a spawned agent — but the
      // gated-action design needs the agent to be able to *call* it so the call
      // gets intercepted + captured for human approval (see GATED_TOOLS in
      // tools.js). So gated tools are exposed when allowlisted; their safety
      // comes from interception (capture-not-execute), not from being withheld.
      allow.has(t.name) && (t.factory_allowed !== false || GATED_TOOLS.has(t.name))
    );
    // NB: the factory_allowed gate is belt-and-suspenders for NON-gated tools.
    // The Skills Report already restricts candidates to factory_allowed:true
    // tools, but if the flag flips later (e.g. we mark a tool dangerous
    // post-hoc), the dispatcher honors that immediately, without a DB migration.
  }

  async run(userMessage, onEvent) {
    const tools = toApiTools(this._filteredTools());
    const messages = [{ role: 'user', content: userMessage }];
    const shadow = this._row.status === 'shadow';
    const tag = shadow ? '[SHADOW] ' : '';
    // Accumulates any gated outward-action calls intercepted during this run.
    // Shared across all tool calls so every iteration can push to the same array.
    const proposedActions = [];

    console.log(`${tag}dispatch_to_${this._row.slug} ←`, (userMessage || '').slice(0, 80));
    onEvent?.({ type: 'tool_call', name: `dispatch_to_${this._row.slug}`, detail: shadow ? 'shadow' : undefined });

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const response = await getClient().messages.create({
        model: this._row.model || 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: this._row.system_prompt,
        tools,
        messages,
      });

      if (response.stop_reason === 'tool_use') {
        const toolBlocks = response.content.filter(b => b.type === 'tool_use');
        messages.push({ role: 'assistant', content: response.content });

        const results = await Promise.all(
          toolBlocks.map(async (tool) => {
            onEvent?.({ type: 'tool_call', name: `${this._row.slug}/${tool.name}` });
            // Pass caller context so callTool's Hermes ban (Layer 3) can detect us,
            // and proposedActions so gated tools can be captured without executing.
            const ctx = { caller: { kind: 'spawned_agent', slug: this._row.slug }, proposedActions };
            const result = await callTool(tool.name, tool.input, onEvent, /*broadcast*/ undefined, ctx);
            return {
              type: 'tool_result',
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            };
          }),
        );
        messages.push({ role: 'user', content: results });
        continue;
      }

      // end_turn / max_tokens — final text
      const text = (response.content || []).find(b => b.type === 'text')?.text || '';
      console.log(`${tag}dispatch_to_${this._row.slug} →`, text.slice(0, 80));
      onEvent?.({ type: 'tool_result', name: `dispatch_to_${this._row.slug}`, preview: text.slice(0, 120) });
      return { text, shadow, proposedActions };
    }

    return { text: '', error: `max iterations (${MAX_ITER}) reached`, shadow, proposedActions };
  }
}
