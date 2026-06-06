// Pure helpers for the Forge local worker (no I/O — unit tested).

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inboxFilename(recordId, title) {
  return `${recordId}__${slugify(title).slice(0, 50)}.png`;
}

export function recordIdFromFilename(filename) {
  const base = String(filename).split('/').pop().replace(/\.[a-z0-9]+$/i, '');
  const id = base.split('__')[0];
  return /^rec[a-zA-Z0-9]+$/.test(id) ? id : null;
}

export function buildProductBody({
  uploadId, title, description, blueprintId, providerId, variantIds, prices,
}) {
  const variants = variantIds.map((id, i) => ({
    id,
    price: prices[i] ?? prices[prices.length - 1],
    is_enabled: true,
  }));
  return {
    title,
    description,
    blueprint_id: blueprintId,
    print_provider_id: providerId,
    variants,
    print_areas: [{
      variant_ids: variantIds,
      placeholders: [{
        position: 'front',
        images: [{ id: uploadId, x: 0.5, y: 0.5, scale: 1.0, angle: 0 }],
      }],
    }],
  };
}

export function mockupUrls(product) {
  return ((product && product.images) || []).map((i) => ({ url: i.src }));
}

export function buildImagePromptMessages(row) {
  const idea = row.Name || row.Title || '';
  const niche = row.Niche || 'funny';
  const system = "You are Forge, a print-on-demand t-shirt designer for GitFunny (original funny / developer-humor tees). "
    + "Given a product idea, reply with ONLY a single vivid image-generation prompt for the front-chest design: "
    + "state the exact text to display (in quotes) plus a simple complementary graphic or icon. One sentence, no preamble. "
    + "ORIGINAL artwork only — never reference copyrighted characters, brand or company logos, or celebrity likenesses. "
    + "Do NOT mention background color or 'mockup' — that styling is added later.";
  const user = `Idea: ${idea}\nNiche: ${niche}`;
  return { system, user };
}
