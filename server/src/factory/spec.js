import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
export const AGENT_SPECS_DIR = join(dirname(__filename), '..', '..', 'agent-specs');

if (!existsSync(AGENT_SPECS_DIR)) {
  mkdirSync(AGENT_SPECS_DIR, { recursive: true });
}

/**
 * Write a human-readable spec markdown for an agent under review.
 *
 * @param {{slug:string, name:string, role:string, specialRequirements?:string, report:object}} args
 * @returns {{path:string}}
 */
export function writeAgentSpec({ slug, name, role, specialRequirements, report }) {
  const lines = [];
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(`**Slug:** \`dispatch_to_${slug}\``);
  lines.push(`**Domain:** ${report.domain}`);
  lines.push(`**Created:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Role');
  lines.push(role || '_(not provided)_');
  lines.push('');
  if (specialRequirements) {
    lines.push('## Special requirements');
    lines.push(specialRequirements);
    lines.push('');
  }
  lines.push('## Competencies');
  for (const c of report.competencies || []) lines.push(`- ${c}`);
  lines.push('');
  lines.push('## Granted tools');
  if ((report.tools_available || []).length === 0) {
    lines.push('_(none — agent will rely entirely on its prompt + reasoning)_');
  } else {
    for (const t of report.tools_available) lines.push(`- \`${t}\``);
  }
  lines.push('');
  lines.push('## Wishlist tools (not yet built)');
  if ((report.tools_wishlist || []).length === 0) {
    lines.push('_(none)_');
  } else {
    for (const t of report.tools_wishlist) {
      const dep = t.external_dependency ? ` — depends on \`${t.external_dependency}\`` : '';
      lines.push(`- \`${t.name}\` — ${t.purpose}${dep}`);
    }
  }
  lines.push('');
  lines.push('## Design patterns');
  for (const p of report.design_patterns || []) lines.push(`- ${p}`);
  lines.push('');
  lines.push('## Sources');
  for (const s of report.sources || []) {
    lines.push(`- [${s.title}](${s.url}) — "${s.excerpt}"`);
  }
  lines.push('');

  const path = join(AGENT_SPECS_DIR, `${slug}.md`);
  writeFileSync(path, lines.join('\n'), 'utf-8');
  return { path };
}
