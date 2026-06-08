import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getClient } from './anthropic.js';

export function classifySource(source) {
  return /^https?:\/\//i.test(String(source)) ? 'url' : 'path';
}

export function expandHome(p) {
  const s = String(p);
  if (s === '~') return os.homedir();
  if (s.startsWith('~/')) return path.join(os.homedir(), s.slice(2));
  return s;
}

export function isPdfBytes(buf) {
  return Buffer.isBuffer(buf) && buf.subarray(0, 1024).toString('latin1').includes('%PDF');
}

export function wrapUntrusted(text) {
  return `<untrusted-source>\n${text}\n</untrusted-source>`;
}

export function buildPdfMessages(base64, instruction) {
  return [{
    role: 'user',
    content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: instruction },
    ],
  }];
}
