import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TransportControls from '../app/TransportControls';
import { TestWrapper } from './helpers/sequencer-wrapper';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    requestReset: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    setOutputVolume: vi.fn(),
    getOutputPeaks: vi.fn().mockReturnValue([0, 0]),
    onStep: vi.fn(),
  },
}));

// TransportControls renders PatternModeSelector and
// the play button that enables Temp.
function renderSelector() {
  return render(
    <TestWrapper>
      <TransportControls
        patternTrigger={<button>Pattern</button>}
      />
    </TestWrapper>
  );
}

// The tooltip sits on the span wrapping the button.
function tempTooltip(temp: HTMLElement) {
  const id = temp.parentElement!
    .getAttribute('aria-describedby')!;
  return document.getElementById(id);
}

describe('PatternModeSelector Temp button', () => {
  it('is disabled with a hint while stopped', () => {
    renderSelector();
    const temp = screen.getByRole('button', {
      name: 'Temp mode',
    });
    expect(temp).toBeDisabled();
    expect(tempTooltip(temp))
      .toHaveTextContent('Start playback to use Temp');
  });

  it('is enabled with its usual tooltip while playing',
    async () => {
      renderSelector();
      const play = screen.getByRole('button', {
        name: /start playback/i,
      });
      await waitFor(() => expect(play).toBeEnabled());
      fireEvent.click(play);

      const temp = screen.getByRole('button', {
        name: 'Temp mode',
      });
      await waitFor(() => expect(temp).toBeEnabled());
      expect(tempTooltip(temp))
        .toHaveTextContent(
          'Temporary mode change while playing'
        );
    });
});
