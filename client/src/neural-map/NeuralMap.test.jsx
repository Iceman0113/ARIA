import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import NeuralMap from './NeuralMap.jsx';

// Mock scene.js so jsdom doesn't try to spin up WebGL
vi.mock('./scene.js', () => ({
  createScene: vi.fn(() => ({ dispose: vi.fn() })),
}));

describe('<NeuralMap>', () => {
  let createScene;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ createScene } = await import('./scene.js'));
  });

  it('renders the canvas + label layer + tooltip elements', () => {
    const { container } = render(<NeuralMap data={{ nodes: [], edges: [] }} workStates={{}} />);
    expect(container.querySelector('canvas#neural-canvas')).toBeInTheDocument();
    expect(container.querySelector('#label-layer')).toBeInTheDocument();
    expect(container.querySelector('#neural-tooltip')).toBeInTheDocument();
  });

  it('calls createScene on mount and dispose on unmount', async () => {
    const dispose = vi.fn();
    createScene.mockReturnValueOnce({ dispose });
    const { unmount } = render(<NeuralMap data={{ nodes: [], edges: [] }} workStates={{}} />);
    expect(createScene).toHaveBeenCalledOnce();
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
