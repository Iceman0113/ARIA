// Returns a stable getter () => 0..1 reading the live TTS amplitude from the voice engine.
export function useVoiceAmplitude(voice) {
  return () => (voice && typeof voice.getTtsAmplitude === 'function' ? voice.getTtsAmplitude() : 0);
}
