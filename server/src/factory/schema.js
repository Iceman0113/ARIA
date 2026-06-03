import { z } from 'zod';

export const SkillsReportSchema = z.object({
  domain: z.string().min(1),
  competencies: z.array(z.string().min(1)).min(1).max(20),
  tools_available: z.array(z.string()).default([]),
  tools_wishlist: z.array(z.object({
    name: z.string().min(1),
    purpose: z.string().min(1),
    external_dependency: z.string().optional(),
  })).default([]),
  design_patterns: z.array(z.string()).default([]),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string().min(1),
    excerpt: z.string().max(400),
  })).min(1),
});

export function validateSkillsReport(payload) {
  const r = SkillsReportSchema.safeParse(payload);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.errors[0];
  return { ok: false, error: `${first.path.join('.')}: ${first.message}` };
}
