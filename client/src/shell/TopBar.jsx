import NavChips from './NavChips.jsx';

export default function TopBar({
  // existing metric props (keep for backward compat + existing tests)
  tokens,
  spend,
  mrr,
  mrrTarget,
  latency,
  presence,
  // new cosmic nav + status props
  activeRoute,
  onNav,
  status,
}) {
  const tokenStr = (tokens / 1000).toFixed(1) + 'K';
  const spendStr = '$' + spend.toFixed(2);
  const mrrStr   = '$' + mrr.toLocaleString();
  const mrrPct   = Math.min(100, Math.round((mrr / mrrTarget) * 100));
  const latStr   = latency.toFixed(2) + 's';
  const latClass = latency < 1.0 ? 'fast' : 'slow';

  const presenceText = {
    idle:      'idle · "hey ARIA"',
    listening: 'listening',
    thinking:  'thinking',
    speaking:  'speaking',
  }[presence] || presence;

  // Cosmic status dot label (maps orbState -> display string)
  const statusLabel = {
    idle:       'Idle',
    listening:  'Listening',
    processing: 'Processing',
    speaking:   'Speaking',
  }[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Idle');

  return (
    <div className="top">
      <div className="brand-text">
        A.R.I.A.
        <span className="div">/</span>
        <span className="sub">Jack &amp; Jewell Consulting</span>
        <span className="loc">· Greenwood, IN</span>
      </div>

      {/* Nav chips embedded in top bar when activeRoute/onNav are provided */}
      {activeRoute !== undefined && onNav && (
        <NavChips active={activeRoute} onNav={onNav} />
      )}

      <div className="pills">
        <div className="pill tokens">
          <span className="dot" />
          <span className="label">tokens</span>
          <span className="val live mono">{tokenStr}</span>
          <span className="delta mono" style={{ color: 'var(--text-mute)' }}>today</span>
          <span className="delta mono" style={{ color: 'var(--text-mute)', fontSize: 9, letterSpacing: 1 }}>SIM</span>
        </div>

        <div className="pill cost">
          <span className="dot" />
          <span className="label">spend</span>
          <span className="val mono">{spendStr}</span>
          <span className="delta mono" style={{ color: 'var(--text-mute)', fontSize: 9, letterSpacing: 1 }}>SIM</span>
        </div>

        <div className="pill revenue">
          <span className="dot" />
          <span className="label">MRR</span>
          <span className="val mono">{mrrStr}</span>
          <div className="progress"><div className="fill" style={{ width: `${mrrPct}%` }} /></div>
          <span className="delta mono" style={{ color: 'var(--text-mute)' }}>{mrrPct}%</span>
        </div>

        <div className="pill latency">
          <span className="dot" />
          <span className="label">latency</span>
          <span className={`val ${latClass} mono`}>{latStr}</span>
        </div>

        <div className="presence-mark">
          <span className="dot" />
          {presenceText}
        </div>

        {/* Cosmic status dot — only rendered when status prop is provided */}
        {status !== undefined && (
          <div className="statwrap">
            <span className={'statdot ' + status} />
            <span className="stattxt">{statusLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
