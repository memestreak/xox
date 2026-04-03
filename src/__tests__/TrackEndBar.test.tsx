import { render, screen, fireEvent }
  from '@testing-library/react';
import {
  beforeEach, describe, it, expect, vi,
} from 'vitest';
import TrackRow from '../app/TrackRow';

// jsdom lacks setPointerCapture
beforeEach(() => {
  Element.prototype.setPointerCapture =
    vi.fn() as never;
  Element.prototype.releasePointerCapture =
    vi.fn() as never;
});

const base = {
  trackId: 'bd' as const,
  trackName: 'BD',
  steps: '1010101010101010',
  trackLength: 16,
  patternLength: 16,
  pageOffset: 0,
  isMuted: false,
  isSolo: false,
  isFreeRun: false,
  gain: 0.8,
  currentStep: -1,
  totalSteps: 0,
  onToggleStep: vi.fn(),
  onToggleMute: vi.fn(),
  onToggleSolo: vi.fn(),
  onSetGain: vi.fn(),
  onSetTrackLength: vi.fn(),
  onToggleFreeRun: vi.fn(),
};

describe('TrackEndBar', () => {
  it('right-click calls onToggleFreeRun', () => {
    render(<TrackRow {...base} />);
    const slider = screen.getByRole('slider', {
      name: 'BD length',
    });
    fireEvent.contextMenu(slider);
    expect(base.onToggleFreeRun).toHaveBeenCalledWith(
      'bd'
    );
  });

  it(
    'right-click during drag does not call'
    + ' onToggleFreeRun',
    () => {
      render(<TrackRow {...base} />);
      const slider = screen.getByRole('slider', {
        name: 'BD length',
      });
      // Start a drag via pointerDown
      fireEvent.pointerDown(slider, {
        pointerId: 1,
      });
      // Verify drag state: isDragging removes the
      // hover variant and sets the solid color
      expect(
        slider.className
      ).toContain('before:bg-neutral-300');
      expect(
        slider.className
      ).not.toContain('hover:before:bg-neutral-300');
      base.onToggleFreeRun.mockClear();
      fireEvent.contextMenu(slider);
      expect(
        base.onToggleFreeRun
      ).not.toHaveBeenCalled();
    }
  );

  it(
    'renders F glyph when isFreeRun is true',
    () => {
      render(
        <TrackRow {...base} isFreeRun={true} />
      );
      expect(
        screen.getByLabelText('free run')
      ).toBeTruthy();
      expect(
        screen.getByLabelText('free run').textContent
      ).toBe('F');
    }
  );

  it(
    'does not render F glyph when isFreeRun'
    + ' is false',
    () => {
      render(
        <TrackRow {...base} isFreeRun={false} />
      );
      expect(
        screen.queryByLabelText('free run')
      ).toBeNull();
    }
  );

  it(
    'F glyph has pointer-events-none class',
    () => {
      render(
        <TrackRow {...base} isFreeRun={true} />
      );
      const glyph = screen.getByLabelText('free run');
      expect(
        glyph.className
      ).toContain('pointer-events-none');
    }
  );

  it(
    'end bar retains role="slider" and ARIA'
    + ' attributes',
    () => {
      render(
        <TrackRow {...base} trackLength={12} />
      );
      const slider = screen.getByRole('slider', {
      name: 'BD length',
    });
      expect(
        slider.getAttribute('aria-label')
      ).toBe('BD length');
      expect(
        slider.getAttribute('aria-valuemin')
      ).toBe('1');
      expect(
        slider.getAttribute('aria-valuemax')
      ).toBe('16');
      expect(
        slider.getAttribute('aria-valuenow')
      ).toBe('12');
    }
  );
});
