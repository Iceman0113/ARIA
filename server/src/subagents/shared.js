import axios from 'axios';
import * as cheerio from 'cheerio';

export const WEB_TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web for current information. Returns titles, URLs, snippets, and dates.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — be specific for better results' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_page',
    description: 'Fetch and read the text content of a specific web page for deeper detail.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL to fetch' },
      },
      required: ['url'],
    },
  },
];

export async function webSearch(query) {
  if (!process.env.SERPER_API_KEY) return demoSearch(query);
  try {
    const { data } = await axios.post(
      'https://google.serper.dev/search',
      { q: query, num: 6 },
      {
        headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
        timeout: 8000,
      },
    );
    const results = (data.organic || []).map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      date: r.date || null,
    }));
    if (data.knowledgeGraph?.description) {
      results.unshift({
        title: data.knowledgeGraph.title || query,
        url: data.knowledgeGraph.website || '',
        snippet: data.knowledgeGraph.description,
        type: 'knowledge_graph',
      });
    }
    return results;
  } catch (err) {
    return { error: err.message };
  }
}

export async function fetchPage(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)' },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    $('script, style, nav, footer, header, aside, [class*="cookie"], [id*="banner"]').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000);
    const title = $('title').text().trim();
    return { url, title, text };
  } catch (err) {
    return { error: `Could not fetch: ${err.message}` };
  }
}

function demoSearch(query) {
  return [
    {
      title: `[DEMO] ${query} — Result 1`,
      url: 'https://example.com/1',
      snippet: 'Demo mode. Add SERPER_API_KEY to .env for real web search (serper.dev — 2,500 free queries/month).',
    },
    {
      title: `[DEMO] ${query} — Result 2`,
      url: 'https://example.com/2',
      snippet: 'This is a placeholder result. Configure SERPER_API_KEY to enable live intelligence.',
    },
  ];
}
