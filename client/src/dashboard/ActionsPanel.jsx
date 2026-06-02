const URGENCY_CLASS = { hot: 'hot', soon: 'soon', today: '', future: 'future' };
const DUE_CLASS     = { hot: 'hot', soon: 'soon', today: '', future: '' };

export default function ActionsPanel({ actions }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Today's actions <span className="ann">— what ARIA wants you to handle</span></div>
        <div className="panel-aside">{actions.length} items</div>
      </div>
      {actions.length === 0 ? (
        <div style={{ padding: '24px 0', color: 'var(--text-mute)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          No actions queued. Ask ARIA "what should I do today?"
        </div>
      ) : actions.map(a => (
        <div className="action-row" key={a.id}>
          <div className={`marker ${URGENCY_CLASS[a.urgency] || ''}`} />
          <div className="body">
            <div className="title">{a.title}</div>
            <div className="meta">{a.meta}</div>
          </div>
          <div className={`due ${DUE_CLASS[a.urgency] || ''}`}>{a.due}</div>
        </div>
      ))}
    </div>
  );
}
