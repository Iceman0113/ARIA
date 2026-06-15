import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../cosmic/CosmicStage.jsx', () => ({ default: () => null }));
vi.mock('../shell/MicBar.jsx', () => ({ default: () => null }));

import Console from './Console.jsx';

// Default fetch mock: agent tasks endpoint returns empty list, approvals return empty
function makeFetch(agentTasksBySlug = {}) {
  return vi.fn(async (url) => {
    // Per-agent tasks: GET /agents/:slug/tasks
    const agentTaskMatch = url.match(/\/agents\/([^/]+)\/tasks$/);
    if (agentTaskMatch) {
      const slug = agentTaskMatch[1];
      const tasks = agentTasksBySlug[slug] || [];
      return { ok: true, status: 200, json: async () => ({ tasks }) };
    }
    // POST /agents/:slug/tasks — add task
    if (url.match(/\/agents\/[^/]+\/tasks$/) || url.includes('/agents/') && url.includes('/tasks')) {
      return { ok: true, status: 201, json: async () => ({ id: 'new-task', text: 'test', state: 'queued', slug: 'hunter' }) };
    }
    // Approvals: factory pending
    if (url.includes('/factory/pending')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    // Approvals: agent tasks awaiting approval
    if (url.includes('/agents/tasks')) {
      return { ok: true, status: 200, json: async () => { return { tasks: [] }; } };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

beforeEach(() => {
  global.fetch = makeFetch();
});

describe('Console live data', () => {
  it('docks a working agent from workStates', () => {
    const { container } = render(
      <Console
        status="idle"
        workStates={{ hunter: { state: 'working' } }}
      />
    );
    // .dcard is the class for docked/working agent cards in the dock strip
    expect(container.querySelector('.dcard')).toBeTruthy();
  });

  it('roaming agents do not appear in the dock', () => {
    const { container } = render(
      <Console
        status="idle"
        workStates={{ hunter: { state: 'idle' } }}
      />
    );
    expect(container.querySelector('.dcard')).toBeFalsy();
    // but the agent should still appear as a roamer
    expect(container.querySelector('.roamer')).toBeTruthy();
  });

  it('renders activity cards from actions and intel', () => {
    const { container } = render(
      <Console
        status="idle"
        actions={[
          { id: 'a-0', title: 'Follow up with Bridgepoint', meta: 'Hunter', due: 'Today', urgency: 'hot' },
        ]}
        intel={[
          { id: 'i-0', agent: 'scout', source: 'signal', msg: 'Wayfinder dropped Starter plan price', time: '2m' },
        ]}
      />
    );
    // Should have at least 2 .acard elements (one action + one intel)
    expect(container.querySelectorAll('.acard').length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty-state message when actions and intel are both empty', () => {
    const { container } = render(
      <Console status="idle" actions={[]} intel={[]} />
    );
    // .acard list should be empty
    expect(container.querySelectorAll('.acard').length).toBe(0);
    // empty state message should appear
    expect(container.querySelector('.apv-empty')).toBeTruthy();
  });

  it('renders action card with title and meta+due', () => {
    const { container } = render(
      <Console
        status="idle"
        actions={[{ id: 'a-1', title: 'Send proposal', meta: 'Pixel Pools', due: 'Overdue', urgency: 'hot' }]}
      />
    );
    const card = container.querySelector('.acard');
    expect(card.querySelector('.t1').textContent).toBe('Send proposal');
    expect(card.querySelector('.t2').textContent).toContain('Pixel Pools');
    expect(card.querySelector('.t2').textContent).toContain('Overdue');
  });

  it('renders intel card with msg and agent/source/time', () => {
    const { container } = render(
      <Console
        status="idle"
        intel={[{ id: 'i-1', agent: 'beacon', source: 'inbox', msg: 'Morning brief ready', time: '5s' }]}
      />
    );
    const cards = container.querySelectorAll('.acard');
    // intel is the second section; actions section is empty so only 1 card total
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector('.t1').textContent).toBe('Morning brief ready');
    expect(cards[0].querySelector('.t2').textContent).toContain('beacon');
  });
});

describe('Console Agent Tasking CRUD', () => {
  it('renders an add-row input for each agent', async () => {
    const { container } = render(<Console status="idle" />);
    // There are 6 agents; each should have an addrow with an input
    await waitFor(() => {
      const inputs = container.querySelectorAll('.addrow input');
      expect(inputs.length).toBe(6);
    });
  });

  it('add-row input has correct placeholder for the agent', async () => {
    const { container } = render(<Console status="idle" />);
    await waitFor(() => {
      const input = container.querySelector('.addrow input[data-agent="hunter"]');
      expect(input).toBeTruthy();
      expect(input.placeholder).toContain('Hunter');
    });
  });

  it('submitting the add-row POSTs to /agents/:slug/tasks', async () => {
    global.fetch = makeFetch();
    const { container } = render(<Console status="idle" />);

    await waitFor(() => {
      expect(container.querySelector('.addrow input[data-agent="hunter"]')).toBeTruthy();
    });

    const input = container.querySelector('.addrow input[data-agent="hunter"]');
    fireEvent.change(input, { target: { value: 'Research top prospects' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => url === '/agents/hunter/tasks' && opts?.method === 'POST'
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(postCall[1].body);
      expect(body.text).toBe('Research top prospects');
    });
  });

  it('clicking the + button also POSTs to /agents/:slug/tasks', async () => {
    global.fetch = makeFetch();
    const { container } = render(<Console status="idle" />);

    await waitFor(() => {
      expect(container.querySelector('.addrow input[data-agent="scout"]')).toBeTruthy();
    });

    const input = container.querySelector('.addrow input[data-agent="scout"]');
    fireEvent.change(input, { target: { value: 'Scan competitor pricing' } });

    // Find the + button next to scout's addrow
    const addrow = input.closest('.addrow');
    const btn = addrow.querySelector('button');
    fireEvent.click(btn);

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) => url === '/agents/scout/tasks' && opts?.method === 'POST'
      );
      expect(postCall).toBeTruthy();
    });
  });

  it('renders existing queued tasks with a remove button', async () => {
    global.fetch = makeFetch({
      hunter: [{ id: 'qt1', text: 'Follow up leads', state: 'queued', slug: 'hunter' }],
    });

    const { container } = render(<Console status="idle" />);

    await waitFor(() => {
      const taskRows = container.querySelectorAll('.task');
      expect(taskRows.length).toBeGreaterThanOrEqual(1);
    });

    const taskRow = container.querySelector('.task');
    expect(taskRow.querySelector('.txt').textContent).toBe('Follow up leads');
    // Queued tasks have an .x remove button
    expect(taskRow.querySelector('.x')).toBeTruthy();
  });

  it('non-queued tasks show state label instead of remove button', async () => {
    global.fetch = makeFetch({
      hunter: [{ id: 'rt1', text: 'Running task', state: 'running', slug: 'hunter' }],
    });

    const { container } = render(<Console status="idle" />);

    await waitFor(() => {
      const taskRows = container.querySelectorAll('.task');
      expect(taskRows.length).toBeGreaterThanOrEqual(1);
    });

    const taskRow = container.querySelector('.task');
    expect(taskRow.querySelector('.x')).toBeFalsy();
    expect(taskRow.querySelector('.tstate').textContent).toBe('running');
  });
});
