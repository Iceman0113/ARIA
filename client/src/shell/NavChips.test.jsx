import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavChips from './NavChips.jsx';

describe('<NavChips>', () => {
  it('renders the six routes prefixed with ◦', () => {
    render(<NavChips active="console" onNav={() => {}} />);
    ['Console', 'Factory', 'Clients', 'Pipeline', 'Memory', 'Settings'].forEach(name => {
      expect(screen.getByText(new RegExp(name))).toBeInTheDocument();
    });
  });

  it('marks the active chip with the active class', () => {
    render(<NavChips active="factory" onNav={() => {}} />);
    expect(screen.getByText(/Factory/).closest('button')).toHaveClass('active');
    expect(screen.getByText(/Console/).closest('button')).not.toHaveClass('active');
  });

  it('fires onNav with the chip id when clicked', () => {
    const onNav = vi.fn();
    render(<NavChips active="console" onNav={onNav} />);
    fireEvent.click(screen.getByText(/Pipeline/).closest('button'));
    expect(onNav).toHaveBeenCalledWith('pipeline');
  });
});
