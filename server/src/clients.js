import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { getSupabase, getTenantId } from './supabase.js';

// ── Read ──────────────────────────────────────────────────────────

export async function getClients() {
  const sb = getSupabase();
  if (!sb) return fallbackGetClients();

  const tenantId = await getTenantId();
  if (!tenantId) return { clients: [], totalMonthlyValue: 0, atRiskCount: 0 };

  const { data: clients, error } = await sb
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return { clients: [], totalMonthlyValue: 0, atRiskCount: 0, error: error.message };

  const active = (clients || []).filter(c => c.status === 'active' || c.status === 'at-risk');
  const totalMonthlyValue = active.reduce((sum, c) => sum + (Number(c.mrr) || 0), 0);
  const atRiskCount = (clients || []).filter(c => c.status === 'at-risk').length;

  const normalized = (clients || []).map(c => ({
    ...c,
    monthlyValue: Number(c.mrr) || 0,
    keyContact: c.notes || '',
  }));

  return { clients: normalized, totalMonthlyValue, atRiskCount };
}

// ── Write ─────────────────────────────────────────────────────────

export async function upsertClient(data) {
  const sb = getSupabase();
  if (!sb) return fallbackUpsertClient(data);

  const tenantId = await getTenantId();
  if (!tenantId) return { error: 'Tenant not found' };

  const now = new Date().toISOString();

  // Build row with ONLY the fields that were actually passed. This prevents
  // a partial update like { id, notes: "new note" } from wiping phone/email
  // back to null. Empty string and 0 are valid values; only undefined is skipped.
  const row = { tenant_id: tenantId, updated_at: now };
  const setIf = (col, ...candidates) => {
    for (const v of candidates) if (v !== undefined) { row[col] = v; return; }
  };
  setIf('name',             data.name);
  setIf('company',          data.company);
  setIf('email',            data.email);
  setIf('phone',            data.phone);
  setIf('status',           data.status);
  setIf('client_type',      data.client_type, data.clientType);
  setIf('mrr',              data.mrr, data.monthlyValue);
  setIf('last_contact_at',  data.last_contact_at, data.lastContactAt);
  setIf('follow_up_due_at', data.follow_up_due_at, data.followUpDueAt);
  setIf('notes',            data.notes, data.keyContact);

  // Resolve target: explicit id wins, otherwise dedup by (tenant_id, name).
  // This is the fix for "every update_client without an id creates a new row".
  let targetId = data.id;
  if (!targetId) {
    if (!data.name) return { error: 'name required when id is not provided' };
    const { data: existing, error: lookupErr } = await sb
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', data.name)
      .limit(1);
    if (lookupErr) return { error: lookupErr.message };
    if (existing?.length) targetId = existing[0].id;
  }

  if (targetId) {
    const { error } = await sb.from('contacts').update(row).eq('id', targetId).eq('tenant_id', tenantId);
    if (error) return { error: error.message };
  } else {
    // First-time insert — apply sensible defaults only for fields the caller
    // didn't provide. Defaults: status=lead, mrr=0, company=name.
    const insertRow = {
      id: randomUUID(),
      created_at: now,
      ...row,
      status:  row.status  ?? 'lead',
      mrr:     row.mrr     ?? 0,
      company: row.company ?? row.name,
    };
    const { error } = await sb.from('contacts').insert(insertRow);
    if (error) return { error: error.message };
  }

  return { success: true, ...(await getClients()) };
}

export async function deleteClient(id) {
  const sb = getSupabase();
  if (!sb) return { deleted: false };

  const tenantId = await getTenantId();
  if (!tenantId) return { deleted: false };

  const { error } = await sb.from('contacts').delete().eq('id', id).eq('tenant_id', tenantId);
  return error ? { deleted: false } : { deleted: true };
}

export async function upsertProject(clientId, project) {
  const sb = getSupabase();
  if (!sb) return { error: 'No Supabase connection' };

  const tenantId = await getTenantId();
  if (!tenantId) return { error: 'Tenant not found' };

  const { data: contact } = await sb
    .from('contacts').select('notes').eq('id', clientId).eq('tenant_id', tenantId).single();

  if (!contact) return { error: 'Client not found' };

  let projects = [];
  try { projects = JSON.parse(contact.notes || '[]'); } catch { projects = []; }
  if (!Array.isArray(projects)) projects = [];

  const idx = projects.findIndex(p => p.name === project.name);
  if (idx >= 0) projects[idx] = { ...projects[idx], ...project };
  else projects.push(project);

  const { error } = await sb
    .from('contacts')
    .update({ notes: JSON.stringify(projects), updated_at: new Date().toISOString() })
    .eq('id', clientId).eq('tenant_id', tenantId);

  return error ? { error: error.message } : { success: true, ...(await getClients()) };
}

// ── JSON fallback (when Supabase not configured) ──────────────────

const CLIENTS_FILE = './aria-clients.json';

function loadFile() {
  try { return JSON.parse(readFileSync(CLIENTS_FILE, 'utf-8')); }
  catch { return { clients: [] }; }
}

function saveFile(store) {
  try { writeFileSync(CLIENTS_FILE, JSON.stringify(store, null, 2)); } catch {}
}

function fallbackGetClients() {
  const { clients } = loadFile();
  const active = clients.filter(c => c.status === 'active' || c.status === 'at-risk');
  const totalMonthlyValue = active.reduce((sum, c) => sum + (c.monthlyValue || 0), 0);
  const atRiskCount = clients.filter(c => c.status === 'at-risk').length;
  return { clients, totalMonthlyValue, atRiskCount };
}

function fallbackUpsertClient(data) {
  const store = loadFile();
  const now = new Date().toISOString();
  if (data.id) {
    const idx = store.clients.findIndex(c => c.id === data.id);
    if (idx < 0) return { error: 'Client not found' };
    store.clients[idx] = { ...store.clients[idx], ...data, updatedAt: now };
  } else {
    const { id: _drop, ...rest } = data;
    store.clients.push({ id: randomUUID(), ...rest, projects: [], createdAt: now, updatedAt: now });
  }
  saveFile(store);
  return { success: true, ...fallbackGetClients() };
}
