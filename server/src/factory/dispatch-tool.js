/**
 * Build a uniform tool descriptor for a Factory-spawned agent. Every spawned
 * agent is dispatched the same way: { message: string }. Specialization lives
 * in the agent's system_prompt, NOT in tool args (spec §5 Tier 5b).
 */
export function buildDispatchTool(slug, row) {
  return {
    name: `dispatch_to_${slug}`,
    description: row.specialty || `Dispatch a message to the ${row.name || slug} agent.`,
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: `What you want ${row.name || slug} to do. Be self-contained — they do not see the conversation.` },
      },
      required: ['message'],
    },
    factory_allowed: false,    // spawned agents do not spawn spawned agents (v1)
  };
}
