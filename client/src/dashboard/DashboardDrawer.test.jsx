import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardDrawer from './DashboardDrawer.jsx';

describe('<DashboardDrawer>', () => {
  it('renders with .on class when open=true', () => {
    const { container } = render(<DashboardDrawer open={true} onClose={() => {}} />);
    expect(container.querySelector('.drawer')).toHaveClass('on');
    expect(container.querySelector('.drawer-backdrop')).toHaveClass('on');
  });

  it('renders without .on class when open=false', () => {
    const { container } = render(<DashboardDrawer open={false} onClose={() => {}} />);
    expect(container.querySelector('.drawer')).not.toHaveClass('on');
  });

  it('fires onClose when handle clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<DashboardDrawer open={true} onClose={onClose} />);
    fireEvent.click(container.querySelector('.drawer-handle'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<DashboardDrawer open={true} onClose={onClose} />);
    fireEvent.click(container.querySelector('.drawer-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose when ESC pressed while open', () => {
    const onClose = vi.fn();
    render(<DashboardDrawer open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not fire onClose on ESC when closed', () => {
    const onClose = vi.fn();
    render(<DashboardDrawer open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
