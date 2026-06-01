import { useState } from 'react';
import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';

export default function Console({ drawerOpen, onCloseDrawer }) {
  return (
    <>
      <div className="stage" id="stage">
        <div className="neural-map-placeholder">
          Neural map — Phase B
        </div>
        <div className="vignette" />
      </div>
      <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Dashboard content — Phase E
        </div>
      </DashboardDrawer>
    </>
  );
}
