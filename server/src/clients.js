import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const CLIENTS_FILE = './aria-clients.json';

function load() {
  try { return JSON.parse(readFileSync(CLIENTS_FILE, 'utf-8')); }
  catch { return { clients: [] }; }
}

function save(store) {
  try { writeFileSync(CLIENTS_FILE, JSON.stringify(store, null, 2)); } catch {}
}

export function getClients() {
  const { clients } = load();
  const active = clients.filter(c => c.status === 'active' || c.status === 'at-risk');
  const totalMonthlyValue = active.reduce((sum, c) => sum + (c.monthlyValue || 0), 0);
  const atRiskCount = clients.filter(c => c.status === 'at-risk').length;
  return { clients, totalMonthlyValue, atRiskCount };
}

export function upsertClient(data) {
  const store = load();
  const now = new Date().toISOString();

  if (data.id) {
    const idx = store.clients.findIndex(c => c.id === data.id);
    if (idx < 0) return { error: 'Client not found' };
    store.clients[idx] = { ...store.clients[idx], ...data, updatedAt: now };
  } else {
    const { id: _drop, ...rest } = data;
    store.clients.push({ id: randomUUID(), ...rest, projects: [], createdAt: now, updatedAt: now });
  }

  save(store);
  return { success: true, ...getClients() };
}

export function deleteClient(id) {
  const store = load();
  const before = store.clients.length;
  store.clients = store.clients.filter(c => c.id !== id);
  if (store.clients.length === before) return { deleted: false };
  save(store);
  return { deleted: true };
}

export function upsertProject(clientId, project) {
  const store = load();
  const client = store.clients.find(c => c.id === clientId);
  if (!client) return { error: 'Client not found' };

  client.projects = client.projects || [];
  const idx = client.projects.findIndex(p => p.name === project.name);
  if (idx >= 0) {
    client.projects[idx] = { ...client.projects[idx], ...project };
  } else {
    client.projects.push(project);
  }
  client.updatedAt = new Date().toISOString();
  save(store);
  return { success: true, ...getClients() };
}
