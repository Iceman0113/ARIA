import { describe, it, expect } from 'vitest';
import { makeAirtable } from '../src/airtable.js';

describe('airtable client', () => {
  it('lists items mapping record id + fields into flat objects', async () => {
    const fakeFetch = async (url, opts) => {
      expect(url).toBe('https://api.airtable.com/v0/appTEST/Items');
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
});
