import express from 'express';
import { uploadClip, listProfiles, deleteProfile, getActiveVoice, setActiveVoice } from './storage.js';
import { normalizeClip } from './normalize.js';
import { registerVoice } from './client.js';

// Derive a filesystem/url-safe voice_id from a display name.
function slugify(name) {
  return String(name || 'voice')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'voice';
}

export function mountVoiceRoutes(app) {
  // GET /voices — list profiles + which one is active
  app.get('/voices', async (req, res) => {
    try {
      const [voices, active] = await Promise.all([listProfiles(), getActiveVoice()]);
      res.json({ voices, active });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /voices?name=Echo  — raw audio body (any format ffmpeg reads)
  app.post('/voices', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
    try {
      const name = String(req.query.name || 'Voice');
      const voiceId = slugify(name);
      if (!req.body || !req.body.length) return res.status(400).json({ error: 'empty upload' });
      const wav = await normalizeClip(req.body);
      await uploadClip(voiceId, name, wav);     // durable in Supabase
      await registerVoice(voiceId, wav);          // compute latents in Python now
      res.json({ voice_id: voiceId, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /voices/active  { voice_id }
  app.post('/voices/active', async (req, res) => {
    try {
      const { voice_id } = req.body || {};
      if (!voice_id) return res.status(400).json({ error: 'voice_id required' });
      await setActiveVoice(voice_id);
      res.json({ active: voice_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /voices/:id
  app.delete('/voices/:id', async (req, res) => {
    try {
      // Re-slugify so the id matches the upload-time form and can't smuggle
      // path separators (e.g. '../') into the Supabase storage key.
      await deleteProfile(slugify(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
