import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import StepGrid from '../app/StepGrid';
import { TestWrapper } from './helpers/sequencer-wrapper';
import React from 'react';

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
    getOutputTime: vi.fn().mockReturnValue(0),
    onStep: vi.fn(),
  },
}));

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    sendNote: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    init: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({
      enabled: false,
    }),
    getOutputs: vi.fn().mockReturnValue([]),
    setOnDeviceChange: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

beforeEach(() => {
  Element.prototype.setPointerCapture =
    vi.fn() as never;
  Element.prototype.releasePointerCapture =
    vi.fn() as never;
  // jsdom lacks elementFromPoint
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
});

function renderGrid(pageOffset = 0) {
  const scrollRef = React.createRef<HTMLDivElement>();
  const setPage = vi.fn();
  return render(
    <TestWrapper>
      <div ref={scrollRef}>
        <StepGrid
          scrollContainerRef={scrollRef}
          pageOffset={pageOffset}
          autoFollow={true}
          setPage={setPage}
        />
      </div>
    </TestWrapper>
  );
}

describe('StepGrid', () => {
  it('renders 11 track rows (excludes accent)', () => {
    renderGrid();
    // Each track row has a data-track attribute
    // 11 tracks: bd, sd, ch, oh, cy, ht, mt, lt,
    // rs, cp, cb
    const trackDivs = document.querySelectorAll(
      '[data-track]'
    );
    // 11 tracks + 1 accent = 12 data-track elements
    expect(trackDivs.length).toBe(12);
  });

  it('renders step buttons', () => {
    renderGrid();
    // Each track has 16 steps, there are 12 tracks
    // (11 + accent). Look for some step buttons.
    const steps = screen.getAllByRole('button', {
      name: /step \d+/i,
    });
    expect(steps.length).toBeGreaterThan(0);
  });

  it('renders accent row', () => {
    renderGrid();
    const accentTrack = document.querySelector(
      '[data-track="ac"]'
    );
    expect(accentTrack).toBeInTheDocument();
  });

  it('renders with page offset 0', () => {
    renderGrid(0);
    // Should render normally without errors
    const trackDivs = document.querySelectorAll(
      '[data-track]'
    );
    expect(trackDivs.length).toBe(12);
  });

  describe('outside press clears the selection', () => {
    function pressOn(target: Element) {
      // jsdom has no PointerEvent constructor
      act(() => {
        target.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true, button: 0,
        }));
      });
    }

    function selectFirstKick() {
      const step = screen.getByRole('button', {
        name: 'BD step 1',
      });
      fireEvent.click(step, { ctrlKey: true });
      return step;
    }

    it('clears on a press outside the grid', () => {
      renderGrid();
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      const step = selectFirstKick();
      expect(step.className).toContain('ring-2');
      pressOn(outside);
      expect(step.className).not.toContain('ring-2');
      outside.remove();
    });

    it('keeps it on a press inside the grid', () => {
      renderGrid();
      const step = selectFirstKick();
      pressOn(screen.getByRole('button', {
        name: 'SD step 5',
      }));
      expect(step.className).toContain('ring-2');
    });
  });
});
