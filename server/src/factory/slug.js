export const RESERVED_SLUGS = new Set(['scout', 'hunter', 'creative', 'hermes', 'factory']);

export function slugify(input) {
  if (!input) return '';
  return input
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function isReserved(input) {
  return RESERVED_SLUGS.has(slugify(input));
}
