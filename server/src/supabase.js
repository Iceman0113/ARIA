import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Singleton — created once, reused everywhere
let _client = null;

export function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (_client) return _client;

  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      realtime: {
        transport: WebSocket,   // required for Node.js < 22
      },
    },
  );

  return _client;
}

// Cache the tenant ID after first lookup so we don't query it every call
let _tenantId = null;

export async function getTenantId() {
  if (_tenantId) return _tenantId;

  const sb = getSupabase();
  if (!sb) return null;

  const { data } = await sb
    .from('tenants')
    .select('id')
    .eq('owner_name', process.env.FOUNDER_NAME || 'Randy')
    .limit(1)
    .single();

  _tenantId = data?.id || null;
  return _tenantId;
}
