import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CosmicStage from './CosmicStage.jsx';

const dispose = vi.fn();
vi.mock('./scene.js', () => ({
  createScene: () => ({ setSpeaking(){}, setListening(){}, setAmpDriver(){}, resize(){}, dispose }),
}));

describe('CosmicStage', () => {
  it('disposes the scene on unmount', () => {
    const { unmount } = render(<CosmicStage status="idle" />);
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
