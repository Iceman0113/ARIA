export default function Dashboard({ metrics, open, onToggle }) {
  if (!metrics) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      {/* Toggle */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '8px 20px',
          background: 'none',
          border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          color: 'var(--text-dim)',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 2,
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Live Metrics</span>
        <span style={{ color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '12px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, animation: 'fade-in 0.2s ease' }}>
          <RevenueCard data={metrics.revenue} />
          <EngineeringCard data={metrics.engineering} />
          <CustomersCard data={metrics.customers} />
          <CompetitorsCard data={metrics.competitors} />
          <ProductCard data={metrics.product} />
          <SprintCard data={metrics.sprint} />
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, icon, color, children, demo }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 12px',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: 'uppercase' }}>
          {title}
        </span>
        {demo && (
          <span style={{ fontSize: 9, color: 'var(--text-faint)', marginLeft: 'auto', background: 'var(--surface)', padding: '1px 5px', borderRadius: 3 }}>
            DEMO
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color, small }) {
  return (
    <div style={{ marginBottom: small ? 2 : 4 }}>
      <span style={{ fontSize: small ? 16 : 20, fontWeight: 600, color: color || 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
      {label && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{label}</div>}
    </div>
  );
}

function RevenueCard({ data }) {
  if (!data) return <MetricCard title="Revenue" icon="💰"><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading...</div></MetricCard>;
  if (data.error) return <MetricCard title="Revenue" icon="💰"><div style={{ color: 'var(--red)', fontSize: 11 }}>{data.error}</div></MetricCard>;

  return (
    <MetricCard title="Revenue" icon="💰" demo={data.demo}>
      <Stat label="MRR" value={`$${(data.mrr || 0).toLocaleString()}`} color="var(--green)" />
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.newSubscriptions}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>new</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: data.churnRate > 5 ? 'var(--red)' : 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.churnRate}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>churn</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.activeSubscriptions}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>active</div>
        </div>
      </div>
    </MetricCard>
  );
}

function EngineeringCard({ data }) {
  if (!data) return <MetricCard title="Engineering" icon="⚙️"><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading...</div></MetricCard>;
  if (data.error) return <MetricCard title="Engineering" icon="⚙️"><div style={{ color: 'var(--red)', fontSize: 11 }}>{data.error}</div></MetricCard>;

  const ciColor = data.ciStatus === 'success' ? 'var(--green)' : data.ciStatus === 'failure' ? 'var(--red)' : 'var(--text-dim)';

  return (
    <MetricCard title="Engineering" icon="⚙️" demo={data.demo}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: data.openPRs > 10 ? 'var(--orange)' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.openPRs}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>open PRs</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: ciColor, fontFamily: "'JetBrains Mono', monospace" }}>
            {data.ciStatus === 'success' ? '✓' : data.ciStatus === 'failure' ? '✗' : '?'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>CI</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.commitsLast7d}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>commits/7d</div>
        </div>
      </div>
    </MetricCard>
  );
}

function CustomersCard({ data }) {
  if (!data) return <MetricCard title="Customers" icon="👥"><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading...</div></MetricCard>;
  if (data.error) return <MetricCard title="Customers" icon="👥"><div style={{ color: 'var(--red)', fontSize: 11 }}>{data.error}</div></MetricCard>;

  return (
    <MetricCard title="Customers" icon="👥" demo={data.demo}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: data.openConversations > 15 ? 'var(--orange)' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.openConversations}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>open tickets</div>
        </div>
        {data.atRiskCustomers != null && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: data.atRiskCustomers > 0 ? 'var(--red)' : 'var(--green)', fontFamily: "'JetBrains Mono', monospace" }}>
              {data.atRiskCustomers}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>at risk</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {(data.totalContacts || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>contacts</div>
        </div>
      </div>
    </MetricCard>
  );
}

function CompetitorsCard({ data }) {
  if (!data) return <MetricCard title="Competitors" icon="🔍"><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading...</div></MetricCard>;
  if (data.error) return <MetricCard title="Competitors" icon="🔍"><div style={{ color: 'var(--red)', fontSize: 11 }}>{data.error}</div></MetricCard>;

  const changes = data.changes?.length || 0;

  return (
    <MetricCard title="Competitors" icon="🔍" demo={data.demo}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, color: changes > 0 ? 'var(--gold)' : 'var(--green)', fontFamily: "'JetBrains Mono', monospace" }}>
          {changes > 0 ? `${changes} change${changes > 1 ? 's' : ''}` : 'No changes'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
          {data.competitors?.length || 0} site{(data.competitors?.length || 0) !== 1 ? 's' : ''} monitored
        </div>
        {changes > 0 && (
          <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>
            {data.changes[0].url.replace(/^https?:\/\//, '').split('/')[0]}
          </div>
        )}
      </div>
    </MetricCard>
  );
}

function ProductCard({ data }) {
  if (!data) return <MetricCard title="Product" icon="📈"><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading...</div></MetricCard>;
  if (data.error) return <MetricCard title="Product" icon="📈"><div style={{ color: 'var(--red)', fontSize: 11 }}>{data.error}</div></MetricCard>;

  const growthColor = data.periodGrowth === null ? 'var(--text-dim)'
    : data.periodGrowth >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <MetricCard title="Product" icon="📈" demo={data.demo}>
      <Stat label="DAU" value={data.dau?.toLocaleString()} color="var(--text)" />
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.mau?.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>MAU</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.engagementRatio}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>D/M ratio</div>
        </div>
        {data.periodGrowth !== null && (
          <div>
            <div style={{ fontSize: 12, color: growthColor, fontFamily: "'JetBrains Mono', monospace" }}>
              {data.periodGrowth > 0 ? '+' : ''}{data.periodGrowth}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>growth</div>
          </div>
        )}
      </div>
    </MetricCard>
  );
}

function SprintCard({ data }) {
  if (!data) return <MetricCard title="Sprint" icon="🏃"><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading...</div></MetricCard>;
  if (data.error) return <MetricCard title="Sprint" icon="🏃"><div style={{ color: 'var(--red)', fontSize: 11 }}>{data.error}</div></MetricCard>;

  const urgentColor = (data.byPriority?.urgent || 0) > 0 ? 'var(--red)' : 'var(--green)';

  return (
    <MetricCard title="Sprint" icon="🏃" demo={data.demo}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: urgentColor, fontFamily: "'JetBrains Mono', monospace" }}>
            {data.byPriority?.urgent || 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>urgent</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: data.overdueCount > 0 ? 'var(--orange)' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.overdueCount || 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>overdue</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.totalOpen || 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>open</div>
        </div>
      </div>
      {data.activeCycle && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Cycle {data.activeCycle.number}</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{data.activeCycle.progress}%</span>
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${data.activeCycle.progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}
    </MetricCard>
  );
}
