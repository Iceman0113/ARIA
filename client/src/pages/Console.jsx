import { useEffect, useState } from 'react';
import NeuralMap from '../neural-map/NeuralMap.jsx';
import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';
import { MOCK_DATA } from '../neural-map/mockData.js';

export default function Console({ drawerOpen, onCloseDrawer, workStates }) {
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
  }, []);

  return (
    <>
      <div className="stage" id="stage">
        <NeuralMap data={data} workStates={workStates || {}} />
        <div className="vignette" />
        {loadError && (
          <div className="stage-error">Using mock data — server fetch failed: {loadError}</div>
        )}
      </div>
      <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Dashboard content — Phase E
        </div>
      </DashboardDrawer>
    </>
  );
}
