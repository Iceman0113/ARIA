import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MicBar from './MicBar.jsx';

describe('<MicBar>', () => {
  const defaults = {
    state: 'idle',
    latency: 0.74,
    drawerOpen: false,
    onMicClick: () => {},
    onSubmit: () => {},
    onToggleDrawer: () => {},
    textValue: '',
    onTextChange: () => {},
  };

  it('renders mic button, input, latency, state pill, drawer toggle', () => {
    render(<MicBar {...defaults} />);
    expect(screen.getByRole('button', { name: /toggle voice/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type a message or say "hey ARIA"/i)).toBeInTheDocument();
    expect(screen.getByText('0.74s')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle dashboard/i })).toBeInTheDocument();
  });

  it('marks the mic button + state pill as listening when state=listening', () => {
    render(<MicBar {...defaults} state="listening" />);
    expect(screen.getByRole('button', { name: /toggle voice/i })).toHaveClass('listening');
    expect(screen.getByText('Listening')).toHaveClass('listening');
  });

  it('fires onMicClick when mic button clicked', () => {
    const onMicClick = vi.fn();
    render(<MicBar {...defaults} onMicClick={onMicClick} />);
    fireEvent.click(screen.getByRole('button', { name: /toggle voice/i }));
    expect(onMicClick).toHaveBeenCalledOnce();
  });

  it('fires onSubmit when form submitted with text', () => {
    const onSubmit = vi.fn();
    render(<MicBar {...defaults} textValue="hello" onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByPlaceholderText(/hey ARIA/i).closest('form'));
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('rotates the chevron when drawer is open', () => {
    const { rerender } = render(<MicBar {...defaults} drawerOpen={false} />);
    expect(screen.getByRole('button', { name: /toggle dashboard/i })).not.toHaveClass('on');
    rerender(<MicBar {...defaults} drawerOpen={true} />);
    expect(screen.getByRole('button', { name: /toggle dashboard/i })).toHaveClass('on');
  });

  it('shows the live interim transcript while listening', () => {
    render(<MicBar {...defaults} state="listening" interim="search for msps in greenwood" />);
    expect(screen.getByText('search for msps in greenwood')).toBeInTheDocument();
  });

  it('surfaces an STT error message when sttError is set', () => {
    render(<MicBar {...defaults} sttError="Mic blocked — allow microphone for localhost in Chrome" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Mic blocked/i);
  });

  it('prioritizes the STT error over the state pill label', () => {
    render(<MicBar {...defaults} state="listening" sttError="No microphone found" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No microphone found');
  });
});
