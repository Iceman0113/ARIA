import { useEffect, useState, useCallback } from 'react';

const API = ''; // same origin — vite proxies to :3001 already (or use http://localhost:3001)

async function fetchJSON(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Factory({ ws }) {
  const [pending, setPending] = useState([]);
  const [agents, setAgents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const hydrate = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        fetchJSON('/factory/pending'),
        fetchJSON('/factory/agents'),
      ]);
      setPending(p.tasks || []);
      setAgents(a.agents || []);
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!ws) return;
    const handler = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (['factory.task_ready', 'factory.task_failed', 'factory.task_rejected',
           'agent_added', 'agent_promoted', 'agent_archived'].includes(msg.kind)) {
        hydrate();
      }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, hydrate]);

  async function approve(taskId) {
    setBusy(true);
    try { await fetchJSON(`/factory/tasks/${taskId}/approve`, { method: 'POST' }); await hydrate(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function reject(taskId) {
    if (!confirm('Reject this draft? Terminal — no further action.')) return;
    setBusy(true);
    try { await fetchJSON(`/factory/tasks/${taskId}/reject`, { method: 'POST' }); await hydrate(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function rejectWithFeedback(taskId) {
    const feedback = prompt('What should change?');
    if (!feedback) return;
    setBusy(true);
    try {
      await fetchJSON(`/factory/tasks/${taskId}/feedback`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      await hydrate();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function promote(slug) {
    setBusy(true);
    try { await fetchJSON(`/factory/agents/${slug}/promote`, { method: 'POST' }); await hydrate(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function archive(slug) {
    if (!confirm(`Archive ${slug}? Can't be reversed without DB edit.`)) return;
    setBusy(true);
    try { await fetchJSON(`/factory/agents/${slug}/archive`, { method: 'POST' }); await hydrate(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const shadow = agents.filter(a => a.status === 'shadow');
  const active = agents.filter(a => a.status === 'active');

  return (
    <div style={{ padding: 32, color: '#E6FFFB', fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ letterSpacing: 4, color: '#00E5CC', fontSize: 22 }}>FACTORY</h1>
      {error && <div style={{ background: '#3a0e0e', padding: 12, borderRadius: 6, color: '#ffb4b4', marginBottom: 16 }}>{error}</div>}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, letterSpacing: 2, color: '#00E5CC' }}>AWAITING REVIEW ({pending.length})</h2>
        {pending.length === 0 && <p style={{ opacity: 0.6 }}>Nothing waiting. Tell ARIA to spawn one.</p>}
        {pending.map(task => {
          const p = task.proposed_manifest || {};
          const iters = task.approval_iterations || 0;
          const remaining = 3 - iters;
          return (
            <article key={task.id} style={{ background: 'rgba(0,229,204,0.06)', border: '1px solid rgba(0,229,204,0.2)', borderRadius: 12, padding: 20, marginTop: 16 }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{p.name} <code style={{ opacity: 0.6, fontSize: 13 }}>dispatch_to_{p.slug}</code></h3>
                <span style={{ fontSize: 11, opacity: 0.6 }}>v{iters + 1} · {remaining} revision{remaining === 1 ? '' : 's'} remaining</span>
              </header>
              <p style={{ opacity: 0.8, marginTop: 8 }}>{p.specialty}</p>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', opacity: 0.7 }}>System prompt ({(p.system_prompt || '').split(/\s+/).length} words)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', background: '#040C10', padding: 12, borderRadius: 6, marginTop: 8, fontSize: 12 }}>{p.system_prompt}</pre>
              </details>
              <div style={{ marginTop: 12 }}>
                <strong style={{ opacity: 0.7, fontSize: 12 }}>Granted tools:</strong>
                {' '}
                {(p.tool_allowlist || []).map(t => (
                  <code key={t} style={{ background: 'rgba(186,255,90,0.15)', color: '#BAFF5A', padding: '2px 6px', borderRadius: 4, marginRight: 6, fontSize: 12 }}>{t}</code>
                ))}
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button disabled={busy} onClick={() => approve(task.id)} style={{ background: '#BAFF5A', color: '#040C10', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Approve → Shadow</button>
                <button disabled={busy} onClick={() => rejectWithFeedback(task.id)} style={{ background: 'transparent', color: '#E6FFFB', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Reject with feedback</button>
                <button disabled={busy} onClick={() => reject(task.id)} style={{ background: 'transparent', color: '#ff8888', border: '1px solid #ff8888', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Reject</button>
              </div>
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 16, letterSpacing: 2, color: '#00E5CC' }}>SHADOW MODE ({shadow.length})</h2>
        {shadow.map(a => (
          <div key={a.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>{a.name} <code style={{ opacity: 0.5 }}>dispatch_to_{a.slug}</code></div>
            <button disabled={busy} onClick={() => promote(a.slug)} style={{ background: 'transparent', color: '#BAFF5A', border: '1px solid #BAFF5A', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Promote → Active</button>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 16, letterSpacing: 2, color: '#00E5CC' }}>ACTIVE ({active.length})</h2>
        {active.map(a => (
          <div key={a.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>{a.name} <code style={{ opacity: 0.5 }}>dispatch_to_{a.slug}</code></div>
            <button disabled={busy} onClick={() => archive(a.slug)} style={{ background: 'transparent', color: '#ff8888', border: '1px solid rgba(255,136,136,0.4)', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Archive</button>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 48, opacity: 0.5 }}>
        <h2 style={{ fontSize: 16, letterSpacing: 2 }}>CORE SUB-AGENTS (reserved)</h2>
        {['scout', 'hunter', 'creative', 'hermes'].map(slug => (
          <div key={slug} style={{ padding: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <code>delegate_to_{slug}</code> — built-in, not Factory-managed
          </div>
        ))}
      </section>
    </div>
  );
}
