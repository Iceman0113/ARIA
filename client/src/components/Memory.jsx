import { useState } from 'react';

const TYPE_META = {
  goal:       { icon: '🎯', label: 'Goals',      color: '#00d4aa' },
  decision:   { icon: '✅', label: 'Decisions',  color: '#6655ff' },
  issue:      { icon: '⚠️', label: 'Issues',     color: '#ff8844' },
  context:    { icon: '📌', label: 'Context',    color: '#7070a0' },
  preference: { icon: '⚙️', label: 'Preferences',color: '#7070a0' },
};

export default function MemoryPanel({ memory, open, onToggle, serverUrl, onUpdated }) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (!memory) return null;

  const entries = memory.entries || [];
  const sessions = memory.sessions || [];
  const activeEntries = entries.filter(e => !e.resolved);
  const hasContent = activeEntries.length > 0 || sessions.length > 0;

  async function handleDelete(key) {
    if (confirmDelete !== key) { setConfirmDelete(key); return; }
    try {
      const httpUrl = serverUrl.replace(/^ws/, 'http');
      await fetch(`${httpUrl}/memory/${encodeURIComponent(key)}`, { method: 'DELETE' });
      setConfirmDelete(null);
      onUpdated?.();
    } catch {}
  }

  // Group active entries by type
  const grouped = {};
  for (const e of activeEntries) {
    if (!grouped[e.type]) grouped[e.type] = [];
    grouped[e.type].push(e);
  }

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
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 2,
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          ARIA's Memory
          {activeEntries.length > 0 && (
            <span style={{
              fontSize: 10,
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 7px',
              fontFamily: 'Inter, sans-serif',
            }}>
              {activeEntries.length}
            </span>
          )}
        </span>
        <span style={{ color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '12px 16px 16px', animation: 'fade-in 0.2s ease' }}>
          {!hasContent && (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              No memories yet. ARIA will remember things as you talk.
            </div>
          )}

          {/* Grouped entries */}
          {Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type] || { icon: '📝', label: type, color: 'var(--text-dim)' };
            return (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: meta.color, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                  {meta.icon} {meta.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map(entry => (
                    <MemoryEntry
                      key={entry.id}
                      entry={entry}
                      confirmDelete={confirmDelete}
                      onDelete={handleDelete}
                      onCancelDelete={() => setConfirmDelete(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6, marginTop: 4 }}>
                🗂 Recent Sessions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sessions.slice(0, 3).map(session => (
                  <div key={session.id} style={{
                    padding: '8px 10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 3 }}>
                      {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {session.messageCount} messages
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {session.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-faint)', textAlign: 'center' }}>
            ARIA updates her memory automatically as you talk.
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryEntry({ entry, confirmDelete, onDelete, onCancelDelete }) {
  const isConfirming = confirmDelete === entry.key;

  return (
    <div style={{
      padding: '7px 10px',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{entry.value}</div>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
          {new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {isConfirming ? (
          <>
            <button
              onClick={() => onDelete(entry.key)}
              style={{ fontSize: 10, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              confirm
            </button>
            <button
              onClick={onCancelDelete}
              style={{ fontSize: 10, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => onDelete(entry.key)}
            style={{ fontSize: 10, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', opacity: 0.5 }}
            title="Delete memory"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
