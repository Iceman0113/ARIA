export default function KpiStrip({
  mrr, mrrTarget, mrrWeekDelta,
  pipelineOpen, pipelineActive, pipelineHot,
  followUpsTotal, followUpsOverdue,
  spendToday, tokensToday, avgLatency,
}) {
  const mrrPct = Math.min(100, Math.round((mrr / mrrTarget) * 100));
  return (
    <div className="drawer-kpis">
      <div className="drawer-kpi">
        <div className="label">MRR vs bridge</div>
        <div className="val lime mono">${mrr.toLocaleString()}</div>
        <div className="delta">/ ${mrrTarget.toLocaleString()} · {mrrPct}% · <span style={{ color: 'var(--accent)' }}>+${mrrWeekDelta.toLocaleString()} wk</span></div>
      </div>
      <div className="drawer-kpi">
        <div className="label">Pipeline open</div>
        <div className="val mono">${pipelineOpen.toLocaleString()}</div>
        <div className="delta">{pipelineActive} active · {pipelineHot} hot</div>
      </div>
      <div className="drawer-kpi">
        <div className="label">Follow-ups</div>
        <div className="val mono">{followUpsTotal} <span style={{ color: 'var(--hot)', fontSize: 14 }}>{followUpsOverdue} OVR</span></div>
        <div className="delta">today · this week</div>
      </div>
      <div className="drawer-kpi">
        <div className="label">Today's spend</div>
        <div className="val mono" style={{ color: 'var(--warn)' }}>${spendToday.toFixed(2)}</div>
        <div className="delta">{(tokensToday / 1000).toFixed(1)}K tokens · avg {avgLatency.toFixed(2)}s</div>
      </div>
    </div>
  );
}
