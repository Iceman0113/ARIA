import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import Stripe from 'stripe';
import { upsertEntry, resolveIssue, getMemory } from './memory.js';
import { getClients, upsertClient } from './clients.js';
import { runScout } from './subagents/scout.js';
import { runHunter } from './subagents/hunter.js';
import { runCreative } from './subagents/creative.js';

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
    name: 'get_engineering_status',
    description: 'Get live engineering health from GitHub: open PRs, CI/CD status, recent deploys, commit velocity, open issues. Call when asked about engineering, code, PRs, deploys, CI, or tech debt.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_customer_health',
    description: 'Get customer health from Intercom: at-risk customers, open support conversations, recent unhappy signals. Call when asked about customers, churn, support, or user satisfaction.',
    input_schema: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          enum: ['churn_risk', 'support', 'all'],
          description: 'What aspect of customer health to focus on',
        },
      },
      required: ['focus'],
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
    description: 'Get a full snapshot of all metrics at once: revenue, engineering, customers, and competitors. Use when asked for an overall update or morning briefing.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'save_to_memory',
    description: 'Save something important to your persistent memory across sessions. Call this proactively when you learn a goal, a decision is made, an issue is identified, or important context is shared. Do NOT save trivial information — only things that would change how you advise this company.',
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
          description: 'Short snake_case identifier, e.g. "mrr_target" or "ci_flaky_issue"',
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
    name: 'get_product_analytics',
    description: 'Get product analytics from PostHog: DAU, WAU, MAU, new user signups, engagement ratio, retention. Call when asked about user growth, activation, retention, engagement, product usage, or funnels.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Lookback window for trend comparison',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_sprint_health',
    description: 'Get engineering sprint health from Linear: open issues by priority, blockers, overdue tasks, cycle progress, team throughput. Call when asked about sprint, backlog, priorities, blockers, or what the team is working on.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'delegate_to_scout',
    description: 'Hand off a research task to Scout, your web intelligence sub-agent. Scout searches the web, reads pages, and returns a structured briefing. Use when asked to research a company, find news about a client, analyze a competitor in depth, investigate a technology, or gather intel before a meeting.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Specific research task. Be detailed: "Research Acme Corp — recent news, tech stack, leadership, any signs of a digital transformation initiative" or "Find what ServiceNow announced at Knowledge 2025 and how it affects our positioning."',
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
    description: 'Hand off a lead generation task to Hunter, your prospecting sub-agent. Hunter searches for qualified companies that match given criteria and returns structured prospects with fit scores and suggested first moves. Use when asked to find new clients, build a prospect list, or identify companies in a target market.',
    input_schema: {
      type: 'object',
      properties: {
        industry: { type: 'string', description: 'Target industry or sector, e.g. "healthcare", "financial services", "manufacturing"' },
        region: { type: 'string', description: 'Geographic target, e.g. "Northeast US", "Chicago metro", "Texas"' },
        size: { type: 'string', description: 'Company size range, e.g. "100–500 employees", "mid-market"' },
        signals: { type: 'string', description: 'Buying signals to look for, e.g. "recent funding, legacy ERP modernization, rapid hiring"' },
        notes: { type: 'string', description: 'Any additional context or specific requirements' },
      },
      required: ['industry'],
    },
  },
  {
    name: 'delegate_to_creative',
    description: 'Hand off an ad or content brief to Creative, your social media sub-agent. Creative writes B2B ad copy variations for LinkedIn, Meta, or Google with targeting recommendations. Use when asked to write ads, create campaign copy, draft a LinkedIn post, or develop social media content.',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['linkedin', 'meta', 'google', 'general'],
          description: 'Target platform',
        },
        objective: { type: 'string', description: 'Campaign goal: awareness, lead gen, retargeting, event promotion, etc.' },
        audience: { type: 'string', description: 'Target audience, e.g. "CTOs and VPs of IT at mid-market healthcare companies"' },
        tone: { type: 'string', description: 'Desired tone: authoritative, conversational, urgent, consultative' },
        context: { type: 'string', description: 'Service being promoted, any offer or hook, relevant context' },
      },
      required: ['objective'],
    },
  },
  {
    name: 'get_client_roster',
    description: 'Get the full client roster: all clients with their status, monthly value, key contacts, project health, and notes. Call when asked about clients, accounts, engagements, delivery, or which clients are at risk.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_client',
    description: 'Create a new client or update an existing one in the roster. Use when you learn about a new engagement, when a client\'s status changes, or when there is new information about a project or account. Omit id to create new.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Existing client ID to update — omit to create a new client',
        },
        name: {
          type: 'string',
          description: 'Client or company name',
        },
        status: {
          type: 'string',
          enum: ['active', 'at-risk', 'paused', 'churned'],
          description: 'active=healthy engagement, at-risk=churn signal detected, paused=on hold, churned=lost',
        },
        monthlyValue: {
          type: 'number',
          description: 'Monthly contracted value in USD',
        },
        keyContact: {
          type: 'string',
          description: 'Primary point of contact name and/or title',
        },
        notes: {
          type: 'string',
          description: 'Latest notes, signals, or context about this client',
        },
      },
      required: [],
    },
  },
];

// ── Tool dispatcher ───────────────────────────────────────────────

export async function callTool(name, input, onEvent) {
  switch (name) {
    case 'get_revenue_metrics':    return getRevenueMetrics(input.period || '30d');
    case 'get_engineering_status': return getEngineeringStatus();
    case 'get_customer_health':    return getCustomerHealth(input.focus || 'all');
    case 'save_to_memory':         return upsertEntry(input);
    case 'get_memory':             return getMemory();
    case 'check_competitors':      return checkCompetitors();
    case 'get_product_analytics':  return getProductAnalytics(input.period || '30d');
    case 'get_sprint_health':      return getSprintHealth();
    case 'delegate_to_scout':      return runScout(input.task, input.focus, onEvent);
    case 'delegate_to_hunter':    return runHunter(input, onEvent);
    case 'delegate_to_creative':  return runCreative(input, onEvent);
    case 'get_client_roster':      return getClients();
    case 'update_client':          return upsertClient(input);
    case 'get_business_summary': {
      const [revenue, engineering, customers, competitors, product, sprint] = await Promise.all([
        getRevenueMetrics('30d'),
        getEngineeringStatus(),
        getCustomerHealth('all'),
        checkCompetitors(),
        getProductAnalytics('30d'),
        getSprintHealth(),
      ]);
      return { revenue, engineering, customers, competitors, product, sprint };
    }
    default: return { error: `Unknown tool: ${name}` };
  }
}

export async function getAllMetrics() {
  try {
    const [revenue, engineering, customers, competitors, product, sprint] = await Promise.all([
      getRevenueMetrics('30d'),
      getEngineeringStatus(),
      getCustomerHealth('all'),
      checkCompetitors(),
      getProductAnalytics('30d'),
      getSprintHealth(),
    ]);
    return { revenue, engineering, customers, competitors, product, sprint, updatedAt: new Date().toISOString() };
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

// ── GitHub ────────────────────────────────────────────────────────

async function getEngineeringStatus() {
  if (!process.env.GITHUB_TOKEN) return demoEngineering();

  try {
    const headers = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    };
    const base = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`;

    const [prs, runs, commits, issues] = await Promise.all([
      axios.get(`${base}/pulls?state=open&per_page=25`, { headers }).then(r => r.data),
      axios.get(`${base}/actions/runs?per_page=15`, { headers }).then(r => r.data.workflow_runs || []),
      axios.get(`${base}/commits?per_page=20`, { headers }).then(r => r.data),
      axios.get(`${base}/issues?state=open&per_page=25&filter=all`, { headers }).then(r => r.data),
    ]);

    const lastRun = runs[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCommits = commits.filter(c => new Date(c.commit.author.date) > sevenDaysAgo);
    const failingCI = runs.filter(r => r.conclusion === 'failure').length;

    return {
      openPRs: prs.length,
      prList: prs.slice(0, 5).map(p => ({ title: p.title, author: p.user.login, draft: p.draft })),
      ciStatus: lastRun?.conclusion || lastRun?.status || 'unknown',
      lastCIRun: lastRun ? {
        name: lastRun.name,
        status: lastRun.status,
        conclusion: lastRun.conclusion,
        updatedAt: lastRun.updated_at,
      } : null,
      failingCICount: failingCI,
      commitsLast7d: recentCommits.length,
      openIssues: issues.filter(i => !i.pull_request).length,
      lastCommit: commits[0] ? {
        message: commits[0].commit.message.split('\n')[0],
        author: commits[0].commit.author.name,
        date: commits[0].commit.author.date,
      } : null,
      demo: false,
    };
  } catch (err) {
    return { error: err.message, demo: false };
  }
}

// ── Intercom ──────────────────────────────────────────────────────

async function getCustomerHealth(focus) {
  if (!process.env.INTERCOM_TOKEN) return demoCustomers(focus);

  try {
    const headers = {
      Authorization: `Bearer ${process.env.INTERCOM_TOKEN}`,
      Accept: 'application/json',
    };

    const [conversations, contacts] = await Promise.all([
      axios.get('https://api.intercom.io/conversations?per_page=50&sort_field=updated_at&sort_order=desc&open=true', { headers }).then(r => r.data),
      axios.get('https://api.intercom.io/contacts?per_page=50&sort_field=updated_at&sort_order=desc', { headers }).then(r => r.data),
    ]);

    const openCount = conversations.total_count || conversations.conversations?.length || 0;
    const recentConversations = (conversations.conversations || []).slice(0, 10).map(c => ({
      subject: c.source?.subject || '(no subject)',
      author: c.source?.author?.name || 'Unknown',
      updatedAt: new Date(c.updated_at * 1000).toISOString(),
      priority: c.priority,
    }));

    return {
      openConversations: openCount,
      recentConversations,
      totalContacts: contacts.total_count || 0,
      focus,
      demo: false,
    };
  } catch (err) {
    return { error: err.message, demo: false };
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

// ── PostHog (product analytics) ───────────────────────────────────

async function getProductAnalytics(period) {
  if (!process.env.POSTHOG_API_KEY || !process.env.POSTHOG_PROJECT_ID) {
    return demoProductAnalytics(period);
  }

  try {
    const host = (process.env.POSTHOG_HOST || 'https://app.posthog.com').replace(/\/$/, '');
    const projectId = process.env.POSTHOG_PROJECT_ID;
    const headers = { Authorization: `Bearer ${process.env.POSTHOG_API_KEY}` };

    const hogql = (query) =>
      axios.post(
        `${host}/api/projects/${projectId}/query`,
        { query: { kind: 'HogQLQuery', query } },
        { headers, timeout: 10000 },
      ).then(r => r.data?.results?.[0]?.[0] ?? 0);

    const periodDays = { '7d': 7, '30d': 30, '90d': 90 }[period] || 30;
    const prevStart = periodDays * 2;

    const [dau, wau, mau, newUsers, prevPeriodUsers] = await Promise.all([
      hogql(`SELECT uniq(distinct_id) FROM events WHERE timestamp >= now() - interval 1 day`),
      hogql(`SELECT uniq(distinct_id) FROM events WHERE timestamp >= now() - interval 7 day`),
      hogql(`SELECT uniq(distinct_id) FROM events WHERE timestamp >= now() - interval 30 day`),
      hogql(`SELECT count() FROM persons WHERE created_at >= now() - interval ${periodDays} day`),
      hogql(`SELECT uniq(distinct_id) FROM events WHERE timestamp >= now() - interval ${prevStart} day AND timestamp < now() - interval ${periodDays} day`),
    ]);

    const growth = prevPeriodUsers > 0
      ? parseFloat(((mau - prevPeriodUsers) / prevPeriodUsers * 100).toFixed(1))
      : null;

    return {
      dau: Number(dau),
      wau: Number(wau),
      mau: Number(mau),
      newUsers: Number(newUsers),
      engagementRatio: mau > 0 ? parseFloat((dau / mau * 100).toFixed(1)) : 0,
      periodGrowth: growth,
      period,
      demo: false,
    };
  } catch (err) {
    return { error: err.message, demo: false };
  }
}

// ── Linear (sprint health) ────────────────────────────────────────

const LINEAR_GQL = 'https://api.linear.app/graphql';

const ISSUES_QUERY = `
  query IssueList($teamId: ID) {
    issues(
      filter: {
        state: { type: { nin: ["completed", "cancelled"] } }
        ${process.env.LINEAR_TEAM_ID ? 'team: { id: { eq: $teamId } }' : ''}
      }
      first: 100
      orderBy: priority
    ) {
      nodes {
        id title priority dueDate updatedAt
        state { name type }
        assignee { displayName }
        team { name }
      }
    }
    cycles(
      filter: { isActive: { eq: true } }
      first: 1
    ) {
      nodes {
        number startsAt endsAt progress
        completedIssueCountHistory
        issueCountHistory
      }
    }
  }
`;

async function getSprintHealth() {
  if (!process.env.LINEAR_API_KEY) return demoSprintHealth();

  try {
    const { data } = await axios.post(
      LINEAR_GQL,
      {
        query: ISSUES_QUERY,
        variables: { teamId: process.env.LINEAR_TEAM_ID || null },
      },
      {
        headers: { Authorization: process.env.LINEAR_API_KEY },
        timeout: 10000,
      },
    );

    if (data.errors) return { error: data.errors[0]?.message, demo: false };

    const issues = data.data?.issues?.nodes || [];
    const cycle  = data.data?.cycles?.nodes?.[0] || null;
    const now    = new Date();

    const byPriority = { urgent: 0, high: 0, medium: 0, low: 0, none: 0 };
    const PRIORITY_MAP = { 1: 'urgent', 2: 'high', 3: 'medium', 4: 'low', 0: 'none' };
    const overdue = [];
    const unassigned = [];

    for (const issue of issues) {
      const p = PRIORITY_MAP[issue.priority] || 'none';
      byPriority[p]++;
      if (issue.dueDate && new Date(issue.dueDate) < now) {
        overdue.push({ title: issue.title, priority: p, assignee: issue.assignee?.displayName || null });
      }
      if (!issue.assignee && (issue.priority === 1 || issue.priority === 2)) {
        unassigned.push({ title: issue.title, priority: p });
      }
    }

    // Throughput: issues updated to completed in last 7 days (approximation)
    const recentlyCompleted = issues.filter(i =>
      i.state.type === 'completed' &&
      new Date(i.updatedAt) > new Date(now - 7 * 86400000),
    ).length;

    return {
      totalOpen: issues.length,
      byPriority,
      overdue: overdue.slice(0, 5),
      overdueCount: overdue.length,
      unassignedUrgent: unassigned.slice(0, 3),
      activeCycle: cycle ? {
        number: cycle.number,
        endsAt: cycle.endsAt,
        progress: Math.round((cycle.progress || 0) * 100),
      } : null,
      recentlyCompletedCount: recentlyCompleted,
      demo: false,
    };
  } catch (err) {
    return { error: err.message, demo: false };
  }
}

// ── Demo data (when API keys not configured) ──────────────────────

function demoRevenue(period) {
  return {
    mrr: 47820,
    arr: 573840,
    activeSubscriptions: 312,
    newSubscriptions: period === 'today' ? 3 : period === '7d' ? 18 : 47,
    canceledSubscriptions: period === 'today' ? 1 : period === '7d' ? 4 : 9,
    churnRate: 2.88,
    momGrowth: 6.4,
    period,
    currency: 'USD',
    demo: true,
  };
}

function demoEngineering() {
  return {
    openPRs: 7,
    prList: [
      { title: 'feat: new onboarding flow', author: 'sarah', draft: false },
      { title: 'fix: payment retry logic', author: 'mike', draft: false },
      { title: 'chore: upgrade dependencies', author: 'bot', draft: true },
    ],
    ciStatus: 'failure',
    lastCIRun: { name: 'CI', status: 'completed', conclusion: 'failure', updatedAt: new Date().toISOString() },
    failingCICount: 2,
    commitsLast7d: 34,
    openIssues: 12,
    lastCommit: { message: 'fix: handle edge case in checkout flow', author: 'sarah', date: new Date().toISOString() },
    demo: true,
  };
}

function demoCustomers(focus) {
  return {
    openConversations: 14,
    recentConversations: [
      { subject: 'Export feature not working', author: 'Alice K.', priority: 'high' },
      { subject: 'Billing question', author: 'Bob M.', priority: 'not_priority' },
      { subject: 'Integration with Zapier', author: 'Carol R.', priority: 'not_priority' },
    ],
    atRiskCustomers: 3,
    totalContacts: 1840,
    focus,
    demo: true,
  };
}

function demoCompetitors() {
  return {
    competitors: [
      { url: 'https://competitor-a.com/pricing', changed: true, lastChecked: new Date().toISOString() },
      { url: 'https://competitor-b.com/pricing', changed: false, lastChecked: new Date().toISOString() },
    ],
    changes: [{ url: 'https://competitor-a.com/pricing', changed: true }],
    lastChecked: new Date().toISOString(),
    demo: true,
  };
}

function demoProductAnalytics(period) {
  return {
    dau: 284,
    wau: 1120,
    mau: 3840,
    newUsers: period === '7d' ? 94 : period === '30d' ? 312 : 780,
    engagementRatio: 7.4,
    periodGrowth: 8.2,
    period,
    demo: true,
  };
}

function demoSprintHealth() {
  return {
    totalOpen: 23,
    byPriority: { urgent: 2, high: 7, medium: 10, low: 4, none: 0 },
    overdue: [
      { title: 'Fix payment retry edge case', priority: 'urgent', assignee: 'Sarah' },
      { title: 'Migrate legacy auth flow', priority: 'high', assignee: null },
    ],
    overdueCount: 2,
    unassignedUrgent: [{ title: 'Security patch for auth', priority: 'urgent' }],
    activeCycle: { number: 14, endsAt: new Date(Date.now() + 4 * 86400000).toISOString(), progress: 62 },
    recentlyCompletedCount: 8,
    demo: true,
  };
}
