import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionsPanel from './ActionsPanel.jsx';

describe('<ActionsPanel>', () => {
  const actions = [
    { id: '1', title: 'Pixel Pools — reply', meta: '$1,800 deal', due: '2d overdue', urgency: 'hot' },
    { id: '2', title: 'Performance Clinic prep', meta: 'Wed Jun 3', due: '3 days', urgency: 'soon' },
    { id: '3', title: 'Hedgerow Dental — qualify', meta: 'Atlas 78/100', due: 'Sat Jun 7', urgency: 'today' },
    { id: '4', title: 'Greenwood Church renewal', meta: '$900/mo', due: 'Jun 22', urgency: 'future' },
  ];

  it('renders each action title + meta + due', () => {
    render(<ActionsPanel actions={actions} />);
    expect(screen.getByText('Pixel Pools — reply')).toBeInTheDocument();
    expect(screen.getByText('$1,800 deal')).toBeInTheDocument();
    expect(screen.getByText('2d overdue')).toBeInTheDocument();
  });
  it('marker class reflects urgency', () => {
    const { container } = render(<ActionsPanel actions={actions} />);
    expect(container.querySelector('.action-row .marker.hot')).toBeInTheDocument();
    expect(container.querySelector('.action-row .marker.soon')).toBeInTheDocument();
    expect(container.querySelector('.action-row .marker.future')).toBeInTheDocument();
  });
  it('shows N items in the aside', () => {
    render(<ActionsPanel actions={actions} />);
    expect(screen.getByText('4 items')).toBeInTheDocument();
  });
  it('renders an empty state when actions are empty', () => {
    render(<ActionsPanel actions={[]} />);
    expect(screen.getByText(/No actions queued/i)).toBeInTheDocument();
  });
});
