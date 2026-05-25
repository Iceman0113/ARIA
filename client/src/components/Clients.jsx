import { useState } from 'react';

const mono = "'JetBrains Mono', monospace";

const STATUS_META = {
  active:   { label: 'Active',   color: 'var(--green)',    bg: '#00e08011' },
  'at-risk':{ label: 'At Risk',  color: 'var(--orange)',   bg: '#ff880011' },
  paused:   { label: 'Paused',   color: 'var(--text-dim)', bg: 'var(--surface)' },
  churned:  { label: 'Churned',  color: 'var(--red)',      bg: '#ff446611' },
};

export default function ClientsPanel({ data, open, onToggle, serverUrl, onUpdated }) {
  const [adding, setAdding]       = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAll, setShowAll]     = useState(false);

  const httpUrl = (serverUrl || 'http://localhost:3001').replace(/^ws/, 'http');
  const clients = data?.clients || [];
  const visible = showAll ? clients : clients.filter(c => c.status !== 'churned');
  const sorted  = [...visible].sort((a, b) => {
    const order = { active: 0, 'at-risk': 1, paused: 2, churned: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });
  const churnedCount = clients.filter(c => c.status === 'churned').length;

  const saveClient = async (formData) => {
    await fetch(`${httpUrl}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    setAdding(false);
    setEditingId(null);
    onUpdated?.();
  };

  const removeClient = async (id) => {
    await fetch(`${httpUrl}/clients/${id}`, { method: 'DELETE' });
    onUpdated?.();
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
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
          fontFamily: mono,
          letterSpacing: 2,
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Client Roster</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(data?.atRiskCount || 0) > 0 && (
            <span style={{ fontSize: 9, color: 'var(--orange)', background: '#ff880011', padding: '1px 6px', borderRadius: 3 }}>
              {data.atRiskCount} AT RISK
            </span>
          )}
          <span style={{ color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '12px 16px 16px', animation: 'fade-in 0.2s ease' }}>
          {/* Summary stats */}
          {clients.length > 0 && (
            <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--green)', fontFamily: mono }}>
                  ${(data?.totalMonthlyValue || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>monthly contracted</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontFamily: mono }}>
                  {clients.filter(c => c.status === 'active').length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>active</div>
              </div>
              {(data?.atRiskCount || 0) > 0 && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--orange)', fontFamily: mono }}>
                    {data.atRiskCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>at risk</div>
                </div>
              )}
            </div>
          )}

          {/* Client list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(client => (
              editingId === client.id
                ? <ClientForm key={client.id} existing={client} onSave={saveClient} onCancel={() => setEditingId(null)} />
                : <ClientCard key={client.id} client={client} onEdit={() => setEditingId(client.id)} onDelete={() => removeClient(client.id)} />
            ))}
          </div>

          {/* Show churned toggle */}
          {churnedCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, cursor: 'pointer', fontFamily: mono, letterSpacing: 0.5 }}
            >
              + show {churnedCount} churned
            </button>
          )}

          {/* Add form or button */}
          {adding
            ? <ClientForm onSave={saveClient} onCancel={() => setAdding(false)} />
            : (
              <button
                onClick={() => setAdding(true)}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '8px',
                  background: 'none',
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-faint)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: mono,
                  letterSpacing: 0.5,
                  transition: 'border-color 0.2s ease, color 0.2s ease',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-faint)'; }}
              >
                + add client
              </button>
            )
          }
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const meta = STATUS_META[client.status] || STATUS_META.active;

  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${client.status === 'at-risk' ? '#ff880033' : 'var(--border)'}`,
      borderRadius: 10,
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{client.name}</span>
            <span style={{
              fontSize: 9,
              color: meta.color,
              background: meta.bg,
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: mono,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {meta.label}
            </span>
            {client.monthlyValue > 0 && (
              <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: mono }}>
                ${client.monthlyValue.toLocaleString()}/mo
              </span>
            )}
          </div>
          {client.keyContact && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
              {client.keyContact}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
          <button
            onClick={onEdit}
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
          >
            ✎
          </button>
          {confirming
            ? (
              <button
                onClick={() => { setConfirming(false); onDelete(); }}
                style={{ background: '#ff446622', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 10, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontFamily: mono }}
              >
                confirm
              </button>
            )
            : (
              <button
                onClick={() => setConfirming(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
              >
                ×
              </button>
            )
          }
        </div>
      </div>

      {/* Projects */}
      {client.projects?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {client.projects.map((p, i) => {
            const hColor = p.health === 'on-track' ? 'var(--green)' : p.health === 'at-risk' ? 'var(--orange)' : 'var(--red)';
            return (
              <div key={i} style={{
                fontSize: 10,
                color: hColor,
                background: 'var(--surface)',
                border: `1px solid ${hColor}44`,
                padding: '2px 8px',
                borderRadius: 4,
                fontFamily: mono,
              }}>
                {p.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Notes */}
      {client.notes && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6, lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {client.notes}
        </div>
      )}
    </div>
  );
}

function ClientForm({ existing, onSave, onCancel }) {
  const [name, setName]           = useState(existing?.name || '');
  const [status, setStatus]       = useState(existing?.status || 'active');
  const [monthly, setMonthly]     = useState(existing?.monthlyValue ? String(existing.monthlyValue) : '');
  const [contact, setContact]     = useState(existing?.keyContact || '');
  const [notes, setNotes]         = useState(existing?.notes || '');

  const submit = () => {
    if (!name.trim()) return;
    const payload = {
      ...(existing?.id ? { id: existing.id } : {}),
      name: name.trim(),
      status,
      monthlyValue: monthly ? Number(monthly.replace(/[^0-9]/g, '')) : 0,
      keyContact: contact.trim(),
      notes: notes.trim(),
    };
    onSave(payload);
  };

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      marginTop: 8,
      background: 'var(--surface2)',
      border: '1px solid var(--accent)44',
      borderRadius: 10,
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Client name *" style={inputStyle} autoFocus />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="active">Active</option>
          <option value="at-risk">At Risk</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>
        <input value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="$/mo" style={inputStyle} />
      </div>

      <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Key contact" style={inputStyle} />

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes, signals, context…"
        rows={2}
        style={{ ...inputStyle, resize: 'vertical' }}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: mono }}
        >
          cancel
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          style={{
            background: name.trim() ? 'var(--accent)' : 'var(--surface)',
            border: 'none',
            color: name.trim() ? '#fff' : 'var(--text-faint)',
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 6,
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontFamily: mono,
          }}
        >
          {existing ? 'save' : 'add client'}
        </button>
      </div>
    </div>
  );
}
