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
