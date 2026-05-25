import cron from 'node-cron';
import { getRevenueMetrics, getEngineeringStatus, getCustomerHealth, checkCompetitors, callTool, getAllMetrics } from './tools.js';
import { scoutMonitor } from './subagents/scout.js';
import { getClients } from './clients.js';

// Track previous state to detect changes
const prevState = {
  mrr: null,
  churnRate: null,
  failingCI: null,
  openPRs: null,
  atRiskCustomers: null,
  openConversations: null,
  competitorHashes: new Set(),
  engagementRatio: null,
  overdueCount: null,
  unassignedUrgent: null,
};

async function runChecks(broadcast) {
  await Promise.allSettled([
    checkRevenue(broadcast),
    checkEngineering(broadcast),
    checkCustomers(broadcast),
    checkCompetitorsForChanges(broadcast),
    checkProduct(broadcast),
    checkSprint(broadcast),
  ]);

  // Refresh metrics dashboard after each check cycle
  try {
    const metrics = await getAllMetrics();
    if (metrics) broadcast({ type: 'metrics', data: metrics });
  } catch {}
}

async function checkRevenue(broadcast) {
  const data = await callTool('get_revenue_metrics', { period: '30d' }).catch(() => null);
  if (!data || data.error) return;

  if (prevState.mrr !== null) {
    const drop = ((prevState.mrr - data.mrr) / prevState.mrr) * 100;
    if (drop > 5) {
      broadcast({
        type: 'alert',
        severity: 'critical',
        title: 'Revenue Drop',
        body: `MRR fell ${drop.toFixed(1)}% — down to $${data.mrr.toLocaleString()}. We need to investigate.`,
        data: { mrr: data.mrr, prev: prevState.mrr },
      });
    }
    if (data.churnRate > 5 && prevState.churnRate < 5) {
      broadcast({
        type: 'alert',
        severity: 'warning',
        title: 'Churn Spike',
        body: `Monthly churn hit ${data.churnRate}%. That's above our threshold — check who's leaving and why.`,
        data,
      });
    }
  }

  prevState.mrr = data.mrr;
  prevState.churnRate = data.churnRate;
}

async function checkEngineering(broadcast) {
  const data = await callTool('get_engineering_status', {}).catch(() => null);
  if (!data || data.error) return;

  if (data.failingCICount > 0 && prevState.failingCI === 0) {
    broadcast({
      type: 'alert',
      severity: 'warning',
      title: 'CI Failing',
      body: `${data.failingCICount} CI run${data.failingCICount > 1 ? 's' : ''} failing. Last: "${data.lastCIRun?.name}". Need someone on this.`,
      data,
    });
  }

  if (data.openPRs > 10 && prevState.openPRs <= 10) {
    broadcast({
      type: 'alert',
      severity: 'info',
      title: 'PR Backlog',
      body: `${data.openPRs} open PRs. That's a lot of unreviewed work piling up.`,
      data,
    });
  }

  prevState.failingCI = data.failingCICount;
  prevState.openPRs = data.openPRs;
}

async function checkCustomers(broadcast) {
  const data = await callTool('get_customer_health', { focus: 'all' }).catch(() => null);
  if (!data || data.error) return;

  if (data.atRiskCustomers > 0 && (prevState.atRiskCustomers === null || data.atRiskCustomers > prevState.atRiskCustomers)) {
    broadcast({
      type: 'alert',
      severity: 'warning',
      title: 'Churn Signal',
      body: `${data.atRiskCustomers} customer${data.atRiskCustomers > 1 ? 's' : ''} flagged at risk. Reach out before they cancel.`,
      data,
    });
  }

  if (data.openConversations > 20 && (prevState.openConversations || 0) <= 20) {
    broadcast({
      type: 'alert',
      severity: 'info',
      title: 'Support Volume',
      body: `${data.openConversations} open support conversations. Might need more hands on deck.`,
      data,
    });
  }

  prevState.atRiskCustomers = data.atRiskCustomers;
  prevState.openConversations = data.openConversations;
}

async function checkCompetitorsForChanges(broadcast) {
  const data = await callTool('check_competitors', {}).catch(() => null);
  if (!data || data.error) return;

  for (const change of data.changes || []) {
    const key = change.url;
    if (!prevState.competitorHashes.has(key)) {
      prevState.competitorHashes.add(key);
      broadcast({
        type: 'alert',
        severity: 'info',
        title: 'Competitor Update',
        body: `${new URL(change.url).hostname} changed something on their site. Worth checking what moved.`,
        data: change,
      });
    }
  }
}

async function checkProduct(broadcast) {
  const data = await callTool('get_product_analytics', { period: '30d' }).catch(() => null);
  if (!data || data.error) return;

  const prev = prevState.engagementRatio;
  if (prev !== null && data.engagementRatio < prev - 2) {
    broadcast({
      type: 'alert',
      severity: 'warning',
      title: 'Engagement Drop',
      body: `DAU/MAU ratio fell to ${data.engagementRatio}% — down ${(prev - data.engagementRatio).toFixed(1)} points. Users are opening the product less.`,
      data,
    });
  }

  if (prev === null && data.periodGrowth < 0) {
    broadcast({
      type: 'alert',
      severity: 'warning',
      title: 'User Growth Negative',
      body: `Active users declined ${Math.abs(data.periodGrowth)}% this period. Acquisition or retention is breaking.`,
      data,
    });
  }

  prevState.engagementRatio = data.engagementRatio;
}

async function checkSprint(broadcast) {
  const data = await callTool('get_sprint_health', {}).catch(() => null);
  if (!data || data.error) return;

  if (data.overdueCount > 0 && (prevState.overdueCount || 0) === 0) {
    const urgentOverdue = (data.overdue || []).filter(i => i.priority === 'urgent');
    if (urgentOverdue.length > 0) {
      broadcast({
        type: 'alert',
        severity: 'critical',
        title: 'Overdue Urgent Issues',
        body: `${urgentOverdue.length} urgent issue${urgentOverdue.length > 1 ? 's' : ''} past due. First: "${urgentOverdue[0].title}".`,
        data,
      });
    }
  }

  if (data.unassignedUrgent?.length > 0 && (prevState.unassignedUrgent || 0) === 0) {
    broadcast({
      type: 'alert',
      severity: 'warning',
      title: 'Unassigned Urgent Work',
      body: `${data.unassignedUrgent.length} urgent issue${data.unassignedUrgent.length > 1 ? 's' : ''} with no owner. "${data.unassignedUrgent[0].title}" needs someone on it.`,
      data,
    });
  }

  prevState.overdueCount = data.overdueCount;
  prevState.unassignedUrgent = data.unassignedUrgent?.length || 0;
}

async function checkScoutMonitoring(broadcast) {
  try {
    const { clients } = getClients();
    if (clients?.length) await scoutMonitor(clients, broadcast);
  } catch {}
}

export function startMonitor(broadcast) {
  // Run metrics checks immediately on start
  setTimeout(() => runChecks(broadcast), 5000);

  // Metrics + alert checks every 15 minutes
  cron.schedule('*/15 * * * *', () => runChecks(broadcast));

  // Scout client news monitoring every 4 hours
  cron.schedule('0 */4 * * *', () => checkScoutMonitoring(broadcast));

  console.log('Background monitor started — metrics every 15 min, Scout every 4 hours');
}
