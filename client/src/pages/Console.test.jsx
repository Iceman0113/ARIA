import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../cosmic/CosmicStage.jsx', () => ({ default: () => null }));
vi.mock('../shell/MicBar.jsx', () => ({ default: () => null }));

import Console from './Console.jsx';

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
