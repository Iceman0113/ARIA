const ROUTES = [
  { id: 'console',  label: 'Console' },
  { id: 'factory',  label: 'Factory' },
  { id: 'clients',  label: 'Clients' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'memory',   label: 'Memory' },
  { id: 'settings', label: 'Settings' },
];

export default function NavChips({ active, onNav }) {
  return (
    <div className="nav-chips">
      {ROUTES.map(r => (
        <button
          key={r.id}
          type="button"
          className={`nav-chip ${active === r.id ? 'active' : ''}`}
          onClick={() => onNav(r.id)}
        >
          <span className="bullet">◦</span> {r.label}
        </button>
      ))}
    </div>
  );
}
