import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TransportControls from '../app/TransportControls';
import { TestWrapper } from './helpers/sequencer-wrapper';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
  },
}));

function renderTransport() {
  const mockTrigger = (
    <button aria-label="Pattern">Mock Pattern</button>
  );
  return render(
    <TestWrapper>
      <TransportControls patternTrigger={mockTrigger} />
    </TestWrapper>
  );
}

describe('TransportControls', () => {
  it('shows pattern trigger button', () => {
    renderTransport();
    expect(
      screen.getByRole('button', { name: /pattern/i })
    ).toBeInTheDocument();
  });

  it('renders pattern trigger in the Pattern box', () => {
    renderTransport();
    const trigger = screen.getByRole('button', {
      name: /pattern/i,
    });
    expect(trigger).toHaveTextContent('Mock Pattern');
  });
});
