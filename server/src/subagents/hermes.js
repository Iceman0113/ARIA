// Hermes sub-agent — delegates a task to Nous Research's Hermes Agent CLI.
// Hermes adds persistent memory, 40+ tools, and multi-channel reach that ARIA
// doesn't have natively. ARIA spawns `hermes chat -Q -q "<task>"` as a
// subprocess and returns Hermes's reply to the agent loop.
//
// Setup: `hermes` must be on PATH (or HERMES_BIN env var pointing at the
// binary). Default install path: ~/.local/bin/hermes
// Config: ~/.hermes/config.yaml (model: claude-sonnet-4-5, provider: anthropic)
// Auth:   ~/.hermes/.env (ANTHROPIC_API_KEY — same key ARIA uses)

import { spawn } from 'child_process';
import { homedir } from 'os';

const HERMES_BIN = process.env.HERMES_BIN || `${homedir()}/.local/bin/hermes`;
const HERMES_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS) || 60_000;

/**
 * Spawn `hermes chat -Q -q "<task>"` and return Hermes's response text.
 *
 * @param {{ task: string }} input
 * @param {(event: object) => void} [onEvent]  optional progress event sink
 * @returns {Promise<{ response: string, sessionId: string|null, durationMs: number }>}
 */
export async function runHermes(input, onEvent) {
  const task = (input?.task || '').trim();
  if (!task) {
    return { error: 'Hermes requires a task — none provided.' };
  }

  const t0 = Date.now();
  onEvent?.({ type: 'tool_call', name: 'delegate_to_hermes', detail: { task: task.slice(0, 120) } });

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(HERMES_BIN, ['chat', '-Q', '-q', task], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({ error: `Could not spawn hermes (${HERMES_BIN}): ${err.message}` });
    }

    let stdout = '';
    let stderr = '';
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      result.durationMs = Date.now() - t0;
      resolve(result);
    };

    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      finish({ error: `Hermes timed out after ${HERMES_TIMEOUT_MS}ms`, partialOutput: stdout.slice(-500) });
    }, HERMES_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        finish({ error: `Hermes binary not found at ${HERMES_BIN}. Install via the curl script at hermes-agent.nousresearch.com or set HERMES_BIN.` });
      } else {
        finish({ error: `Hermes spawn error: ${err.message}` });
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const parsed = parseHermesOutput(stdout);
      if (code !== 0 && !parsed.response) {
        return finish({
          error: `Hermes exited with code ${code}`,
          stderr: stderr.slice(0, 500),
          stdout: stdout.slice(0, 500),
        });
      }
      finish({
        response: parsed.response,
        sessionId: parsed.sessionId,
      });
    });
  });
}

/**
 * Hermes -Q output format:
 *   <blank line>
 *   session_id: <id>
 *   <one or more lines of response>
 *
 * Strip the session_id line, trim, and return both pieces.
 */
function parseHermesOutput(stdout) {
  const lines = stdout.split('\n');
  let sessionId = null;
  const responseLines = [];
  for (const line of lines) {
    const m = line.match(/^session_id:\s*(\S+)/);
    if (m) {
      sessionId = m[1];
      continue;
    }
    responseLines.push(line);
  }
  // Trim leading/trailing blank lines but preserve internal structure
  const response = responseLines.join('\n').replace(/^\s+|\s+$/g, '');
  return { response, sessionId };
}
