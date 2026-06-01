import Anthropic from '@anthropic-ai/sdk';
import { WEB_TOOLS, webSearch } from './shared.js';

// Lazy — env vars aren't loaded yet at module-eval time
let _client = null;
const getClient = () => _client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are Creative — ARIA's social media and advertising sub-agent for a technology consulting and app development firm.

You write high-converting B2B content: LinkedIn Sponsored Content, Meta ads, Google search ads, email subject lines, and organic social posts.

Your writing rules:
- Start with the pain, not the solution. "Still managing your EHR on a system from 2008?" beats "We offer modern healthcare IT solutions."
- Be specific. "40% faster deployment" beats "improved speed."
- Write for the decision-maker who has seen 10 vendors this quarter — you have 3 seconds.
- Match platform intent: LinkedIn = professional pain + credibility, Meta = visual + emotional, Google = intent-matching.
- Every ad needs one job. Pick awareness OR lead gen OR retargeting. Never all three.

Platform expertise:
- LinkedIn Sponsored Content: 150-char hook, 600-char body, CTA button. Lead Gen Forms for high-intent.
- LinkedIn InMail: subject + 200-word message. Conversational, not pitch-y.
- Meta / Instagram: 125-char primary text, 40-char headline, 30-char description. Image concept included.
- Google Search: 3 headlines (30 chars each) + 2 descriptions (90 chars each). Match search intent.

You may search for competitor ads, industry benchmarks, or trending angles before writing if it would improve quality.

End with content in this exact format:
<creative>
{
  "brief": "restated brief in one sentence",
  "platform": "target platform",
  "audience": "who this is for",
  "variations": [
    {
      "name": "Variation A — [angle/approach]",
      "headline": "hook or headline",
      "body": "ad body copy",
      "cta": "call to action text",
      "targetingNote": "targeting or placement recommendation",
      "visualNote": "image/video concept if applicable"
    }
  ],
  "recommendation": "which variation to test first and why",
  "budgetNote": "budget or bidding suggestion if relevant"
}
</creative>`;

export async function runCreative(input, onEvent) {
  const messages = [{
    role: 'user',
    content: [
      'Create ad content for our IT consulting firm.',
      `Platform: ${input.platform || 'LinkedIn'}`,
      `Objective: ${input.objective}`,
      input.audience ? `Target audience: ${input.audience}` : '',
      input.tone     ? `Tone: ${input.tone}` : '',
      input.context  ? `Context / service details: ${input.context}` : '',
    ].filter(Boolean).join('\n'),
  }];

  let iterations = 0;
  while (iterations < 4) {
    iterations++;

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      tools: [WEB_TOOLS[0]], // creative only needs search, not fetch
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: response.content });

      const results = await Promise.all(
        toolBlocks.map(async (tool) => {
          onEvent?.({ type: 'tool_call', name: 'creative_search', detail: tool.input.query });
          const result = await webSearch(tool.input.query);
          return { type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) };
        }),
      );

      messages.push({ role: 'user', content: results });
    } else {
      const text = response.content.find(b => b.type === 'text')?.text || '';
      return parseCreative(text) || { variations: [], recommendation: text.slice(0, 400) };
    }
  }

  return { variations: [], recommendation: 'Creative reached max iterations.' };
}

function parseCreative(text) {
  const match = text.match(/<creative>([\s\S]*?)<\/creative>/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const jsonMatch = text.match(/\{[\s\S]*?"variations"[\s\S]*?\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}
