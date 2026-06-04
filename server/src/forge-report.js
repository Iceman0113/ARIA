export function summarizeMerch(items) {
  const byStatus = {};
  let published = 0;
  let listedRevenuePerSale = 0;
  for (const it of items) {
    byStatus[it.Status] = (byStatus[it.Status] || 0) + 1;
    if (it.Status === 'Published') {
      published += 1;
      listedRevenuePerSale += Number(it.Price) || 0;
    }
  }
  return {
    total: items.length,
    byStatus,
    pendingGate1: byStatus['Concept Ready'] || 0,
    pendingGate2: byStatus['Built'] || 0,
    published,
    listedRevenuePerSale: Math.round(listedRevenuePerSale * 100) / 100,
  };
}
