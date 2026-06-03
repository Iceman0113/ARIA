export const TRANSITIONS = {
  pending:           new Set(['researching',       'failed']),
  researching:       new Set(['drafting_spec',     'failed']),
  drafting_spec:     new Set(['writing_prompt',    'failed']),
  writing_prompt:    new Set(['awaiting_approval', 'failed']),
  awaiting_approval: new Set(['approved', 'rejected', 'writing_prompt', 'failed']),
  approved:          new Set(),
  rejected:          new Set(),
  failed:            new Set(),
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
