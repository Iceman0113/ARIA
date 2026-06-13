import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { normalizeClip } from '../voice/normalize.js';

// Generate a 3s 440Hz stereo MP3 in memory as the "uploaded" source.
function sampleMp3() {
  return execFileSync('ffmpeg', [
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-ac', '2', '-f', 'mp3', 'pipe:1',
  ], { maxBuffer: 1 << 24 });
}

describe('normalizeClip', () => {
  it('returns a mono 24kHz WAV buffer', async () => {
    const out = await normalizeClip(sampleMp3());
    expect(out.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(out.subarray(8, 12).toString('ascii')).toBe('WAVE');
    // num-channels field in the WAV fmt chunk (offset 22) must be 1 (mono)
    expect(out.readUInt16LE(22)).toBe(1);
  });
});
