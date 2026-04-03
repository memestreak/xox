import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackRow from '../app/TrackRow';
import type { TrackId } from '../app/types';

const noop = vi.fn();

function renderTrackRow(overrides = {}) {
  const defaults = {
    trackId: 'bd' as TrackId,
    trackName: 'BD',
    steps: '1010101010101010'
      + '0101010101010101',
    trackLength: 32,
    patternLength: 32,
    pageOffset: 0,
    isMuted: false,
    isSolo: false,
    isFreeRun: false,
    isTriggered: false,
    gain: 1,
    pan: 0.5,
    currentStep: -1,
    totalSteps: 0,
    onToggleStep: noop,
    onToggleMute: noop,
    onToggleSolo: noop,
    onSetGain: noop,
    onSetPan: noop,
    onSetTrackLength: noop,
    onToggleFreeRun: noop,
    onClearTrack: noop,
    onPlayPreview: noop,
  };
  return render(
    <TrackRow {...defaults} {...overrides} />
  );
}

describe('TrackRow with pageOffset', () => {
  it('page 1 shows first 16 steps', () => {
    renderTrackRow({ pageOffset: 0 });
    const buttons = screen.getAllByRole('button', {
      name: /BD step/,
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
      name: /BD step/,
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
      /BD step/
    );
    expect(allSteps.length).toBe(16);
    // Step 25 (index 8) should be inactive
    expect(
      allSteps[8].getAttribute('aria-label')
    ).toContain('inactive');
  });
});

describe('TrackNameButton interactions', () => {
  it('mousedown plays preview', () => {
    const onPlayPreview = vi.fn();
    renderTrackRow({ onPlayPreview });
    // Both mobile and desktop buttons render;
    // grab the first one
    const btn = screen.getAllByText('BD')[0];
    fireEvent.mouseDown(btn, { button: 0 });
    expect(onPlayPreview).toHaveBeenCalledWith('bd');
  });

  it('Cmd+click opens menu instead of preview',
    () => {
      const onPlayPreview = vi.fn();
      renderTrackRow({ onPlayPreview });
      const btn = screen.getAllByText('BD')[0];
      fireEvent.mouseDown(btn, {
        button: 0, metaKey: true,
      });
      expect(onPlayPreview).not.toHaveBeenCalled();
    }
  );

  it('Ctrl+click opens menu instead of preview',
    () => {
      const onPlayPreview = vi.fn();
      renderTrackRow({ onPlayPreview });
      const btn = screen.getAllByText('BD')[0];
      fireEvent.mouseDown(btn, {
        button: 0, ctrlKey: true,
      });
      expect(onPlayPreview).not.toHaveBeenCalled();
    }
  );

  it('right-click opens menu', () => {
    const onPlayPreview = vi.fn();
    renderTrackRow({ onPlayPreview });
    const btn = screen.getAllByText('BD')[0];
    fireEvent.contextMenu(btn);
    expect(onPlayPreview).not.toHaveBeenCalled();
    // Menu should now be visible (Free-run option)
    // — only renders at 'lg' size, so check the
    // desktop button instead
    const desktopBtn = screen.getAllByText('BD')[1];
    fireEvent.contextMenu(desktopBtn);
    expect(
      screen.queryByText('Free-run')
    ).toBeInTheDocument();
  });

  it('Shift+click clears track', () => {
    const onClearTrack = vi.fn();
    renderTrackRow({ onClearTrack });
    const btn = screen.getAllByText('BD')[0];
    fireEvent.mouseDown(btn, {
      button: 0, shiftKey: true,
    });
    expect(onClearTrack).toHaveBeenCalledWith('bd');
  });
});
