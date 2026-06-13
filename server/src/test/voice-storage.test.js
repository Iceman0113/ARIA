import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { rows: [], settings: {}, files: {} };

vi.mock('../supabase.js', () => ({
  getTenantId: async () => 'tenant-1',
  getSupabase: () => ({
    storage: {
      from: () => ({
        upload: async (path, buf) => { state.files[path] = buf; return { error: null }; },
        download: async (path) => ({ data: { arrayBuffer: async () => state.files[path] }, error: null }),
        remove: async (paths) => { paths.forEach(p => delete state.files[p]); return { error: null }; },
      }),
    },
    from: (table) => ({
      upsert: async (row) => {
        if (table === 'voice_settings') state.settings[row.tenant_id] = row.active_voice_id;
        else state.rows.push(row);
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          // voice_profiles list
          order: async () => ({ data: state.rows, error: null }),
          // voice_settings single
          maybeSingle: async () => ({
            data: state.settings['tenant-1'] ? { active_voice_id: state.settings['tenant-1'] } : null,
            error: null,
          }),
        }),
      }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }),
}));

import { uploadClip, listProfiles, getActiveVoice, setActiveVoice } from '../voice/storage.js';

beforeEach(() => { state.rows = []; state.settings = {}; state.files = {}; });

describe('voice storage', () => {
  it('uploads a clip and lists the profile', async () => {
    await uploadClip('echo', 'Echo', Buffer.from('RIFFfake'));
    const profiles = await listProfiles();
    expect(profiles.map(p => p.voice_id)).toContain('echo');
  });

  it('sets and gets the active voice', async () => {
    await setActiveVoice('echo');
    expect(await getActiveVoice()).toBe('echo');
  });

  it('returns null active voice when none set', async () => {
    expect(await getActiveVoice()).toBe(null);
  });
});
