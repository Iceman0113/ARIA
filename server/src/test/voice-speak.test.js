import { describe, it, expect, vi, beforeEach } from 'vitest';

const { UnknownVoiceError } = vi.hoisted(() => {
  class UnknownVoiceError extends Error {}
  return { UnknownVoiceError };
});

const mocks = {
  getActiveVoice: vi.fn(),
  synthesizeClone: vi.fn(),
  registerVoice: vi.fn(),
  getClip: vi.fn(),
};

vi.mock('../voice/storage.js', () => ({
  getActiveVoice: (...a) => mocks.getActiveVoice(...a),
  getClip: (...a) => mocks.getClip(...a),
}));
vi.mock('../voice/client.js', () => ({
  synthesizeClone: (...a) => mocks.synthesizeClone(...a),
  registerVoice: (...a) => mocks.registerVoice(...a),
  UnknownVoiceError,
}));

import { cloneSpeak } from '../voice/speak.js';

beforeEach(() => { Object.values(mocks).forEach(m => m.mockReset()); });

describe('cloneSpeak', () => {
  it('returns null when no active voice (caller falls back to Edge)', async () => {
    mocks.getActiveVoice.mockResolvedValue(null);
    expect(await cloneSpeak('hello')).toBe(null);
  });

  it('returns WAV buffer when active voice synthesizes', async () => {
    mocks.getActiveVoice.mockResolvedValue('aria');
    mocks.synthesizeClone.mockResolvedValue(Buffer.from('RIFFok'));
    const buf = await cloneSpeak('hello');
    expect(buf.toString()).toBe('RIFFok');
  });

  it('rehydrates from Supabase then retries on UnknownVoiceError', async () => {
    mocks.getActiveVoice.mockResolvedValue('aria');
    mocks.synthesizeClone
      .mockRejectedValueOnce(new UnknownVoiceError('aria'))
      .mockResolvedValueOnce(Buffer.from('RIFFafter'));
    mocks.getClip.mockResolvedValue(Buffer.from('RIFFclip'));
    mocks.registerVoice.mockResolvedValue({});
    const buf = await cloneSpeak('hello');
    expect(mocks.getClip).toHaveBeenCalledWith('aria');
    expect(mocks.registerVoice).toHaveBeenCalledWith('aria', expect.any(Buffer));
    expect(buf.toString()).toBe('RIFFafter');
  });

  it('returns null when clone service errors (caller falls back to Edge)', async () => {
    mocks.getActiveVoice.mockResolvedValue('aria');
    mocks.synthesizeClone.mockRejectedValue(new Error('connection refused'));
    expect(await cloneSpeak('hello')).toBe(null);
  });
});
