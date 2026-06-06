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
