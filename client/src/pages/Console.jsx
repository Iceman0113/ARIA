import { useEffect, useState } from 'react';
import NeuralMap from '../neural-map/NeuralMap.jsx';
import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';
import KpiStrip from '../dashboard/KpiStrip.jsx';
import ActionsPanel from '../dashboard/ActionsPanel.jsx';
import IntelFeed from '../dashboard/IntelFeed.jsx';
import { MOCK_DATA } from '../neural-map/mockData.js';

export default function Console({
  drawerOpen, onCloseDrawer, workStates, refreshKey,
  mrr, mrrTarget, spendToday, tokensToday, avgLatency,
  actions, intel,
}) {
  const [data, setData] = useState(MOCK_DATA);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/neural-map');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;
        if (Array.isArray(payload.nodes) && payload.nodes.length > 1) setData(payload);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'fetch failed');
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <>
      <div className="stage" id="stage">
        <NeuralMap data={data} workStates={workStates || {}} />
        <div className="vignette" />
        {loadError && <div className="stage-error">Using mock data — server fetch failed: {loadError}</div>}
      </div>
      <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
        <KpiStrip
          mrr={mrr}
          mrrTarget={mrrTarget}
          mrrWeekDelta={350}
          pipelineOpen={8400}
          pipelineActive={4}
          pipelineHot={1}
          followUpsTotal={3}
          followUpsOverdue={2}
          spendToday={spendToday}
          tokensToday={tokensToday}
          avgLatency={avgLatency}
        />
        <div className="drawer-grid">
          <ActionsPanel actions={actions} />
          <IntelFeed items={intel} />
        </div>
      </DashboardDrawer>
    </>
  );
}
