import { describe, it, expect } from 'vitest';
import { useVoiceAmplitude } from './useVoiceAmplitude.js';
describe('useVoiceAmplitude', () => {
  it('returns 0 without a voice engine', () => { expect(useVoiceAmplitude(null)()).toBe(0); });
  it('reads getTtsAmplitude when present', () => { expect(useVoiceAmplitude({ getTtsAmplitude: () => 0.5 })()).toBe(0.5); });
});
