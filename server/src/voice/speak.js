import { getActiveVoice, getClip } from './storage.js';
import { synthesizeClone, registerVoice, UnknownVoiceError } from './client.js';

// Returns a WAV Buffer for the active cloned voice, or null if cloning is
// unavailable/failed — in which case the caller falls back to Edge TTS.
// If the Python service was restarted and lost the voice, rehydrate it once
// from Supabase Storage and retry.
export async function cloneSpeak(text) {
  let voiceId;
  try {
    voiceId = await getActiveVoice();
  } catch {
    return null;
  }
  if (!voiceId) return null;

  try {
    return await synthesizeClone(text, voiceId);
  } catch (err) {
    if (err instanceof UnknownVoiceError) {
      try {
        const clip = await getClip(voiceId);
        await registerVoice(voiceId, clip);
        return await synthesizeClone(text, voiceId);
      } catch {
        return null;
      }
    }
    return null;
  }
}
