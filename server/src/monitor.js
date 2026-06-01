import cron from 'node-cron';
import { callTool, getAllMetrics } from './tools.js';
import { scoutMonitor } from './subagents/scout.js';
import { getClients } from './clients.js';

const prevState = {
  mrr: null,
  churnRate: null,
  atRiskCount: null,
  competitorHashes: new Set(),
  grossMrr: null,
};

async function runChecks(broadcast) {
  await Promise.allSettled([
    checkRevenue(broadcast),
    checkMrrVsBridge(broadcast),
    checkCompetitorsForChanges(broadcast),
    checkAtRiskClients(broadcast),
  ]);

  try {
    const metrics = await getAllMetrics();
    if (metrics) broadcast({ type: 'metrics', data: metrics });
  } catch {}
}

async function checkRevenue(broadcast) {
  const data = await callTool('get_revenue_metrics', { period: '30d' }).catch(() => null);
  if (!data || data.error || data.demo) return;

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
  }

  prevState.mrr = data.mrr;
  prevState.churnRate = data.churnRate;
}

async function checkMrrVsBridge(broadcast) {
  const data = await callTool('track_mrr_vs_bridge', {}).catch(() => null);
  if (!data || data.error) return;

  const bridgeTarget = data.bridgeTarget || 16500;

  if (prevState.grossMrr !== null) {
    const drop = prevState.grossMrr > 0
      ? ((prevState.grossMrr - data.grossMrr) / prevState.grossMrr) * 100
      : 0;

    if (drop > 10) {
      broadcast({
        type: 'alert',
        severity: 'critical',
        title: 'MRR Drop',
        body: `Gross MRR dropped to $${data.grossMrr.toLocaleString()} — ${data.percentComplete}% of the $${bridgeTarget.toLocaleString()} bridge target. Gap is $${data.gap.toLocaleString()}.`,
        data,
      });
    }
  }

  prevState.grossMrr = data.grossMrr;
}

async function checkAtRiskClients(broadcast) {
  const data = await callTool('get_client_roster', {}).catch(() => null);
  if (!data || data.error) return;

  const atRisk = data.atRiskCount || 0;
  if (atRisk > 0 && (prevState.atRiskCount === null || atRisk > prevState.atRiskCount)) {
    broadcast({
      type: 'alert',
      severity: 'warning',
      title: 'Client at Risk',
      body: `${atRisk} client${atRisk > 1 ? 's' : ''} flagged at risk. Reach out before we lose that MRR.`,
      data,
    });
  }

  prevState.atRiskCount = atRisk;
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

async function checkScoutMonitoring(broadcast) {
  try {
    const { clients } = await getClients();
    if (clients?.length) await scoutMonitor(clients, broadcast);
  } catch {}
}

export function startMonitor(broadcast) {
  setTimeout(() => runChecks(broadcast), 5000);
  cron.schedule('*/15 * * * *', () => runChecks(broadcast));
  cron.schedule('0 */4 * * *', () => checkScoutMonitoring(broadcast));

  console.log('Background monitor started — MRR checks every 15 min, Scout every 4 hours');
}
