import { useEffect } from 'react';

export default function DashboardDrawer({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'on' : ''}`} onClick={onClose} />
      <div className={`drawer ${open ? 'on' : ''}`}>
        <div className="drawer-handle" onClick={onClose}>
          <div className="handle-bar" />
          <div className="label">Dashboard · tap or press ESC to close</div>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </>
  );
}
