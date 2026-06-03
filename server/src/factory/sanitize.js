export class SanitizeError extends Error {
  constructor(message, pattern) {
    super(message);
    this.name = 'SanitizeError';
    this.pattern = pattern;
  }
}

const ROLE_ESCAPE_PATTERNS = [
  /ignore (?:previous|prior|all) instructions/i,
  /\bsystem\s*:/i,
  /\byou are now\b/i,
  /\bact as (?:a |an )?(?:system|admin|root)/i,
];

const FENCE_INNER_PATTERNS = [
  /system\s*:/i,
  /assistant\s*:/i,
  /ignore (?:previous|prior|all)/i,
];

const MAX_LEN = 1500;

// Invisible/zero-width characters stripped before scanning so they can't be
// used to hide a role-escape token between letters (e.g. a soft hyphen inside
// "system:"). \u escapes keep the source readable and unambiguous:
//   U+200B-U+200F  zero-width space/joiners + directional marks
//   U+FEFF         BOM / zero-width no-break space
//   U+00AD         soft hyphen
//   U+034F         combining grapheme joiner
//   U+2060         word joiner
//   U+2062-U+2064  invisible math operators
const INVISIBLE_CHARS = /[​-‏﻿­͏⁠⁢-⁤]/g;
// C0/C1 control chars, keeping \n (\x0A), \r (\x0D), \t (\x09) for readability.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Strip control chars + zero-width chars. Refuse role-escape patterns.
 * Returns the cleaned string. Throws SanitizeError on rejection.
 */
export function sanitize(raw) {
  if (typeof raw !== 'string') throw new SanitizeError('input must be a string', 'type');
  if (raw.length > MAX_LEN) {
    throw new SanitizeError(`input exceeds ${MAX_LEN} chars`, 'length');
  }

  // Strip invisible chars then control chars (keep \n, \r, \t for readability).
  const cleaned = raw.replace(INVISIBLE_CHARS, '').replace(CONTROL_CHARS, '');

  // Top-level role-escape scan.
  for (const re of ROLE_ESCAPE_PATTERNS) {
    if (re.test(cleaned)) {
      throw new SanitizeError(`refused: matched role-escape pattern ${re}`, cleaned.match(re)[0]);
    }
  }

  // Code-fence inspection.
  const fenceRe = /```[\s\S]*?```/g;
  let m;
  while ((m = fenceRe.exec(cleaned))) {
    const inner = m[0];
    for (const re of FENCE_INNER_PATTERNS) {
      if (re.test(inner)) {
        throw new SanitizeError(`refused: code fence contains role-escape pattern ${re}`, inner.match(re)[0]);
      }
    }
  }

  return cleaned;
}
