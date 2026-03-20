import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackRow from '../app/TrackRow';
import type { TrackId } from '../app/types';

const noop = vi.fn();

function renderTrackRow(overrides = {}) {
  const defaults = {
    trackId: 'bd' as TrackId,
    trackName: 'Kick',
    steps: '1010101010101010'
      + '0101010101010101',
    trackLength: 32,
    patternLength: 32,
    pageOffset: 0,
    isMuted: false,
    isSolo: false,
    isFreeRun: false,
    gain: 1,
    currentStep: -1,
    totalSteps: 0,
    onToggleStep: noop,
    onToggleMute: noop,
    onToggleSolo: noop,
    onSetGain: noop,
    onSetTrackLength: noop,
    onToggleFreeRun: noop,
  };
  return render(
    <TrackRow {...defaults} {...overrides} />
  );
}

describe('TrackRow with pageOffset', () => {
  it('page 1 shows first 16 steps', () => {
    renderTrackRow({ pageOffset: 0 });
    const buttons = screen.getAllByRole('button', {
      name: /Kick step/,
    });
    // steps[0]='1', so first button is pressed
    expect(
      buttons[0].getAttribute('aria-pressed')
    ).toBe('true');
    // steps[1]='0'
    expect(
      buttons[1].getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('page 2 shows steps 17-32', () => {
    renderTrackRow({ pageOffset: 16 });
    const buttons = screen.getAllByRole('button', {
      name: /Kick step/,
    });
    // steps[16]='0' (from second half '0101...')
    expect(
      buttons[0].getAttribute('aria-pressed')
    ).toBe('false');
    // steps[17]='1'
    expect(
      buttons[1].getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('dims steps beyond patternLength', () => {
    renderTrackRow({
      patternLength: 24,
      pageOffset: 16,
    });
    const allSteps = screen.getAllByLabelText(
      /Kick step/
    );
    expect(allSteps.length).toBe(16);
    // Step 25 (index 8) should be inactive
    expect(
      allSteps[8].getAttribute('aria-label')
    ).toContain('inactive');
  });
});
