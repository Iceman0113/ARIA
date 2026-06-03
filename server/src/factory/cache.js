import crypto from 'crypto';
import { getSupabase } from '../supabase.js';

export function normalizeQuery(q) {
  return (q || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function hashQuery(q) {
  return crypto.createHash('sha256').update(normalizeQuery(q)).digest('hex');
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Look up a cached Skills Report for this query. Returns the report payload
 * if a row exists within the last 24h; otherwise null.
 */
export async function getCachedReport(query) {
  const sb = getSupabase();
  if (!sb) return null;
  const hash = hashQuery(query);
  const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const { data, error } = await sb
    .from('research_reports')
    .select('id, report, created_at')
    .eq('query_hash', hash)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ? { id: data.id, report: data.report, createdAt: data.created_at } : null;
}

/**
 * Persist a Skills Report against the query hash. Returns the inserted row id.
 */
export async function saveReport(query, domain, report) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const hash = hashQuery(query);
  // Upsert by query_hash so we don't trip the unique constraint on re-runs.
  const { data, error } = await sb
    .from('research_reports')
    .upsert({ query_hash: hash, domain, report }, { onConflict: 'query_hash' })
    .select('id')
    .single();
  if (error) throw new Error(`saveReport failed: ${error.message}`);
  return data.id;
}
