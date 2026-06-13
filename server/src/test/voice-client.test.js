import { describe, it, expect, vi, afterEach } from 'vitest';
import { synthesizeClone, registerVoice, UnknownVoiceError } from '../voice/client.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('voice client', () => {
  it('returns a Buffer of WAV bytes on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      arrayBuffer: async () => new TextEncoder().encode('RIFFdata').buffer,
    })));
    const buf = await synthesizeClone('hello', 'aria');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe('RIFF');
  });

  it('throws UnknownVoiceError on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => 'nope' })));
    await expect(synthesizeClone('hi', 'ghost')).rejects.toBeInstanceOf(UnknownVoiceError);
  });

  it('registerVoice POSTs clip bytes to the service', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ voices: ['aria'] }) }));
    vi.stubGlobal('fetch', fetchMock);
    await registerVoice('aria', Buffer.from('RIFFfake'));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/voices\/aria$/);
    expect(opts.method).toBe('POST');
  });
});
