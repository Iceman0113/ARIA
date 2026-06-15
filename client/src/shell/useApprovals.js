import { useCallback, useEffect, useState } from 'react';

// Same origin — Vite proxies to :3001 (mirrors Factory.jsx)
const API = '';

async function fetchJSON(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const FACTORY_EVENT_KINDS = [
  'factory.task_ready',
  'factory.task_failed',
  'factory.task_rejected',
  'agent_added',
  'agent_promoted',
  'agent_archived',
];

export function useApprovals(ws) {
  const [pending, setPending] = useState([]);

  const hydrate = useCallback(async () => {
    try {
      const p = await fetchJSON('/factory/pending');
      // API returns { tasks: [...] }; tests may supply a raw array
      setPending(Array.isArray(p) ? p : (p.tasks || []));
    } catch {
      // keep prior state, don't crash
    }
  }, []);

  // Hydrate on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Re-hydrate on relevant WS events
  useEffect(() => {
    if (!ws) return;
    const handler = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (FACTORY_EVENT_KINDS.includes(msg.kind)) {
        hydrate();
      }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, hydrate]);

  const approve = useCallback(async (id) => {
    try {
      await fetchJSON(`/factory/tasks/${id}/approve`, { method: 'POST' });
      await hydrate();
    } catch {
      // keep prior state, don't crash
    }
  }, [hydrate]);

  const reject = useCallback(async (id) => {
    try {
      await fetchJSON(`/factory/tasks/${id}/reject`, { method: 'POST' });
      await hydrate();
    } catch {
      // keep prior state, don't crash
    }
  }, [hydrate]);

  return { pending, approve, reject, hydrate };
}
