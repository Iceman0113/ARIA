import { describe, it, expect } from 'vitest';
import {
  slugify, inboxFilename, recordIdFromFilename, buildProductBody, mockupUrls,
} from '../src/forge/worker-lib.js';

describe('slugify', () => {
  it('makes a filesystem-safe slug', () => {
    expect(slugify('Works On My Machine!')).toBe('works-on-my-machine');
    expect(slugify("It's always DNS")).toBe('it-s-always-dns');
  });
});

describe('inboxFilename', () => {
  it('embeds the record id before a __ separator', () => {
    expect(inboxFilename('rec123', 'Works On My Machine')).toBe('rec123__works-on-my-machine.png');
  });
});

describe('recordIdFromFilename', () => {
  it('extracts the record id from the filename (with or without path/slug)', () => {
    expect(recordIdFromFilename('rec123__works-on-my-machine.png')).toBe('rec123');
    expect(recordIdFromFilename('/Users/x/Desktop/Forge/ready/rec123__foo.png')).toBe('rec123');
    expect(recordIdFromFilename('recABC.png')).toBe('recABC');
  });
  it('returns null for non-record filenames', () => {
    expect(recordIdFromFilename('.DS_Store')).toBe(null);
    expect(recordIdFromFilename('random.png')).toBe(null);
  });
});

describe('buildProductBody', () => {
  it('builds a Printify product with variants + front print placement', () => {
    const body = buildProductBody({
      uploadId: 'up1', title: 'T', description: 'D',
      blueprintId: 6, providerId: 217, variantIds: [1, 2], prices: [2499, 2699],
    });
    expect(body.blueprint_id).toBe(6);
    expect(body.print_provider_id).toBe(217);
    expect(body.variants).toEqual([
      { id: 1, price: 2499, is_enabled: true },
      { id: 2, price: 2699, is_enabled: true },
    ]);
    expect(body.print_areas[0].variant_ids).toEqual([1, 2]);
    expect(body.print_areas[0].placeholders[0].position).toBe('front');
    expect(body.print_areas[0].placeholders[0].images[0].id).toBe('up1');
  });
});

describe('mockupUrls', () => {
  it('maps product images to Airtable attachment objects', () => {
    expect(mockupUrls({ images: [{ src: 'a' }, { src: 'b' }] })).toEqual([{ url: 'a' }, { url: 'b' }]);
    expect(mockupUrls({})).toEqual([]);
  });
});
