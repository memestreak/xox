import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackRow from '../app/TrackRow';
import type { TrackId } from '../app/types';
import { PLAYHEAD_CLASS } from '../app/stepColors';

const noop = vi.fn();

function baseProps() {
  return {
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
}

function renderTrackRow(overrides = {}) {
  return render(
    <TrackRow {...baseProps()} {...overrides} />
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

function stepButtons() {
  return screen.getAllByRole('button', { name: /BD step/ });
}

describe('TrackRow step interactions', () => {
  it('click toggles the global step on page 1', () => {
    const onToggleStep = vi.fn();
    renderTrackRow({ onToggleStep });
    fireEvent.click(stepButtons()[5]);
    expect(onToggleStep).toHaveBeenCalledWith('bd', 5);
  });

  it('click on page 2 adds the page offset', () => {
    const onToggleStep = vi.fn();
    renderTrackRow({ onToggleStep, pageOffset: 16 });
    fireEvent.click(stepButtons()[2]);
    expect(onToggleStep).toHaveBeenCalledWith('bd', 18);
  });

  it('Ctrl+click and Shift+click report global steps', () => {
    const onCtrlClick = vi.fn();
    const onShiftClick = vi.fn();
    const onToggleStep = vi.fn();
    renderTrackRow({
      onCtrlClick, onShiftClick, onToggleStep,
      pageOffset: 16,
    });
    fireEvent.click(stepButtons()[0], { ctrlKey: true });
    fireEvent.click(stepButtons()[1], { shiftKey: true });
    expect(onCtrlClick).toHaveBeenCalledWith('bd', 16);
    expect(onShiftClick).toHaveBeenCalledWith('bd', 17);
    expect(onToggleStep).not.toHaveBeenCalled();
  });

  it('right-click opens the popover at the global step', () => {
    const onOpenPopover = vi.fn();
    renderTrackRow({ onOpenPopover, pageOffset: 16 });
    fireEvent.contextMenu(stepButtons()[3]);
    expect(onOpenPopover).toHaveBeenCalledWith(
      'bd', 19, expect.objectContaining({
        top: expect.any(Number),
        left: expect.any(Number),
      })
    );
  });

  it('clicking a selected step defers to onPlainClick', () => {
    const onPlainClick = vi.fn(() => true);
    const onToggleStep = vi.fn();
    renderTrackRow({
      onPlainClick, onToggleStep,
      selectedSteps: new Set([4]),
    });
    expect(stepButtons()[4].className)
      .toContain('ring-blue-400');
    fireEvent.click(stepButtons()[4]);
    expect(onPlainClick).toHaveBeenCalled();
    expect(onToggleStep).not.toHaveBeenCalled();
  });
});

describe('TrackRow step rendering', () => {
  it('highlights the playing step (active and inactive)', () => {
    // steps[0]='1', steps[1]='0'
    const { rerender } = renderTrackRow({
      currentStep: 0, totalSteps: 0,
    });
    expect(stepButtons()[0].className)
      .toContain(PLAYHEAD_CLASS);
    rerender(
      <TrackRow
        {...baseProps()}
        currentStep={1}
        totalSteps={1}
      />
    );
    expect(stepButtons()[1].className)
      .toContain(PLAYHEAD_CLASS);
    expect(stepButtons()[0].className)
      .not.toContain(PLAYHEAD_CLASS);
    expect(stepButtons()[0].className)
      .toContain('bg-step1 ');
  });

  it('short track wraps the playhead at its own length', () => {
    renderTrackRow({
      trackLength: 12,
      patternLength: 16,
      steps: '0'.repeat(12),
      currentStep: 13,
      totalSteps: 13,
    });
    // Non-free-run: step 13 % 12 = 1
    expect(stepButtons()[1].className)
      .toContain(PLAYHEAD_CLASS);
  });

  it('free-run track follows totalSteps', () => {
    renderTrackRow({
      trackLength: 12,
      patternLength: 16,
      steps: '0'.repeat(12),
      isFreeRun: true,
      currentStep: 3,
      totalSteps: 17,
    });
    // Free-run: 17 % 12 = 5
    expect(stepButtons()[5].className)
      .toContain(PLAYHEAD_CLASS);
    expect(stepButtons()[3].className)
      .not.toContain(PLAYHEAD_CLASS);
  });

  it('shows condition and lock badges on active steps', () => {
    renderTrackRow({
      // steps[0]='1' active, steps[1]='0' inactive
      trigConditions: {
        0: { probability: 40, fill: 'fill' },
        1: { probability: 40 },
      },
      parameterLocks: { 0: { pan: 0.2, gain: 0.5 } },
    });
    const first = stepButtons()[0];
    expect(first.querySelector('[data-testid="prob-bar"]'))
      .not.toBeNull();
    expect(first.querySelector('[data-testid="pan-bar"]'))
      .not.toBeNull();
    expect(first.querySelector('[data-testid="fill-badge"]'))
      .not.toBeNull();
    expect(first.style.opacity).toBe('0.5');
    // Inactive step hides badges
    expect(
      stepButtons()[1].querySelector('[data-testid="prob-bar"]')
    ).toBeNull();
  });
});

describe('TrackRow layout and sub-components', () => {
  it('renders mobile and desktop copies of the controls', () => {
    renderTrackRow();
    expect(screen.getAllByText('BD')).toHaveLength(2);
    expect(
      screen.getAllByRole('button', { name: /mute bd/i })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('slider', { name: 'Volume BD' })
    ).toHaveLength(2);
  });

  it('only the desktop name button has a menu', () => {
    renderTrackRow();
    const [mobile, desktop] = screen.getAllByText('BD');
    expect(mobile).not.toHaveAttribute('aria-haspopup');
    expect(desktop).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('mixer controls are bound to the track id', () => {
    const onToggleMute = vi.fn();
    const onToggleSolo = vi.fn();
    const onSetGain = vi.fn();
    const onSetPan = vi.fn();
    renderTrackRow({
      onToggleMute, onToggleSolo, onSetGain, onSetPan,
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: /mute bd/i })[0]
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: /solo bd/i })[1]
    );
    fireEvent.keyDown(
      screen.getAllByRole('slider', { name: 'Volume BD' })[0],
      { key: 'Home' }
    );
    fireEvent.keyDown(
      screen.getAllByRole('slider', { name: 'Pan BD' })[1],
      { key: 'End' }
    );
    expect(onToggleMute).toHaveBeenCalledWith('bd');
    expect(onToggleSolo).toHaveBeenCalledWith('bd');
    expect(onSetGain).toHaveBeenCalledWith('bd', 0);
    expect(onSetPan).toHaveBeenCalledWith('bd', 1);
  });

  it('length handle shows on the page holding the track end', () => {
    renderTrackRow({ trackLength: 32, pageOffset: 16 });
    expect(
      screen.getByRole('slider', { name: 'BD length' })
    ).toHaveAttribute('aria-valuenow', '32');
  });

  it('length handle is hidden on other pages', () => {
    renderTrackRow({ trackLength: 32, pageOffset: 0 });
    expect(
      screen.queryByRole('slider', { name: 'BD length' })
    ).toBeNull();
  });

  it('free-run tracks show the free-run marker', () => {
    renderTrackRow({
      trackLength: 32, pageOffset: 16, isFreeRun: true,
    });
    expect(screen.getByLabelText('free run'))
      .toBeInTheDocument();
  });
});
