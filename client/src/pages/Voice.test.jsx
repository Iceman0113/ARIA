import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Voice from './Voice.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).endsWith('/voices')) {
      return { ok: true, json: async () => ({ voices: [{ voice_id: 'aria', name: 'ARIA' }], active: 'aria' }) };
    }
    return { ok: true, json: async () => ({}) };
  }));
});
afterEach(() => vi.restoreAllMocks());

describe('<Voice>', () => {
  it('lists voices and marks the active one', async () => {
    render(<Voice serverUrl="ws://localhost:3001" />);
    await waitFor(() => expect(screen.getByText('ARIA')).toBeInTheDocument());
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });
});
