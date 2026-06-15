import { getSupabase, getTenantId } from '../supabase.js';
import { assertTransition } from './states.js';

function sb() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase not configured');
  return c;
}

/**
 * Create a new agent task in the 'queued' state.
 * Returns the inserted row.
 */
export async function createTask({ slug, text }) {
  const tenantId = await getTenantId();
  if (!tenantId) throw new Error('Tenant not found — run schema.sql');
  const { data, error } = await sb()
    .from('agent_tasks')
    .insert({ tenant_id: tenantId, slug, text, state: 'queued' })
    .select('*')
    .single();
  if (error) throw new Error(`createTask: ${error.message}`);
  return data;
}

/**
 * List tasks for a given slug (tenant-scoped), newest first.
 * If slug is omitted, returns all of the tenant's tasks.
 */
export async function listTasks(slug) {
  const tenantId = await getTenantId();
  let q = sb()
    .from('agent_tasks')
    .select('*')
    .eq('tenant_id', tenantId);
  if (slug !== undefined) {
    q = q.eq('slug', slug);
  }
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(`listTasks: ${error.message}`);
  return data || [];
}

/**
 * Return the tenant's tasks that are in a given state.
 * Primarily used to populate the Approvals tab with 'awaiting_approval' tasks.
 */
export async function listByState(state) {
  const tenantId = await getTenantId();
  const { data, error } = await sb()
    .from('agent_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('state', state)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listByState: ${error.message}`);
  return data || [];
}

/**
 * Fetch a single task by id (tenant-scoped).
 */
export async function getTask(id) {
  const tenantId = await getTenantId();
  const { data, error } = await sb()
    .from('agent_tasks')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(`getTask: ${error.message}`);
  return data;
}

/**
 * Transition a task to a new state, enforcing the state machine.
 * Optionally patch additional fields (e.g. { result: '...' }).
 * Returns the updated row.
 *
 * Optimistic locking: the DB UPDATE is conditioned on the state that was
 * read from the row (`.eq('state', task.state)`). If a concurrent request
 * has already changed the state, the UPDATE matches 0 rows and we throw
 * Error('state changed concurrently') so the caller can detect the race.
 */
export async function setState(id, to, patch = {}) {
  const task = await getTask(id);
  if (!task) throw new Error(`agent task ${id} not found`);
  assertTransition(task.state, to);
  const fromState = task.state;
  const update = {
    ...patch,
    state: to,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb()
    .from('agent_tasks')
    .update(update)
    .eq('id', id)
    .eq('state', fromState)
    .select('*')
    .single();
  if (error) throw new Error(`setState: ${error.message}`);
  if (!data) throw new Error('state changed concurrently');
  return data;
}

/**
 * Delete a task (tenant-scoped). Returns { ok: true }.
 */
export async function deleteTask(id) {
  const tenantId = await getTenantId();
  const { error } = await sb()
    .from('agent_tasks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`deleteTask: ${error.message}`);
  return { ok: true };
}
