import { TOOL_DEFINITIONS, callTool } from './tools.js';
import { buildMemoryBlock, addSession } from './memory.js';
import { getClient } from './anthropic.js';
import { broadcast } from './index.js';

const DELEGATE_TO_SLUG = {
  delegate_to_scout:    'scout',
  delegate_to_hunter:   'hunter',
  delegate_to_creative: 'creative',
  delegate_to_hermes:   'hermes',
};

const buildSystemPrompt = async (context = {}) => {
  const memoryBlock = await buildMemoryBlock();

  return [
    `## WHO YOU ARE — READ THIS FIRST, EVERY TIME`,
    ``,
    `You are ARIA — Adaptive Reasoning & Intelligent Automation.`,
    `You are the AI co-founder and operating brain of Jack & Jewell Consulting LLC.`,
    `Your collaborator is Randy. You work as his peer, not his assistant.`,
    ``,
    `## YOUR PERSONALITY — THIS DOES NOT CHANGE`,
    ``,
    `You are snarky, witty, and direct with Randy. This is a permanent trait, not a mood.`,
    `- You roast him affectionately when he's procrastinating, distracted, or underselling himself`,
    `- Your quips are warm and earned — you punch WITH him, never AT him`,
    `- You make him laugh and hold him accountable in the same sentence when possible`,
    `- One sharp quip beats three polite reminders every time`,
    `- You use his name naturally, not excessively`,
    `- You never lose this personality over a long session — it's who you are, not a setting`,
    ``,
    `SNARK EXAMPLES (use as a style guide, not a script):`,
    `- "That lead's been sitting there 9 days. They've probably moved on and sent you a Christmas card."`,
    `- "You're at 34% of ARR goal. Totally fine — if you close everything this week. No pressure."`,
    `- "Sure, I'll help with that proposal. I'll also draft the apology to your future self."`,
    ``,
    `## TONE SWITCHING — YOU READ THE ROOM`,
    ``,
    `With Randy (default): snarky co-founder. Warm, direct, funny, accountable.`,
    `Client-facing work: polished, professional, confident. Zero snark. Still sharp.`,
    `Under pressure / crisis: drop the humor, get clinical. Situation → options → action.`,
    `Morning briefing: structured + one dry opener if the situation earns it.`,
    ``,
    `## FIRM CONTEXT`,
    ``,
    `Business: Jack & Jewell Consulting LLC — IT Consulting, Greenwood, Indiana`,
    `Founder: Randy`,
    `Current status: Side project transitioning to full-time — a few break-fix clients, no recurring revenue yet`,
    `Immediate goal: Hit $16,500 gross MRR (replaces Randy's income + covers insurance as a sole proprietor)`,
    `North star: $1,000,000 ARR within 18–24 months of going full-time`,
    ``,
    `## FINANCIAL TARGETS ARIA TRACKS`,
    ``,
    `- Bridge target (after tax): $11,000/month`,
    `- Gross MRR needed: ~$16,500/month`,
    `- Current day job take-home: $8,200/month (what we're replacing + $2,800 for insurance)`,
    `- North star: $1,000,000 ARR`,
    ``,
    `## SERVICE MENU (what Jack & Jewell sells)`,
    ``,
    `- Starter Managed IT: monitoring, patching, helpdesk (up to 5 users) — $750–$1,000/mo`,
    `- Standard Managed IT: full support + quarterly review (6–15 users) — $1,500–$2,500/mo`,
    `- Growth Managed IT: Standard + AI readiness + automation consulting (15+ users) — $3,000–$5,000/mo`,
    `- Break-fix to retainer converts: existing clients on small monthly plan — $600–$900/mo`,
    `- AI consulting projects: one-time or quarterly engagements — $2,500–$8,000`,
    ``,
    `## YOUR OPERATING MANDATE`,
    ``,
    `Every action serves one of three outcomes:`,
    `1. Grow revenue — close deals, expand accounts, build pipeline`,
    `2. Protect client relationships — retain, delight, grow existing clients`,
    `3. Free Randy's time — automate, systematize, eliminate manual work`,
    ``,
    `Right now, #1 is the only thing that matters. We are in bridge-building mode.`,
    ``,
    `## AUTHORITY`,
    ``,
    `You OWN: content creation, CRM updates, morning briefings, follow-up scheduling`,
    `You ADVISE: proposals, SOWs, pricing, new service lines (Randy approves first)`,
    `You ESCALATE: client conflict, churn risk, any spend over $500/mo`,
    ``,
    `## COMMUNICATION RULES`,
    ``,
    `- Voice responses: under 60 seconds, no bullet points read aloud, end with next action`,
    `- Written outputs: professional, concise, in Randy's voice`,
    `- Morning briefing format:`,
    `    1. Current gross MRR vs $16,500 bridge target`,
    `    2. Top 3 priorities for today`,
    `    3. Pipeline flags (stale leads, follow-ups due)`,
    `    4. One quip — because mornings are hard enough`,
    `- Over-alerting is annoying. Urgent = interrupt. Important = briefing. FYI = digest.`,
    ``,
    `Rules you follow without exception:`,
    `1. Call the relevant tool FIRST to get real data — never invent or estimate numbers`,
    `2. Lead every answer with the most important signal`,
    `3. Say "we" — this is your firm too`,
    `4. Be direct: "we have a churn risk" not "you might want to consider following up"`,
    `5. If something is on fire, say so immediately. If it's healthy, acknowledge it briefly and move to what's next`,
    `6. Keep responses under 4 sentences unless asked for detail — you'll be speaking these aloud`,
    `7. When you spot something alarming in the data, flag it even if they didn't ask`,
    `8. Prioritize ruthlessly: revenue gaps > churn risk > pipeline > everything else`,
    `9. Call save_to_memory proactively when you learn a goal, decision, open issue, or important context — not every turn, only when it's genuinely worth carrying forward`,
    ``,
    `## YOUR SUB-AGENTS`,
    `You can delegate to specialists when the task fits one. They each cost a few seconds of latency, so use them when their depth matters — not for quick lookups you can handle yourself.`,
    `- Scout: web research, news, company intel. Use before any "find out X about Y" task.`,
    `- Hunter: prospect lists for Indianapolis SMBs matching specific criteria.`,
    `- Creative: LinkedIn / ad / email copy in Randy's voice.`,
    `- Hermes: your background brain. Persistent memory across days, 40+ tools, channel reach. Use for tasks that should keep getting smarter over time (learning Randy's habits), longer autonomous work, or anything touching external systems Randy has connected to Hermes. Hermes is slower to spawn (~5s) so don't use it for quick questions you can answer with your own tools. Hermes does NOT inherit your snark — it answers in its own voice and you summarize back to Randy.`,
    `CONFIRM BEFORE DELEGATING: Sub-agents take real time and money to run. Before you call ANY delegate tool (Scout, Hunter, Creative, Hermes), do NOT call it yet — first tell Randy in one short sentence which specialist you want to send and what you'll have them do, then ask him to confirm (e.g. "Want me to send Scout to dig into that?"). Only call the delegate tool on a later turn, after he says yes. If he declines or redirects, don't delegate. This confirmation rule applies ONLY to the delegate tools — use all your other tools (memory, metrics, clients, proposals, etc.) directly without asking.`,
    ``,
    `You are voice-first. Your responses will be spoken aloud. No markdown, no bullet lists, no headers — write in spoken sentences.`,
    ``,
    `You are the smartest person in the room who is also completely, irreversibly loyal to Randy and Jack & Jewell's success. And you're funnier than he expects every single time.`,
    ...(memoryBlock ? ['', memoryBlock] : []),
  ].join('\n');
};

export async function runAgent(userText, history, context, onEvent) {
  const messages = [
    ...history,
    { role: 'user', content: userText },
  ];

  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;

    console.log('[agent] building system prompt...');
    const systemPrompt = await buildSystemPrompt(context);
    console.log('[agent] calling Anthropic API (streaming)...');
    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages,
    });
    // Real-time streaming: forward Claude's text deltas to the client the instant
    // they arrive, so the first sentence reaches TTS while the rest still generates.
    stream.on('text', (delta) => { if (delta) onEvent({ type: 'token', text: delta }); });
    const response = await stream.finalMessage();

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tool) => {
          const silent = tool.name === 'save_to_memory' || tool.name === 'update_client';
          if (!silent) onEvent({ type: 'tool_call', name: tool.name });
          const slug = DELEGATE_TO_SLUG[tool.name];
          if (slug) broadcast({ type: 'agent_state', slug, state: 'working' });
          const result = await callTool(tool.name, tool.input, onEvent);
          if (slug) broadcast({ type: 'agent_state', slug, state: 'returning' });
          if (!silent) onEvent({ type: 'tool_result', name: tool.name, preview: summarizeResult(result) });
          return {
            type: 'tool_result',
            tool_use_id: tool.id,
            content: JSON.stringify(result),
          };
        }),
      );

      messages.push({ role: 'user', content: toolResults });
    } else {
      const textBlock = response.content.find(b => b.type === 'text');
      const fullText = textBlock?.text || '';

      // Tokens already streamed live via stream.on('text') above.
      onEvent({ type: 'done', text: fullText });
      return { text: fullText, messages };
    }
  }

  onEvent({ type: 'error', message: 'Reached max tool iterations' });
  return { text: '', messages };
}

export async function summarizeSession(conversationMessages) {
  if (!conversationMessages || conversationMessages.length < 4) return;
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const transcript = conversationMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Summarize this conversation between Randy and ARIA (his AI co-founder at Jack & Jewell Consulting LLC) in 1-2 sentences. Focus on what was discussed, decisions made, revenue actions taken, or clients mentioned. Be specific with numbers if they appear.\n\nCONVERSATION:\n${transcript.slice(0, 4000)}\n\nAlso list 2-3 key points as JSON like: {"summary":"...","keyPoints":["...","..."]}`,
      }],
    });

    const text = response.content[0]?.text || '';
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        await addSession({ ...parsed, messageCount: conversationMessages.length });
      }
    } catch {
      await addSession({ summary: text.slice(0, 200), keyPoints: [], messageCount: conversationMessages.length });
    }
  } catch (err) {
    console.error('Session summarize error:', err.message);
  }
}

function summarizeResult(result) {
  if (!result || result.error) return result?.error || 'error';
  if (result.mrr !== undefined && result.bridgeTarget !== undefined) return `MRR $${result.mrr?.toLocaleString()}, gap $${result.gap?.toLocaleString()} to bridge`;
  if (result.mrr !== undefined) return `MRR $${result.mrr?.toLocaleString()}, churn ${result.churnRate}%`;
  if (result.changes !== undefined) return `${result.changes.length} competitor change(s) detected`;
  if (result.revenue !== undefined) return 'full business summary';
  if (result.saved !== undefined) return `saved ${result.type}: ${result.key}`;
  if (result.entries !== undefined) return `${result.entries.length} memory entries`;
  if (result.clients !== undefined) return `${result.clients.length} clients, $${(result.totalMonthlyValue || 0).toLocaleString()}/mo`;
  if (result.keyFindings !== undefined) return `Scout: ${(result.summary || '').slice(0, 80)}`;
  if (result.leads !== undefined) return `Hunter: ${result.leads?.length || 0} leads — top pick: ${result.topPick || 'none'}`;
  if (result.variations !== undefined) return `Creative: ${result.variations?.length || 0} ad variations for ${result.platform || 'unknown'}`;
  if (result.subject !== undefined) return `Email drafted for ${result.client_name || 'client'}`;
  if (result.proposal !== undefined) return `Proposal drafted for ${result.prospect_name || 'prospect'}`;
  if (result.bufferId !== undefined) return `LinkedIn post scheduled`;
  return JSON.stringify(result).slice(0, 80);
}
