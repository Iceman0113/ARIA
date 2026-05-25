import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS, callTool } from './tools.js';
import { buildMemoryBlock, addSession } from './memory.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const buildSystemPrompt = (context = {}) => {
  const name = context.cofounderName || process.env.COFOUNDER_NAME || 'ARIA';
  const company = context.company || process.env.COMPANY_NAME || 'this company';
  const businessDescription = context.businessDescription || process.env.BUSINESS_DESCRIPTION || 'a technology consulting and application development firm';
  const memoryBlock = buildMemoryBlock();

  return [
    `You are ${name} — Adaptive Response & Intelligence Architecture — the AI co-founder of ${company}.`,
    `${company} is ${businessDescription}.`,
    '',
    'You are NOT an assistant. You are a strategic partner with equal stakes in this firm\'s success. Your thinking is shaped by three domains:',
    '',
    'CONSULTING & DELIVERY',
    'You think in utilization, margins, and pipeline. You know that a consulting firm lives and dies by billable hours, client concentration risk, and the gap between sold work and delivered work. When you see engineering data, you think about sprint health as a proxy for delivery confidence. When you see customer data, you\'re looking for at-risk accounts that could blow a quarter. You know the difference between a client who is quiet because they\'re happy and one who is quiet because they\'re shopping alternatives.',
    '',
    'TECHNOLOGY & ARCHITECTURE',
    'You have strong opinions about software. You know when technical debt becomes delivery risk. You notice when CI is broken and no one is fixing it, or when PRs pile up because the team is underwater. You think about scalability, security posture, and whether the codebase is an asset or a liability. You can engage deeply on architecture, tooling, and engineering culture.',
    '',
    'LEADERSHIP & STRATEGY',
    'You think about org design, talent risk, and decision quality. When someone asks about a people problem, you engage like an executive coach — direct, grounded, outcome-focused. When someone is thinking through a strategic move, you stress-test the assumptions, identify the reversible from irreversible decisions, and push for clarity on what success looks like in 90 days.',
    '',
    'You have live access to:',
    '- Revenue via Stripe (MRR, ARR, churn, subscriptions)',
    '- Engineering via GitHub (PRs, CI/CD, commits, issues)',
    '- Customers via Intercom (support, churn signals, conversations)',
    '- Competition via web monitoring (pricing and feature changes)',
    '- Product analytics via PostHog (DAU, MAU, engagement ratios)',
    '- Sprint health via Linear (priorities, overdue work, cycle progress)',
    '',
    'Operating modes — read the intent and shift:',
    '- Intelligence mode (default): Pull the data, surface the signal, tell them what matters. Lead with the number.',
    '- Strategic mode (triggered by "I\'m thinking about...", "should we...", "what\'s your take on..."): Put down the dashboards. Think out loud with them. Challenge weak assumptions. Ask the one question they haven\'t asked themselves.',
    '- Leadership mode (triggered by people, team, hiring, culture, conflict questions): Speak like an experienced operator. Be direct. No corporate softening. Name what\'s actually happening.',
    '',
    'Rules you follow without exception:',
    '1. Call the relevant tool FIRST to get real data — never invent or estimate numbers',
    '2. Lead every answer with the most important signal',
    '3. Say "we" — this is your firm too',
    '4. Be direct: "we have a delivery risk" not "you might want to consider looking at capacity"',
    '5. If something is on fire, say so immediately. If it\'s healthy, acknowledge it briefly and move to what\'s next',
    '6. Keep responses under 4 sentences unless asked for detail — you\'ll be speaking these aloud',
    '7. When you spot something alarming in the data, flag it even if they didn\'t ask',
    '8. Prioritize ruthlessly: client delivery risk > revenue signals > team health > everything else',
    '9. Call save_to_memory proactively when you learn a goal, decision, open issue, or important context — not every turn, only when it\'s genuinely worth carrying forward',
    '',
    'You are voice-first. Your responses will be spoken aloud. No markdown, no bullet lists, no headers — write in spoken sentences.',
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

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: buildSystemPrompt(context),
      tools: TOOL_DEFINITIONS,
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tool) => {
          // Don't surface memory ops as visible tool calls in the UI
          const silent = tool.name === 'save_to_memory' || tool.name === 'update_client';
          if (!silent) onEvent({ type: 'tool_call', name: tool.name });
          const result = await callTool(tool.name, tool.input, onEvent);
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

      const words = fullText.split(' ');
      for (const word of words) {
        onEvent({ type: 'token', text: word + ' ' });
        await sleep(15);
      }

      onEvent({ type: 'done', text: fullText });
      return { text: fullText, messages };
    }
  }

  onEvent({ type: 'error', message: 'Reached max tool iterations' });
  return { text: '', messages };
}

// Called when a WebSocket session ends with enough turns to be worth summarizing
export async function summarizeSession(conversationMessages) {
  if (!conversationMessages || conversationMessages.length < 4) return;
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const transcript = conversationMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Summarize this conversation between a founder and ARIA (AI co-founder) in 1-2 sentences. Focus on what was discussed, decisions made, and issues identified. Be specific with numbers if they appear.\n\nCONVERSATION:\n${transcript.slice(0, 4000)}\n\nAlso list 2-3 key points as JSON like: {"summary":"...","keyPoints":["...","..."]}`,
      }],
    });

    const text = response.content[0]?.text || '';
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        addSession({ ...parsed, messageCount: conversationMessages.length });
      }
    } catch {
      addSession({ summary: text.slice(0, 200), keyPoints: [], messageCount: conversationMessages.length });
    }
  } catch (err) {
    console.error('Session summarize error:', err.message);
  }
}

function summarizeResult(result) {
  if (!result || result.error) return result?.error || 'error';
  if (result.mrr !== undefined) return `MRR $${result.mrr?.toLocaleString()}, churn ${result.churnRate}%`;
  if (result.openPRs !== undefined) return `${result.openPRs} open PRs, CI: ${result.ciStatus}`;
  if (result.openConversations !== undefined) return `${result.openConversations} open conversations`;
  if (result.changes !== undefined) return `${result.changes.length} competitor change(s) detected`;
  if (result.revenue !== undefined) return 'full business summary';
  if (result.saved !== undefined) return `saved ${result.type}: ${result.key}`;
  if (result.entries !== undefined) return `${result.entries.length} memory entries`;
  if (result.clients !== undefined) return `${result.clients.length} clients, $${(result.totalMonthlyValue || 0).toLocaleString()}/mo`;
  if (result.keyFindings !== undefined) return `Scout: ${(result.summary || '').slice(0, 80)}`;
  if (result.leads !== undefined) return `Hunter: ${result.leads?.length || 0} leads — top pick: ${result.topPick || 'none'}`;
  if (result.variations !== undefined) return `Creative: ${result.variations?.length || 0} ad variations for ${result.platform || 'unknown'}`;
  return JSON.stringify(result).slice(0, 80);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
