import { describe, it, expect } from 'vitest';
import { makeAirtable } from '../src/airtable.js';

describe('airtable client', () => {
  it('lists items mapping record id + fields into flat objects', async () => {
    const fakeFetch = async (url, opts) => {
      expect(url).toBe('https://api.airtable.com/v0/appTEST/Products');
      expect(opts.headers.Authorization).toBe('Bearer key123');
      return {
        ok: true,
        json: async () => ({ records: [
          { id: 'rec1', fields: { Title: 'Cat Dad Tee', Status: 'Published', Price: 24.99 } },
        ] }),
      };
    };
    const at = makeAirtable({ apiKey: 'key123', baseId: 'appTEST', fetchImpl: fakeFetch });
    const items = await at.listItems();
    expect(items).toEqual([{ id: 'rec1', Title: 'Cat Dad Tee', Status: 'Published', Price: 24.99 }]);
  });

  it('throws on non-ok response', async () => {
    const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    const at = makeAirtable({ apiKey: 'k', baseId: 'b', fetchImpl: fakeFetch });
    await expect(at.listItems()).rejects.toThrow('Airtable 403');
  });

  it('updateItem PATCHes fields and returns the flattened record', async () => {
    const fakeFetch = async (url, opts) => {
      expect(url).toBe('https://api.airtable.com/v0/appT/Products/rec1');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ fields: { Status: 'Built' } });
      return { ok: true, json: async () => ({ id: 'rec1', fields: { Status: 'Built' } }) };
    };
    const at = makeAirtable({ apiKey: 'k', baseId: 'appT', fetchImpl: fakeFetch });
    expect(await at.updateItem('rec1', { Status: 'Built' })).toEqual({ id: 'rec1', Status: 'Built' });
  });

  it('getItem fetches a single record flattened', async () => {
    const fakeFetch = async (url) => {
      expect(url).toBe('https://api.airtable.com/v0/appT/Products/rec9');
      return { ok: true, json: async () => ({ id: 'rec9', fields: { Title: 'X' } }) };
    };
    const at = makeAirtable({ apiKey: 'k', baseId: 'appT', fetchImpl: fakeFetch });
    expect(await at.getItem('rec9')).toEqual({ id: 'rec9', Title: 'X' });
  });
});
