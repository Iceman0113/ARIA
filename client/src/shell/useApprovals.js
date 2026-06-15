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

// Normalize a factory pending item into the common approval shape
function normalizeFactory(task) {
  const m = task.proposed_manifest || {};
  return {
    id: task.id,
    source: 'factory',
    title: m.name || task.id,
    preview: m.specialty || m.system_prompt?.slice(0, 120) || '',
    _raw: task,
  };
}

// Normalize an agent task item into the common approval shape
function normalizeAgentTask(task) {
  const agentName = task.slug
    ? task.slug.charAt(0).toUpperCase() + task.slug.slice(1)
    : 'Agent';
  const textSnippet = task.text ? task.text.slice(0, 80) : '';
  return {
    id: task.id,
    source: 'agent',
    title: `${agentName}: ${textSnippet}`,
    preview: task.result || '',
    _raw: task,
  };
}

export function useApprovals(ws) {
  const [pending, setPending] = useState([]);

  const hydrate = useCallback(async () => {
    try {
      const [factoryData, agentData] = await Promise.all([
        fetchJSON('/factory/pending'),
        fetchJSON('/agents/tasks?state=awaiting_approval'),
      ]);

      // API returns { tasks: [...] }; tests may supply a raw array
      const factoryTasks = Array.isArray(factoryData)
        ? factoryData
        : (factoryData.tasks || []);
      const agentTasks = Array.isArray(agentData)
        ? agentData
        : (agentData.tasks || []);

      const normalized = [
        ...factoryTasks.map(normalizeFactory),
        ...agentTasks.map(normalizeAgentTask),
      ];
      setPending(normalized);
    } catch {
      // keep prior state, don't crash
    }
  }, []);

  // Hydrate on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Re-hydrate on relevant WS events (factory kinds + agent task updates)
  useEffect(() => {
    if (!ws) return;
    const handler = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (FACTORY_EVENT_KINDS.includes(msg.kind) || msg.kind === 'agent_task.updated') {
        hydrate();
      }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, hydrate]);

  // approve/reject route by source
  const approve = useCallback(async (item) => {
    try {
      const id = typeof item === 'object' ? item.id : item;
      const source = typeof item === 'object' ? item.source : 'factory';
      const url = source === 'agent'
        ? `/agents/tasks/${id}/approve`
        : `/factory/tasks/${id}/approve`;
      await fetchJSON(url, { method: 'POST' });
      await hydrate();
    } catch {
      // keep prior state, don't crash
    }
  }, [hydrate]);

  const reject = useCallback(async (item) => {
    try {
      const id = typeof item === 'object' ? item.id : item;
      const source = typeof item === 'object' ? item.source : 'factory';
      const url = source === 'agent'
        ? `/agents/tasks/${id}/reject`
        : `/factory/tasks/${id}/reject`;
      await fetchJSON(url, { method: 'POST' });
      await hydrate();
    } catch {
      // keep prior state, don't crash
    }
  }, [hydrate]);

  return { pending, approve, reject, hydrate };
}
