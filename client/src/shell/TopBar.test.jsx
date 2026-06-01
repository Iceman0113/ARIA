import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from './TopBar.jsx';

describe('<TopBar>', () => {
  it('renders the A.R.I.A. brand mark', () => {
    render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="idle" />);
    expect(screen.getByText('A.R.I.A.')).toBeInTheDocument();
  });

  it('renders Jack & Jewell Consulting and Greenwood, IN', () => {
    render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="idle" />);
    expect(screen.getByText(/Jack & Jewell Consulting/)).toBeInTheDocument();
    expect(screen.getByText(/Greenwood, IN/)).toBeInTheDocument();
  });

  it('renders the four live pills with mono-formatted values', () => {
    render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="idle" />);
    expect(screen.getByText('12.8K')).toBeInTheDocument();
    expect(screen.getByText('$0.42')).toBeInTheDocument();
    expect(screen.getByText('$1,950')).toBeInTheDocument();
    expect(screen.getByText('0.74s')).toBeInTheDocument();
  });

  it('marks latency as slow when >= 1.0s', () => {
    render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={1.2} presence="idle" />);
    expect(screen.getByText('1.20s')).toHaveClass('slow');
  });

  it('renders the presence string', () => {
    render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="listening" />);
    expect(screen.getByText(/listening/)).toBeInTheDocument();
  });
});
