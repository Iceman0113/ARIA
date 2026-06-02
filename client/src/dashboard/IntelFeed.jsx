const AGENT_META = {
  scout:    { abbr: 'SCT', name: 'Scout',    color: '#6BD08F' },
  hunter:   { abbr: 'HNT', name: 'Hunter',   color: '#E08B5C' },
  creative: { abbr: 'CRT', name: 'Creative', color: '#B97FE5' },
  hermes:   { abbr: 'HRM', name: 'Hermes',   color: '#E3CC68' },
  beacon:   { abbr: 'BCN', name: 'Beacon',   color: '#6FA8DC' },
  verse:    { abbr: 'VRS', name: 'Verse',    color: '#C078E5' },
};

export default function IntelFeed({ items }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Intel feed</div>
        <div className="panel-aside">live</div>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '24px 0', color: 'var(--text-mute)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          No intel yet — ARIA's sub-agents will surface findings here.
        </div>
      ) : items.map(it => {
        const meta = AGENT_META[it.agent] || { abbr: '?', name: it.agent, color: '#fff' };
        return (
          <div className="intel-row" key={it.id}>
            <div className="av" style={{ color: meta.color, borderColor: meta.color }}>{meta.abbr}</div>
            <div className="body">
              <div className="src">{meta.name} · {it.source}</div>
              <div className="msg">{it.msg}</div>
            </div>
            <div className="time">{it.time}</div>
          </div>
        );
      })}
    </div>
  );
}
