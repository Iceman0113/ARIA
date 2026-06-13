import { getSupabase, getTenantId } from '../supabase.js';

const BUCKET = 'voice-clips';

function clipPath(tenantId, voiceId) {
  return `${tenantId}/${voiceId}.wav`;
}

export async function uploadClip(voiceId, name, wavBuffer) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');

  const path = clipPath(tenantId, voiceId);
  const up = await sb.storage.from(BUCKET).upload(path, wavBuffer, {
    contentType: 'audio/wav',
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);

  const row = await sb.from('voice_profiles').upsert({
    tenant_id: tenantId,
    voice_id: voiceId,
    name,
    storage_path: path,
  });
  if (row.error) throw new Error(row.error.message);
  return { voice_id: voiceId, name };
}

export async function listProfiles() {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) return [];
  const { data, error } = await sb
    .from('voice_profiles')
    .select('voice_id,name,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getClip(voiceId) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');
  const { data, error } = await sb.storage.from(BUCKET).download(clipPath(tenantId, voiceId));
  if (error) throw new Error(error.message);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteProfile(voiceId) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');
  await sb.storage.from(BUCKET).remove([clipPath(tenantId, voiceId)]);
  await sb.from('voice_profiles').delete().eq('tenant_id', tenantId).eq('voice_id', voiceId);
}

export async function getActiveVoice() {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) return null;
  const { data } = await sb
    .from('voice_settings')
    .select('active_voice_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data?.active_voice_id || null;
}

export async function setActiveVoice(voiceId) {
  const sb = getSupabase();
  const tenantId = await getTenantId();
  if (!sb || !tenantId) throw new Error('Supabase not configured');
  const { error } = await sb
    .from('voice_settings')
    .upsert({ tenant_id: tenantId, active_voice_id: voiceId });
  if (error) throw new Error(error.message);
}
