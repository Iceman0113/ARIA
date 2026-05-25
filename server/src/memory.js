import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const MEMORY_FILE = './aria-memory.json';

const DEFAULTS = () => ({
  version: 1,
  lastUpdated: null,
  entries: [],
  sessions: [],
});

function load() {
  try {
    if (!existsSync(MEMORY_FILE)) return DEFAULTS();
    return JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {
    return DEFAULTS();
  }
}

function save(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Memory save error:', err.message);
  }
}

// ── Entry CRUD ────────────────────────────────────────────────────

export function upsertEntry({ type, key, value, resolved }) {
  const data = load();
  const now = new Date().toISOString();
  const existing = data.entries.find(e => e.type === type && e.key === key);

  if (existing) {
    existing.value = value;
    existing.updatedAt = now;
    if (resolved !== undefined) existing.resolved = resolved;
  } else {
    data.entries.push({
      id: randomUUID(),
      type,
      key,
      value,
      resolved: resolved ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }

  save(data);
  return { saved: true, key, type };
}

export function resolveIssue(key) {
  const data = load();
  const entry = data.entries.find(e => e.key === key && e.type === 'issue');
  if (entry) {
    entry.resolved = true;
    entry.updatedAt = new Date().toISOString();
    save(data);
    return { resolved: true };
  }
  return { resolved: false, error: 'Issue not found' };
}

export function deleteEntry(key) {
  const data = load();
  const before = data.entries.length;
  data.entries = data.entries.filter(e => e.key !== key);
  if (data.entries.length < before) {
    save(data);
    return { deleted: true };
  }
  return { deleted: false };
}

// ── Session storage ───────────────────────────────────────────────

export function addSession({ summary, keyPoints, messageCount }) {
  const data = load();
  data.sessions.unshift({
    id: randomUUID(),
    date: new Date().toISOString(),
    summary,
    keyPoints: keyPoints || [],
    messageCount,
  });
  // Keep last 20 sessions
  data.sessions = data.sessions.slice(0, 20);
  save(data);
}

// ── Context builder for system prompt ────────────────────────────

export function buildMemoryBlock() {
  const data = load();
  if (!data.entries.length && !data.sessions.length) return '';

  const byType = (type) => data.entries.filter(e => e.type === type && !e.resolved);
  const goals       = byType('goal');
  const decisions   = byType('decision');
  const issues      = byType('issue');
  const context     = byType('context');
  const preferences = byType('preference');
  const recentSession = data.sessions[0];

  const lines = ['YOUR PERSISTENT MEMORY:', '─────────────────────────────'];

  if (goals.length)       lines.push(`GOALS: ${goals.map(e => e.value).join(' · ')}`);
  if (context.length)     lines.push(`CONTEXT: ${context.map(e => e.value).join(' · ')}`);
  if (decisions.length)   lines.push(`DECISIONS: ${decisions.map(e => `${e.updatedAt.slice(0, 10)}: ${e.value}`).join(' · ')}`);
  if (issues.length)      lines.push(`KNOWN ISSUES: ${issues.map(e => e.value).join(' · ')}`);
  if (preferences.length) lines.push(`PREFERENCES: ${preferences.map(e => e.value).join(' · ')}`);

  if (recentSession) {
    const date = new Date(recentSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    lines.push(`LAST SESSION (${date}): ${recentSession.summary}`);
  }

  lines.push('─────────────────────────────');
  lines.push('Reference this naturally. Update memory when you learn something new.');

  return lines.join('\n');
}

// ── Read for API / UI ─────────────────────────────────────────────

export function getMemory() {
  return load();
}
