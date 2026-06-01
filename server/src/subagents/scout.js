import Anthropic from '@anthropic-ai/sdk';
import { WEB_TOOLS, webSearch, fetchPage } from './shared.js';

// Lazy — env vars aren't loaded yet at module-eval time
let _client = null;
const getClient = () => _client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are Scout — ARIA's intelligence and research sub-agent.

Your job: find the truth fast. When given a research task, search systematically, read what matters, and return a structured briefing. You never guess — you verify.

Research instincts:
- Use 2–4 targeted queries, not one broad one
- When a search result looks directly relevant, fetch it for depth
- Cross-reference: if two independent sources confirm something, confidence goes up
- Look for recency — flag if information is stale or contradictory
- Be specific with numbers, dates, names — vague generalities are useless
- Note what you couldn't find — intelligence gaps matter

End your response with findings in this exact format:
<findings>
{
  "subject": "what was researched",
  "summary": "2–3 specific sentences — use real names, numbers, and dates",
  "keyFindings": ["finding with specifics", "finding with specifics"],
  "sources": ["url1", "url2"],
  "confidence": "high | medium | low",
  "flagged": "anything urgent, surprising, or time-sensitive — or null"
}
</findings>`;

export async function runScout(task, focus, onEvent) {
  const messages = [{
    role: 'user',
    content: `Research task: ${task}${focus ? `\nFocus area: ${focus}` : ''}`,
  }];

  let iterations = 0;
  while (iterations < 6) {
    iterations++;

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      tools: WEB_TOOLS,
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: response.content });

      const results = await Promise.all(
        toolBlocks.map(async (tool) => {
          const isSearch = tool.name === 'web_search';
          // Emit sub-agent activity — no tool_result so the spinner stays active
          onEvent?.({
            type: 'tool_call',
            name: isSearch ? 'scout_web_search' : 'scout_fetch_page',
            detail: isSearch ? tool.input.query : tool.input.url,
          });
          const result = isSearch
            ? await webSearch(tool.input.query)
            : await fetchPage(tool.input.url);
          return { type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) };
        }),
      );

      messages.push({ role: 'user', content: results });
    } else {
      const text = response.content.find(b => b.type === 'text')?.text || '';
      return parseFindings(text) || { summary: text.slice(0, 500), keyFindings: [], confidence: 'low' };
    }
  }

  return { summary: 'Scout reached max iterations without conclusive findings.', keyFindings: [], confidence: 'low' };
}

// Called by monitor.js every 4 hours to surface client news
const alertedToday = new Set();

export async function scoutMonitor(clients, broadcast) {
  if (!process.env.SERPER_API_KEY) return;

  const today = new Date().toDateString();
  const active = clients.filter(c => c.status === 'active' || c.status === 'at-risk').slice(0, 5);

  for (const c of active) {
    const key = `${today}:${c.name}`;
    if (alertedToday.has(key)) continue;

    try {
      const results = await webSearch(`"${c.name}" news announcement`);
      if (!Array.isArray(results)) continue;

      // Only fire on dated news results (Serper attaches dates to Google News items)
      const news = results.filter(r => r.date && r.url && !r.type);
      if (!news.length) continue;

      alertedToday.add(key);
      broadcast({
        type: 'alert',
        severity: 'info',
        title: `Scout: ${c.name} in the news`,
        body: `${news[0].title}. ${(news[0].snippet || '').slice(0, 100)}`,
        data: { source: 'scout', client: c.name, url: news[0].url },
      });
    } catch {}
  }
}

function parseFindings(text) {
  const match = text.match(/<findings>([\s\S]*?)<\/findings>/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const jsonMatch = text.match(/\{[\s\S]*?"summary"[\s\S]*?\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}
