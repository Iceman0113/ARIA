import { getSupabase, getTenantId } from '../supabase.js';
import { assertTransition, TerminalStates } from './states.js';

function sb() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase not configured');
  return c;
}

/**
 * Create a new spawn task. Returns the inserted row id + the row.
 */
export async function createTask({ requestedBy, nameHint, roleDescription, specialRequirements }) {
  const tenantId = await getTenantId();
  if (!tenantId) throw new Error('Tenant not found — run schema.sql');
  const { data, error } = await sb().from('spawn_tasks').insert({
    tenant_id: tenantId,
    requested_by: requestedBy,
    name_hint: nameHint,
    role_description: roleDescription,
    special_requirements: specialRequirements || null,
    status: 'pending',
  }).select('*').single();
  if (error) throw new Error(`createTask: ${error.message}`);
  return data;
}

export async function getTask(id) {
  const { data, error } = await sb().from('spawn_tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getTask: ${error.message}`);
  return data;
}

export async function listPending() {
  const tenantId = await getTenantId();
  const { data, error } = await sb()
    .from('spawn_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPending: ${error.message}`);
  return data || [];
}

/**
 * Transition a task to a new status, enforcing the state-machine rules.
 * Optionally patch additional fields.
 */
export async function transition(id, to, patch = {}) {
  const task = await getTask(id);
  if (!task) throw new Error(`task ${id} not found`);
  assertTransition(task.status, to);
  const update = {
    ...patch,
    status: to,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb().from('spawn_tasks').update(update).eq('id', id).select('*').single();
  if (error) throw new Error(`transition: ${error.message}`);
  return data;
}

export async function setError(id, message) {
  // Goes to failed from ANY non-terminal state.
  const task = await getTask(id);
  if (!task) throw new Error(`task ${id} not found`);
  // If already terminal, do not overwrite — but record error if absent.
  const update = { error: message, updated_at: new Date().toISOString() };
  if (!TerminalStates.has(task.status)) {
    update.status = 'failed';
  }
  const { error } = await sb().from('spawn_tasks').update(update).eq('id', id);
  if (error) throw new Error(`setError: ${error.message}`);
}

/**
 * Count tasks created today by this tenant that are not in 'failed' status.
 * Used for the 5/day cap (spec §9).
 */
export async function countTasksToday(tenantId) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count, error } = await sb()
    .from('spawn_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', since.toISOString())
    .neq('status', 'failed');
  if (error) throw new Error(`countTasksToday: ${error.message}`);
  return count || 0;
}

export async function listAgents(statuses = null) {
  const tenantId = await getTenantId();
  let q = sb().from('spawned_agents').select('*').eq('tenant_id', tenantId);
  if (statuses) q = q.in('status', statuses);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(`listAgents: ${error.message}`);
  return data || [];
}

export async function getAgentBySlug(slug) {
  const { data, error } = await sb().from('spawned_agents').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`getAgentBySlug: ${error.message}`);
  return data;
}

export async function insertAgent(agent) {
  const { data, error } = await sb().from('spawned_agents').insert(agent).select('*').single();
  if (error) throw new Error(`insertAgent: ${error.message}`);
  return data;
}

export async function updateAgentStatus(slug, status) {
  const { data, error } = await sb()
    .from('spawned_agents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select('*')
    .single();
  if (error) throw new Error(`updateAgentStatus: ${error.message}`);
  return data;
}
