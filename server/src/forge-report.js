export function summarizeMerch(items) {
  const byStatus = {};
  let totalRevenue = 0;
  for (const it of items) {
    byStatus[it.Status] = (byStatus[it.Status] || 0) + 1;
    totalRevenue += Number(it.Revenue) || 0;
  }
  return {
    total: items.length,
    byStatus,
    pendingGate1: byStatus['Drafted'] || 0,
    pendingGate2: byStatus['Built'] || 0,
    live: byStatus['live'] || 0,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}
