import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import Stripe from 'stripe';
import { getClient } from './anthropic.js';
import { upsertEntry, resolveIssue, getMemory } from './memory.js';
import { getClients, upsertClient } from './clients.js';
import { runScout } from './subagents/scout.js';
import { runHunter } from './subagents/hunter.js';
import { runCreative } from './subagents/creative.js';
import { runHermes } from './subagents/hermes.js';
import { publishPost as publishLinkedInPost, loadAuth as loadLinkedInAuth, getTargets as getLinkedInTargets } from './linkedin.js';

// ── Tool definitions for Claude ───────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'get_revenue_metrics',
    description: 'Get live revenue metrics from Stripe: MRR, ARR, active subscriptions, new subscriptions, churn, failed payments. Always call this when asked about money, revenue, growth, subscriptions, or business health.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d', '90d'],
          description: 'Time period for new/canceled subscription counts',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'track_mrr_vs_bridge',
    description: 'Calculate current gross MRR from all active clients vs the $16,500 bridge target. Shows gap, percentage complete, and how many more clients needed at current average. Call for any revenue status question, morning briefing, or pipeline check.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'check_competitors',
    description: 'Check for recent changes detected on competitor websites (pricing, features, announcements). Call when asked about competitors or market.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_business_summary',
    description: 'Get a full snapshot of all current metrics: revenue, clients, and competitor monitoring. Use when asked for an overall update or morning briefing.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'save_to_memory',
    description: 'Save something important to your persistent memory across sessions. Call this proactively when you learn a goal, a decision is made, an issue is identified, or important context is shared. Do NOT save trivial information — only things that would change how you advise Randy.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['goal', 'decision', 'issue', 'context', 'preference'],
          description: 'goal=company target, decision=choice made, issue=ongoing problem to track, context=important fact, preference=how they like to work',
        },
        key: {
          type: 'string',
          description: 'Short snake_case identifier, e.g. "mrr_target" or "stale_lead_acme"',
        },
        value: {
          type: 'string',
          description: 'What to remember, written as a complete sentence',
        },
        resolved: {
          type: 'boolean',
          description: 'For issues only: set true if the issue has been resolved',
        },
      },
      required: ['type', 'key', 'value'],
    },
  },
  {
    name: 'get_memory',
    description: 'Retrieve everything in your persistent memory: goals, decisions, known issues, context, and recent session summaries. Call when asked what you remember, or to check past context before advising.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'delegate_to_scout',
    description: 'Hand off a research task to Scout, your web intelligence sub-agent. Scout searches the web, reads pages, and returns a structured briefing. Use when asked to research a company, find news about a client, investigate a technology, or gather intel before a meeting.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Specific research task. Be detailed: "Research Acme Corp — recent news, leadership, tech stack, any signs of IT pain points" or "Find Indianapolis SMBs in manufacturing with 10–50 employees."',
        },
        focus: {
          type: 'string',
          enum: ['company', 'market', 'technology', 'news', 'general'],
          description: 'Research focus to guide Scout\'s approach',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'delegate_to_hunter',
    description: 'Hand off a lead generation task to Hunter, your prospecting sub-agent. Hunter searches for qualified SMBs in the Indianapolis/Greenwood area that match given criteria and returns structured prospects with fit scores. Use when asked to find new clients or build a prospect list.',
    input_schema: {
      type: 'object',
      properties: {
        industry: { type: 'string', description: 'Target industry or sector, e.g. "accounting", "legal", "manufacturing", "healthcare"' },
        region: { type: 'string', description: 'Geographic target — default to "Indianapolis/Greenwood Indiana" if not specified' },
        size: { type: 'string', description: 'Company size range, e.g. "5–50 employees", "small business"' },
        signals: { type: 'string', description: 'Buying signals to look for, e.g. "no dedicated IT staff, growing headcount, recent tech issues"' },
        notes: { type: 'string', description: 'Any additional context or specific requirements' },
      },
      required: ['industry'],
    },
  },
  {
    name: 'delegate_to_hermes',
    description: 'Hand off a task to Hermes — your background agent with persistent memory, 40+ tools, and channel reach. Hermes is good at: things you want remembered across days (learning your habits), longer autonomous work that doesn\'t need real-time voice, tasks that touch external systems Randy has connected (MCP servers, channel integrations), and anything where "the agent should keep getting better at this" matters. Hermes is NOT the right tool for: quick lookups (use your own tools), Randy-facing snark or persona (you handle that), or anything time-critical where a 5–10s spawn cost is too much.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The full task instruction for Hermes. Be specific and self-contained — Hermes doesn\'t see your conversation with Randy. Include any context Hermes needs (client name, target, deadline, expected output format).',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'delegate_to_creative',
    description: 'Hand off a content or ad brief to Creative, your content sub-agent. Creative writes LinkedIn posts, email copy, and ad variations in Randy\'s voice. Use when asked to write posts, draft outreach, or develop social media content.',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['linkedin', 'meta', 'google', 'general'],
          description: 'Target platform',
        },
        objective: { type: 'string', description: 'Campaign goal: awareness, lead gen, thought leadership, client win announcement' },
        audience: { type: 'string', description: 'Target audience, e.g. "small business owners in Indianapolis who handle their own IT"' },
        tone: { type: 'string', description: 'Desired tone: authoritative, conversational, educational' },
        context: { type: 'string', description: 'Service being promoted, any offer or hook, relevant context about Jack & Jewell' },
      },
      required: ['objective'],
    },
  },
  {
    name: 'get_client_roster',
    description: 'Get the full client roster: all clients/contacts with their status, monthly value, tier, and notes. Call when asked about clients, accounts, who owes follow-up, or who is at risk.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_client',
    description: 'Create a new client/contact or update an existing one in the roster. Use when you learn about a new prospect, when a client status changes, or when there is new information about an account. Omit id to create new.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Existing client ID to update — omit to create a new client' },
        name: { type: 'string', description: 'Client or company name' },
        status: {
          type: 'string',
          enum: ['lead', 'prospect', 'active', 'at-risk', 'churned'],
          description: 'lead=new, prospect=in conversation, active=paying client, at-risk=churn signal, churned=lost',
        },
        client_type: {
          type: 'string',
          enum: ['break-fix', 'starter', 'standard', 'growth', 'ai-consulting'],
          description: 'Service tier this client is on or being pitched',
        },
        mrr: { type: 'number', description: 'Monthly recurring revenue from this client in USD' },
        email: { type: 'string', description: 'Primary contact email' },
        phone: { type: 'string', description: 'Primary contact phone' },
        notes: { type: 'string', description: 'Latest notes, signals, or context about this client' },
      },
      required: [],
    },
  },
  {
    name: 'draft_conversion_email',
    description: 'Draft a personalized email to convert an existing break-fix client to a monthly managed services retainer. Call when Randy wants to pitch a retainer to a current client.',
    input_schema: {
      type: 'object',
      properties: {
        client_name: { type: 'string', description: 'Name of the client or company' },
        client_context: { type: 'string', description: 'What you know about them — history, pain points, recent work done, relationship length' },
        recommended_tier: {
          type: 'string',
          enum: ['starter', 'standard', 'growth'],
          description: 'Which tier to pitch',
        },
      },
      required: ['client_name', 'recommended_tier'],
    },
  },
  {
    name: 'generate_proposal',
    description: 'Generate a complete managed services proposal from call notes. Call after Randy has a prospect conversation and wants a professional proposal drafted.',
    input_schema: {
      type: 'object',
      properties: {
        prospect_name: { type: 'string', description: 'Name of the prospect or company' },
        call_notes: { type: 'string', description: "Randy's raw notes from the discovery call" },
        recommended_tier: {
          type: 'string',
          enum: ['starter', 'standard', 'growth'],
          description: 'Which tier to propose',
        },
        user_count: { type: 'number', description: 'Number of users at the company' },
      },
      required: ['prospect_name', 'call_notes', 'recommended_tier'],
    },
  },
  {
    name: 'publish_to_linkedin',
    description: 'Publish a post DIRECTLY to LinkedIn via the official API. Randy can post as himself OR as a Company Page he admins (like Jack & Jewell). Use ONLY after Randy has explicitly approved the exact text AND confirmed who he wants to post as — call get_linkedin_targets first if you don\'t know what Pages are available. Posts are immediate, not scheduled, and there is no undo from the API.',
    input_schema: {
      type: 'object',
      properties: {
        content:   { type: 'string', description: 'The exact final post text Randy approved. Word-for-word.' },
        author:    {
          type: 'string',
          description: 'Who to post as. "person" or "me" = Randy\'s personal feed (default). "organization" or "page" = his admin\'d Company Page (or the only one if there\'s exactly one). To pick a specific Page, pass the Page name (e.g. "Jack & Jewell"), the vanity URL slug, or the full URN (urn:li:organization:NNNN). Returns an error if author is invalid.',
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS'],
          description: 'PUBLIC = anyone on LinkedIn can see; CONNECTIONS = only Randy\'s 1st-degree network. Default PUBLIC for business-development posts. (Company Page posts are always PUBLIC.)',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'check_linkedin_connection',
    description: 'Check whether Randy\'s LinkedIn is connected (auth tokens stored) and when the token expires. Call this before posting if you\'re not sure, or when Randy asks "is LinkedIn connected?"',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_linkedin_targets',
    description: 'Get the list of who Randy can post as on LinkedIn — his personal account plus any Company Pages he admins (like Jack & Jewell). Call this BEFORE publish_to_linkedin if Randy hasn\'t said which identity to use, or when he asks "who can ARIA post as?"',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

// ── Tool dispatcher ───────────────────────────────────────────────

export async function callTool(name, input, onEvent) {
  switch (name) {
    case 'get_revenue_metrics':    return getRevenueMetrics(input.period || '30d');
    case 'track_mrr_vs_bridge':    return trackMrrVsBridge();
    case 'save_to_memory':         return upsertEntry(input);
    case 'get_memory':             return getMemory();
    case 'check_competitors':      return checkCompetitors();
    case 'delegate_to_scout':      return runScout(input.task, input.focus, onEvent);
    case 'delegate_to_hunter':     return runHunter(input, onEvent);
    case 'delegate_to_creative':   return runCreative(input, onEvent);
    case 'delegate_to_hermes':     return runHermes(input, onEvent);
    case 'get_client_roster':      return getClients();
    case 'update_client':          return upsertClient(input);
    case 'draft_conversion_email': return draftConversionEmail(input);
    case 'generate_proposal':      return generateProposal(input);
    case 'publish_to_linkedin':    return publishLinkedInPost(input);
    case 'get_linkedin_targets':   return getLinkedInTargets();
    case 'check_linkedin_connection': {
      const auth = await loadLinkedInAuth();
      if (!auth) return { connected: false, action: 'Visit http://localhost:3001/auth/linkedin to authorize.' };
      const expiresAt = new Date(auth.expires_at).getTime();
      return {
        connected: true,
        memberUrn: auth.member_urn,
        expiresAt: auth.expires_at,
        daysUntilExpiry: Math.floor((expiresAt - Date.now()) / 86400000),
      };
    }
    case 'get_business_summary': {
      const [revenue, mrr, clients, competitors] = await Promise.all([
        getRevenueMetrics('30d'),
        trackMrrVsBridge(),
        getClients(),
        checkCompetitors(),
      ]);
      return { revenue, mrr, clients, competitors };
    }
    // Phase 1 disabled integrations
    case 'get_engineering_status':
      return { disabled: true, message: 'GitHub integration enabled in Phase 3' };
    case 'get_customer_health':
      return { disabled: true, message: 'Intercom integration enabled in Phase 3' };
    case 'get_product_analytics':
      return { disabled: true, message: 'PostHog integration enabled in Phase 4' };
    case 'get_sprint_health':
      return { disabled: true, message: 'Linear integration enabled in Phase 3' };
    default: return { error: `Unknown tool: ${name}` };
  }
}

export async function getAllMetrics() {
  try {
    const [revenue, mrr, clients, competitors] = await Promise.all([
      getRevenueMetrics('30d'),
      trackMrrVsBridge(),
      getClients(),
      checkCompetitors(),
    ]);
    return { revenue, mrr, clients, competitors, updatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

// ── Stripe ────────────────────────────────────────────────────────

async function getRevenueMetrics(period) {
  if (!process.env.STRIPE_SECRET_KEY) return demoRevenue(period);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const periodSeconds = { today: 86400, '7d': 7 * 86400, '30d': 30 * 86400, '90d': 90 * 86400 };
    const since = Math.floor(Date.now() / 1000) - periodSeconds[period];

    const [activeSubs, newSubs, canceledSubs] = await Promise.all([
      stripe.subscriptions.list({ status: 'active', limit: 100 }),
      stripe.subscriptions.list({ created: { gte: since }, limit: 100 }),
      stripe.subscriptions.list({ status: 'canceled', canceled_at: { gte: since }, limit: 100 }),
    ]);

    const mrr = activeSubs.data.reduce((sum, sub) => {
      return sum + sub.items.data.reduce((s, item) => {
        const amount = (item.price.unit_amount || 0) / 100;
        const interval = item.price.recurring?.interval;
        const monthly = interval === 'year' ? amount / 12 : interval === 'week' ? amount * 52 / 12 : amount;
        return s + monthly;
      }, 0);
    }, 0);

    const totalActive = activeSubs.data.length;
    const churnRate = totalActive > 0 ? (canceledSubs.data.length / totalActive * 100) : 0;

    return {
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      activeSubscriptions: totalActive,
      newSubscriptions: newSubs.data.length,
      canceledSubscriptions: canceledSubs.data.length,
      churnRate: parseFloat(churnRate.toFixed(2)),
      period,
      currency: 'USD',
      demo: false,
    };
  } catch (err) {
    return { error: err.message, demo: false };
  }
}

// ── MRR vs Bridge Target ──────────────────────────────────────────

async function trackMrrVsBridge() {
  const bridgeTarget = Number(process.env.BRIDGE_MRR_TARGET) || 16500;

  try {
    const { clients, totalMonthlyValue } = await getClients();
    const activeClients = (clients || []).filter(c => c.status === 'active' || c.status === 'at-risk');
    const grossMrr = totalMonthlyValue || 0;
    const gap = bridgeTarget - grossMrr;
    const pct = parseFloat(((grossMrr / bridgeTarget) * 100).toFixed(1));
    const avgMrr = activeClients.length > 0 ? grossMrr / activeClients.length : 0;
    const clientsNeeded = avgMrr > 0 ? Math.ceil(gap / avgMrr) : null;

    return {
      grossMrr,
      bridgeTarget,
      gap: Math.max(0, gap),
      percentComplete: pct,
      activeClientCount: activeClients.length,
      avgMrrPerClient: Math.round(avgMrr),
      clientsNeededToClose: clientsNeeded,
      onTrack: grossMrr >= bridgeTarget,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Competitor monitoring ─────────────────────────────────────────

const HASHES_FILE = './competitor-hashes.json';

function loadHashes() {
  try { return JSON.parse(readFileSync(HASHES_FILE, 'utf-8')); } catch { return {}; }
}

function saveHashes(hashes) {
  try { writeFileSync(HASHES_FILE, JSON.stringify(hashes, null, 2)); } catch {}
}

async function checkCompetitors() {
  const urls = (process.env.COMPETITOR_URLS || '').split(',').map(u => u.trim()).filter(Boolean);
  if (!urls.length) return demoCompetitors();

  const hashes = loadHashes();
  const results = [];

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BusinessMonitor/1.0)' },
        timeout: 10000,
      });
      const $ = cheerio.load(data);
      $('script,style,nav,footer,header').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const hash = crypto.createHash('sha256').update(text).digest('hex');

      const changed = hashes[url] && hashes[url].hash !== hash;
      results.push({
        url,
        changed,
        lastChecked: new Date().toISOString(),
        firstSeen: hashes[url]?.firstSeen || new Date().toISOString(),
      });
      hashes[url] = { hash, firstSeen: hashes[url]?.firstSeen || new Date().toISOString() };
    } catch {
      results.push({ url, changed: false, error: 'Could not fetch' });
    }
  }

  saveHashes(hashes);
  return {
    competitors: results,
    changes: results.filter(r => r.changed),
    lastChecked: new Date().toISOString(),
    demo: false,
  };
}

// ── Draft conversion email (Claude sub-call) ──────────────────────

async function draftConversionEmail({ client_name, client_context, recommended_tier }) {
  const tierDetails = {
    starter:  { name: 'Starter Managed IT', price: '$750–$1,000/month', users: 'up to 5 users', includes: 'monitoring, patching, and helpdesk support' },
    standard: { name: 'Standard Managed IT', price: '$1,500–$2,500/month', users: '6–15 users', includes: 'full managed IT support plus a quarterly strategy review' },
    growth:   { name: 'Growth Managed IT', price: '$3,000–$5,000/month', users: '15+ users', includes: 'full managed IT, AI readiness assessment, and automation consulting' },
  };
  const tier = tierDetails[recommended_tier] || tierDetails.starter;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `You are writing a professional email on behalf of Randy at Jack & Jewell Consulting LLC, based in Greenwood, Indiana. Randy has an existing relationship with this client through break-fix IT work and is proposing a shift to a monthly managed services retainer. The email should be warm, direct, and specific — not generic. It should feel like it came from a person who knows the client, not a template. No fluff, no hard sell. Focus on their specific situation and the value of predictable IT costs. Sign it as Randy.`,
      messages: [{
        role: 'user',
        content: `Write a break-fix to retainer conversion email for ${client_name}.

Client context: ${client_context || 'Existing break-fix client with no additional context provided.'}

Tier to pitch: ${tier.name} — ${tier.price} per month, ${tier.users}, includes ${tier.includes}.

The email should:
1. Reference the existing relationship naturally
2. Name a real pain from break-fix (unpredictable costs, reactive firefighting)
3. Explain what the ${tier.name} plan covers in plain language
4. Give a clear price
5. End with a low-pressure next step (a 15-minute call)

Keep it under 200 words. No filler.`,
      }],
    });

    const body = response.content[0]?.text || '';
    return {
      client_name,
      recommended_tier,
      tier_name: tier.name,
      price_range: tier.price,
      subject: `A different way to think about IT costs, ${client_name}`,
      body,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Generate MSP proposal (Claude sub-call) ───────────────────────

async function generateProposal({ prospect_name, call_notes, recommended_tier, user_count }) {
  const tierDetails = {
    starter:  { name: 'Starter Managed IT', price_low: 750, price_high: 1000, users: 'up to 5 users', includes: ['24/7 endpoint monitoring', 'monthly patching and updates', 'helpdesk support (business hours)'] },
    standard: { name: 'Standard Managed IT', price_low: 1500, price_high: 2500, users: '6–15 users', includes: ['Everything in Starter', 'Unlimited helpdesk support', 'Network monitoring and management', 'Quarterly IT strategy review'] },
    growth:   { name: 'Growth Managed IT', price_low: 3000, price_high: 5000, users: '15+ users', includes: ['Everything in Standard', 'AI readiness assessment', 'Process automation consulting', 'Monthly executive IT briefing'] },
  };
  const tier = tierDetails[recommended_tier] || tierDetails.starter;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are writing a professional managed services proposal on behalf of Randy at Jack & Jewell Consulting LLC, based in Greenwood, Indiana. The proposal should be clear, specific to the prospect's situation, and focused on business outcomes — not technical specs. Write in a confident but approachable tone. This is a small business talking to another small business.`,
      messages: [{
        role: 'user',
        content: `Write a complete MSP proposal for ${prospect_name}.

Discovery call notes: ${call_notes}

Recommended plan: ${tier.name}
Price range: $${tier.price_low}–$${tier.price_high}/month
User count: ${user_count || 'not specified'}
Includes: ${tier.includes.join(', ')}

Structure the proposal as:
1. Executive summary (2–3 sentences specific to their situation)
2. The problem we're solving (based on call notes)
3. Our proposed solution (${tier.name} plan — what it covers)
4. Investment (monthly price, what's included)
5. Why Jack & Jewell (2–3 differentiators — local, responsive, no nickel-and-diming)
6. Next steps (sign and we start within 5 business days)

Write it as a document they could read top-to-bottom. Professional but not stuffy. Under 500 words.`,
      }],
    });

    const proposal = response.content[0]?.text || '';
    return {
      prospect_name,
      recommended_tier,
      tier_name: tier.name,
      price_range: `$${tier.price_low}–$${tier.price_high}/month`,
      proposal,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Buffer API — LinkedIn scheduling ─────────────────────────────

async function scheduleLinkedInPost({ content, schedule_time }) {
  if (!process.env.BUFFER_ACCESS_TOKEN || !process.env.BUFFER_PROFILE_ID) {
    return { error: 'Buffer not configured — set BUFFER_ACCESS_TOKEN and BUFFER_PROFILE_ID in .env' };
  }

  try {
    const payload = {
      text: content,
      profile_ids: [process.env.BUFFER_PROFILE_ID],
    };
    if (schedule_time) {
      payload.scheduled_at = schedule_time;
    }

    const { data } = await axios.post(
      'https://api.bufferapp.com/1/updates/create.json',
      payload,
      {
        headers: { Authorization: `Bearer ${process.env.BUFFER_ACCESS_TOKEN}` },
        timeout: 10000,
      },
    );

    return {
      bufferId: data.updates?.[0]?.id || data.id,
      status: 'scheduled',
      scheduledAt: schedule_time || 'optimal',
      preview: content.slice(0, 80) + (content.length > 80 ? '…' : ''),
    };
  } catch (err) {
    return { error: err.response?.data?.message || err.message };
  }
}

// ── Demo data (when API keys not configured) ──────────────────────

function demoRevenue(period) {
  return {
    mrr: 0,
    arr: 0,
    activeSubscriptions: 0,
    newSubscriptions: 0,
    canceledSubscriptions: 0,
    churnRate: 0,
    period,
    currency: 'USD',
    demo: true,
    note: 'No Stripe key configured — add STRIPE_SECRET_KEY to .env to see live data',
  };
}

function demoCompetitors() {
  return {
    competitors: [],
    changes: [],
    lastChecked: new Date().toISOString(),
    demo: true,
    note: 'No COMPETITOR_URLS configured — add comma-separated URLs to .env to monitor competitors',
  };
}
