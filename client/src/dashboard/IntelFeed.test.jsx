import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntelFeed from './IntelFeed.jsx';

describe('<IntelFeed>', () => {
  const items = [
    { id: 'a', agent: 'scout',  source: 'competitor watch', msg: 'Wayfinder Tech dropped Starter tier.', time: '11 min' },
    { id: 'b', agent: 'beacon', source: 'brief ready',      msg: '$1,950 MRR, 3 actions due.',           time: '23 min' },
    { id: 'c', agent: 'hunter', source: 'new lead',         msg: 'Bridgepoint Dental hired new ops director.', time: '2h' },
    { id: 'd', agent: 'verse',  source: 'LinkedIn',         msg: '2 comment replies drafted.',           time: '4h' },
  ];
  it('renders all intel rows with agent avatar tile', () => {
    render(<IntelFeed items={items} />);
    ['SCT', 'BCN', 'HNT', 'VRS'].forEach(a => expect(screen.getByText(a)).toBeInTheDocument());
  });
  it('renders source eyebrow with agent name', () => {
    render(<IntelFeed items={items} />);
    expect(screen.getByText(/Scout · competitor watch/)).toBeInTheDocument();
  });
  it('shows "live" label in the aside', () => {
    render(<IntelFeed items={items} />);
    expect(screen.getByText('live')).toBeInTheDocument();
  });
  it('renders empty state for no items', () => {
    render(<IntelFeed items={[]} />);
    expect(screen.getByText(/No intel yet/i)).toBeInTheDocument();
  });
});
