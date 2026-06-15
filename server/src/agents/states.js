export const AGENT_TASK_STATES = [
  'queued',
  'running',
  'awaiting_approval',
  'approved',
  'rejected',
  'failed',
];

export const TRANSITIONS = {
  queued:             new Set(['running', 'failed']),
  running:            new Set(['awaiting_approval', 'failed']),
  awaiting_approval:  new Set(['approved', 'rejected', 'failed']),
  approved:           new Set(),
  rejected:           new Set(),
  failed:             new Set(),
};

export const TerminalStates = new Set(['approved', 'rejected', 'failed']);

export function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`invalid state transition: ${from} → ${to}`);
  }
}
