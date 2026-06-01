import NeuralMap from '../neural-map/NeuralMap.jsx';
import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';
import { MOCK_DATA } from '../neural-map/mockData.js';

export default function Console({ drawerOpen, onCloseDrawer }) {
  return (
    <>
      <div className="stage" id="stage">
        <NeuralMap data={MOCK_DATA} workStates={{}} />
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
