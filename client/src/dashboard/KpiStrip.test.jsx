import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiStrip from './KpiStrip.jsx';

describe('<KpiStrip>', () => {
  const props = {
    mrr: 1950, mrrTarget: 16500, mrrWeekDelta: 350,
    pipelineOpen: 8400, pipelineActive: 4, pipelineHot: 1,
    followUpsTotal: 3, followUpsOverdue: 2,
    spendToday: 0.42, tokensToday: 12800, avgLatency: 0.74,
  };
  it('renders four KPI cards with mono-formatted numbers', () => {
    render(<KpiStrip {...props} />);
    expect(screen.getByText('$1,950')).toBeInTheDocument();
    expect(screen.getByText(/\/ \$16,500/)).toBeInTheDocument();
    expect(screen.getByText('$8,400')).toBeInTheDocument();
    expect(screen.getByText(/4 active · 1 hot/)).toBeInTheDocument();
    expect(screen.getByText('$0.42')).toBeInTheDocument();
    expect(screen.getByText(/12.8K tokens/)).toBeInTheDocument();
  });
});
