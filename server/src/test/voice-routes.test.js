import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const store = { profiles: [], active: null };

vi.mock('../voice/storage.js', () => ({
  uploadClip: vi.fn(async (voiceId, name) => { store.profiles.push({ voice_id: voiceId, name }); return { voice_id: voiceId, name }; }),
  listProfiles: vi.fn(async () => store.profiles),
  deleteProfile: vi.fn(async (voiceId) => { store.profiles = store.profiles.filter(p => p.voice_id !== voiceId); }),
  getActiveVoice: vi.fn(async () => store.active),
  setActiveVoice: vi.fn(async (voiceId) => { store.active = voiceId; }),
  getClip: vi.fn(async () => Buffer.from('RIFFfake')),
}));
vi.mock('../voice/normalize.js', () => ({ normalizeClip: vi.fn(async (b) => Buffer.concat([Buffer.from('RIFF'), b])) }));
vi.mock('../voice/client.js', () => ({ registerVoice: vi.fn(async () => ({ voices: [] })), synthesizeClone: vi.fn(), UnknownVoiceError: class extends Error {} }));

import { mountVoiceRoutes } from '../voice/routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  mountVoiceRoutes(app);
  return app;
}

beforeEach(() => { store.profiles = []; store.active = null; });

describe('voice routes', () => {
  it('GET /voices returns profiles + active', async () => {
    store.profiles = [{ voice_id: 'aria', name: 'ARIA' }];
    store.active = 'aria';
    const res = await request(makeApp()).get('/voices');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ voices: [{ voice_id: 'aria', name: 'ARIA' }], active: 'aria' });
  });

  it('POST /voices uploads, normalizes, registers, returns voice_id', async () => {
    const res = await request(makeApp())
      .post('/voices?name=Echo')
      .set('Content-Type', 'audio/mpeg')
      .send(Buffer.from('sourceaudio'));
    expect(res.status).toBe(200);
    expect(res.body.voice_id).toBe('echo');
    expect(store.profiles.map(p => p.voice_id)).toContain('echo');
  });

  it('POST /voices/active sets active voice', async () => {
    const res = await request(makeApp()).post('/voices/active').send({ voice_id: 'echo' });
    expect(res.status).toBe(200);
    expect(store.active).toBe('echo');
  });

  it('DELETE /voices/:id removes profile', async () => {
    store.profiles = [{ voice_id: 'echo', name: 'Echo' }];
    const res = await request(makeApp()).delete('/voices/echo');
    expect(res.status).toBe(200);
    expect(store.profiles).toHaveLength(0);
  });
});
