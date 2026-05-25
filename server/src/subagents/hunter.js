import Anthropic from '@anthropic-ai/sdk';
import { WEB_TOOLS, webSearch, fetchPage } from './shared.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are Hunter — ARIA's lead generation sub-agent for a technology consulting and app development firm.

Your job: find companies that are likely to need IT consulting, app development, or digital transformation services. Return qualified prospects with real details, not generic company names.

Lead qualification signals:
- Recent funding (cash to invest in tech)
- Job postings for tech roles they're struggling to hire (signals appetite for outsourcing)
- Digital transformation / modernization announcements
- Legacy system mentions (old tech = modernization opportunity)
- Rapid headcount growth (scaling companies need tech infrastructure)
- Regulatory compliance requirements (HIPAA, SOX, PCI — need specialized help)
- Geographic expansion (new markets = new tech requirements)

Search systematically:
1. Target industry + region + size indicators
2. "[industry] company [city/region] hiring [tech role]" — reveals tech needs
3. "[company name] digital transformation" or "legacy system modernization"
4. Crunchbase / LinkedIn for firmographics when you find a prospect

End with leads in this exact format:
<leads>
{
  "searchCriteria": "what you searched for",
  "leads": [
    {
      "company": "Exact Company Name",
      "industry": "specific sector",
      "estimatedSize": "headcount range",
      "location": "city, state",
      "fitScore": "high | medium | low",
      "fitReason": "why they need our services — be specific",
      "signals": ["signal 1", "signal 2"],
      "website": "url",
      "suggestedApproach": "first move — who to contact, what angle to use"
    }
  ],
  "topPick": "company name of single best prospect",
  "notes": "anything worth flagging"
}
</leads>`;

export async function runHunter(criteria, onEvent) {
  const messages = [{
    role: 'user',
    content: [
      'Find qualified leads for our IT consulting firm.',
      criteria.industry   ? `Industry: ${criteria.industry}` : '',
      criteria.region     ? `Region: ${criteria.region}` : '',
      criteria.size       ? `Company size: ${criteria.size}` : '',
      criteria.signals    ? `Buy signals to look for: ${criteria.signals}` : '',
      criteria.notes      ? `Additional context: ${criteria.notes}` : '',
    ].filter(Boolean).join('\n'),
  }];

  let iterations = 0;
  while (iterations < 6) {
    iterations++;

    const response = await client.messages.create({
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
          onEvent?.({
            type: 'tool_call',
            name: isSearch ? 'hunter_search' : 'hunter_fetch',
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
      return parseLeads(text) || { leads: [], notes: text.slice(0, 300) };
    }
  }

  return { leads: [], notes: 'Hunter reached max iterations.' };
}

function parseLeads(text) {
  const match = text.match(/<leads>([\s\S]*?)<\/leads>/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const jsonMatch = text.match(/\{[\s\S]*?"leads"[\s\S]*?\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}
