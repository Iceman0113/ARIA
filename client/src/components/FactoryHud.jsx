import { useEffect, useState } from 'react';

/**
 * Floating glass card top-right. Listens for factory.task_ready over the
 * existing WebSocket. Dismissible — task stays in /factory until approved.
 *
 * Props:
 *  - ws: WebSocket instance (or a hook that gives one)
 *  - onOpenFactory: () => void — navigates to /factory
 */
export function FactoryHud({ ws, onOpenFactory }) {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    if (!ws) return;
    const handler = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.kind === 'factory.task_ready') {
        setQueue((q) => [{ ...msg, dismissed: false }, ...q]);
      }
      if (msg.kind === 'agent_added') {
        // Remove the card whose task just got approved
        setQueue((q) => q.filter(c => c.taskId !== msg.created_by_task_id));
      }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  if (!queue.length || queue.every(c => c.dismissed)) return null;
  const card = queue.find(c => !c.dismissed);
  if (!card) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed', top: 24, right: 24, zIndex: 1000,
        background: 'rgba(4,12,16,0.92)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,229,204,0.4)', borderRadius: 12,
        padding: 16, maxWidth: 360, color: '#E6FFFB',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 2, color: '#00E5CC', marginBottom: 6 }}>◦ FACTORY</div>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
        I drafted a new agent — meet <strong>{card.name}</strong>.
      </div>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
        Slug: <code>dispatch_to_{card.slug}</code>{card.revision ? ' · revision' : ''}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { onOpenFactory(); setQueue((q) => q.map(c => c.taskId === card.taskId ? { ...c, dismissed: true } : c)); }}
          style={{ background: '#00E5CC', color: '#040C10', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}
        >Open Factory</button>
        <button
          onClick={() => setQueue((q) => q.map(c => c.taskId === card.taskId ? { ...c, dismissed: true } : c))}
          style={{ background: 'transparent', color: '#E6FFFB', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}
        >Later</button>
      </div>
    </div>
  );
}
