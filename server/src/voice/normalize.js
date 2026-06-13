import { spawn } from 'node:child_process';

// Normalize any uploaded audio into the clip XTTS wants: mono, 24kHz, <=15s,
// leading/trailing silence trimmed. Pipes through ffmpeg with no temp files.
export function normalizeClip(inputBuffer) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ac', '1',
      '-ar', '24000',
      '-t', '15',
      '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:stop_periods=1:stop_threshold=-50dB',
      '-f', 'wav', 'pipe:1',
    ];
    const ff = spawn('ffmpeg', args);
    const chunks = [];
    const errChunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => errChunks.push(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(errChunks)}`));
      resolve(Buffer.concat(chunks));
    });
    ff.stdin.on('error', () => {}); // ignore EPIPE if ffmpeg rejects input early
    ff.stdin.write(inputBuffer);
    ff.stdin.end();
  });
}
