import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Voice from './Voice.jsx';

// ── Mock voiceEngine so preview() never makes real calls ──────────────────────
vi.mock('../Voice.js', () => ({
  voice: {
    speakWithServer: vi.fn(),
  },
}));
import { voice as voiceEngine } from '../Voice.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFetch({ voices = [], active = null } = {}) {
  return vi.fn(async (url, opts) => {
    const u = String(url);
    // GET /voices — returns the configured list
    if (u.endsWith('/voices') && (!opts || !opts.method || opts.method === 'GET')) {
      return { ok: true, json: async () => ({ voices, active }) };
    }
    // POST /voices?name=... (upload)
    if (u.includes('/voices?name=') && opts?.method === 'POST') {
      return { ok: true, json: async () => ({}) };
    }
    // POST /voices/active
    if (u.endsWith('/voices/active') && opts?.method === 'POST') {
      return { ok: true, json: async () => ({}) };
    }
    // DELETE /voices/:id
    if (/\/voices\//.test(u) && opts?.method === 'DELETE') {
      return { ok: true, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── Existing test (keep passing) ──────────────────────────────────────────────
describe('<Voice> — existing behavior', () => {
  it('lists voices and marks the active one', async () => {
    vi.stubGlobal('fetch', makeFetch({
      voices: [{ voice_id: 'aria', name: 'ARIA', created_at: '' }],
      active: 'aria',
    }));
    render(<Voice serverUrl="ws://localhost:3001" />);
    // Name appears in both hero and row — use getAllByText
    await waitFor(() => expect(screen.getAllByText('ARIA').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });
});

// ── New tests — cosmic Studio Panel structure ─────────────────────────────────
describe('<Voice> — Active Voice Hero', () => {
  it('shows the active voice name + Preview button in the hero when active is set', async () => {
    vi.stubGlobal('fetch', makeFetch({
      voices: [{ voice_id: 'v1', name: 'Maggie', created_at: '' }],
      active: 'v1',
    }));
    render(<Voice serverUrl="ws://localhost:3001" />);

    // Name appears in both hero and row — wait for at least one instance
    await waitFor(() => expect(screen.getAllByText('Maggie').length).toBeGreaterThan(0));
    // hero should contain the name
    const hero = document.querySelector('.voice-hero');
    expect(hero).toBeTruthy();
    expect(hero.textContent).toContain('Maggie');
    // preview button visible
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
  });

  it('clicking Preview calls voiceEngine.speakWithServer', async () => {
    vi.stubGlobal('fetch', makeFetch({
      voices: [{ voice_id: 'v1', name: 'Maggie', created_at: '' }],
      active: 'v1',
    }));
    render(<Voice serverUrl="ws://localhost:3001" />);

    await waitFor(() => screen.getByRole('button', { name: /preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    expect(voiceEngine.speakWithServer).toHaveBeenCalledTimes(1);
    expect(voiceEngine.speakWithServer).toHaveBeenCalledWith(
      expect.stringContaining('cofounder'),
      'ws://localhost:3001',
      {},
    );
  });

  it('shows empty-state text in the hero when active is null', async () => {
    vi.stubGlobal('fetch', makeFetch({
      voices: [{ voice_id: 'v1', name: 'Maggie', created_at: '' }],
      active: null,
    }));
    render(<Voice serverUrl="ws://localhost:3001" />);

    await waitFor(() => screen.getByText('Maggie'));
    expect(screen.getByText(/no active voice yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull();
  });
});

describe('<Voice> — Voice list rows', () => {
  it('renders a row for each voice', async () => {
    vi.stubGlobal('fetch', makeFetch({
      voices: [
        { voice_id: 'v1', name: 'Maggie', created_at: '' },
        { voice_id: 'v2', name: 'Rex', created_at: '' },
      ],
      active: 'v1',
    }));
    render(<Voice serverUrl="ws://localhost:3001" />);

    // Maggie appears in hero + row; Rex only in row — check via row class
    await waitFor(() => expect(screen.getAllByText('Maggie').length).toBeGreaterThan(0));
    expect(screen.getByText('Rex')).toBeInTheDocument();
  });

  it('clicking "Set active" on a non-active voice POSTs to /voices/active', async () => {
    const fetchMock = makeFetch({
      voices: [
        { voice_id: 'v1', name: 'Maggie', created_at: '' },
        { voice_id: 'v2', name: 'Rex', created_at: '' },
      ],
      active: 'v1',
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<Voice serverUrl="ws://localhost:3001" />);

    await waitFor(() => screen.getByText('Rex'));
    fireEvent.click(screen.getByRole('button', { name: /set active/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const activePost = calls.find(
        ([url, opts]) =>
          String(url).endsWith('/voices/active') && opts?.method === 'POST',
      );
      expect(activePost).toBeTruthy();
      const body = JSON.parse(activePost[1].body);
      expect(body.voice_id).toBe('v2');
    });
  });

  it('clicking ✕ (delete) sends DELETE /voices/:id', async () => {
    const fetchMock = makeFetch({
      voices: [
        { voice_id: 'v1', name: 'Maggie', created_at: '' },
      ],
      active: 'v1',
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<Voice serverUrl="ws://localhost:3001" />);

    await waitFor(() => expect(screen.getAllByText('Maggie').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /delete maggie/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const del = calls.find(
        ([url, opts]) =>
          String(url).includes('/voices/') && opts?.method === 'DELETE',
      );
      expect(del).toBeTruthy();
    });
  });

  it('shows empty-list state when voices is empty', async () => {
    vi.stubGlobal('fetch', makeFetch({ voices: [], active: null }));
    render(<Voice serverUrl="ws://localhost:3001" />);

    await waitFor(() =>
      expect(screen.getByText(/no cloned voices yet/i)).toBeInTheDocument(),
    );
  });
});

describe('<Voice> — Upload card', () => {
  it('clicking Upload clip triggers POST /voices?name=...', async () => {
    const fetchMock = makeFetch({ voices: [], active: null });
    vi.stubGlobal('fetch', fetchMock);
    render(<Voice serverUrl="ws://localhost:3001" />);

    await waitFor(() => screen.getByRole('button', { name: /upload clip/i }));

    // Attach a fake file to the hidden file input
    const fileInput = document.querySelector('input[type="file"]');
    const fakeFile = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });

    // Set the name field
    const nameInput = screen.getByPlaceholderText(/voice name/i);
    fireEvent.change(nameInput, { target: { value: 'TestVoice' } });

    fireEvent.click(screen.getByRole('button', { name: /upload clip/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const upload = calls.find(
        ([url, opts]) =>
          String(url).includes('/voices?name=') && opts?.method === 'POST',
      );
      expect(upload).toBeTruthy();
      expect(String(upload[0])).toContain('TestVoice');
    });
  });
});
