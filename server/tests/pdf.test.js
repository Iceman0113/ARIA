import { describe, it, expect } from 'vitest';
import { classifySource, expandHome, isPdfBytes, wrapUntrusted, buildPdfMessages } from '../src/pdf.js';
import os from 'node:os';

describe('classifySource', () => {
  it('detects url vs path', () => {
    expect(classifySource('https://x.com/a.pdf')).toBe('url');
    expect(classifySource('http://x.com/a.pdf')).toBe('url');
    expect(classifySource('/Users/r/a.pdf')).toBe('path');
    expect(classifySource('~/Desktop/a.pdf')).toBe('path');
  });
});

describe('expandHome', () => {
  it('expands a leading ~', () => {
    expect(expandHome('~/Desktop/a.pdf')).toBe(`${os.homedir()}/Desktop/a.pdf`);
    expect(expandHome('~')).toBe(os.homedir());
    expect(expandHome('/abs/a.pdf')).toBe('/abs/a.pdf');
  });
});

describe('isPdfBytes', () => {
  it('true only when %PDF appears near the start', () => {
    expect(isPdfBytes(Buffer.from('%PDF-1.4\n...'))).toBe(true);
    expect(isPdfBytes(Buffer.from('not a pdf'))).toBe(false);
    expect(isPdfBytes('%PDF')).toBe(false); // not a Buffer
  });
});

describe('wrapUntrusted', () => {
  it('wraps in untrusted-source tags', () => {
    expect(wrapUntrusted('hi')).toBe('<untrusted-source>\nhi\n</untrusted-source>');
  });
});

describe('buildPdfMessages', () => {
  it('builds a document block + instruction text block', () => {
    const m = buildPdfMessages('QkFTRTY0', 'list totals');
    expect(m).toEqual([{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QkFTRTY0' } },
        { type: 'text', text: 'list totals' },
      ],
    }]);
  });
});

import { readPdf } from '../src/pdf.js';

const PDF = Buffer.from('%PDF-1.4 fake body');
const fakeClient = { messages: { create: async () => ({ content: [{ type: 'text', text: 'INVOICE total $42' }] }) } };

describe('readPdf', () => {
  it('reads a local path and returns wrapped content', async () => {
    const out = await readPdf({ source: '/tmp/x.pdf', instruction: 'totals' }, {
      readFileImpl: async (p) => { expect(p).toBe('/tmp/x.pdf'); return PDF; },
      client: fakeClient,
    });
    expect(out.source).toBe('/tmp/x.pdf');
    expect(out.content).toBe('<untrusted-source>\nINVOICE total $42\n</untrusted-source>');
  });

  it('reads a url via fetch', async () => {
    const out = await readPdf({ source: 'https://x.com/a.pdf' }, {
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => PDF }),
      client: fakeClient,
    });
    expect(out.content).toContain('INVOICE');
  });

  it('errors (no throw) on missing source', async () => {
    expect((await readPdf({}, {})).error).toMatch(/source is required/);
  });

  it('errors on non-PDF bytes', async () => {
    const out = await readPdf({ source: '/tmp/x.txt' }, { readFileImpl: async () => Buffer.from('hello'), client: fakeClient });
    expect(out.error).toMatch(/not a PDF/);
  });

  it('errors on a failed url fetch', async () => {
    const out = await readPdf({ source: 'https://x.com/a.pdf' }, { fetchImpl: async () => ({ ok: false, status: 404 }) });
    expect(out.error).toMatch(/fetch failed \(404\)/);
  });

  it('errors when the file cannot be read', async () => {
    const out = await readPdf({ source: '/tmp/missing.pdf' }, { readFileImpl: async () => { throw new Error('ENOENT'); } });
    expect(out.error).toMatch(/could not load/);
  });
});
