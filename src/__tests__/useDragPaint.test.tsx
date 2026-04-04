import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { useDragPaint } from '../app/hooks/useDragPaint';
import type {
  TrackId,
  TrackPattern,
  TrackConfig,
} from '../app/types';
import { TRACK_IDS } from '../app/types';

/**
 * Build a mock DOM structure: a container with
 * per-track grid divs, each containing step buttons.
 * Uses data-track and data-step attributes so
 * cellFromPoint can resolve hits.
 */
function makeMockDOM(
  tracks: TrackId[],
  stepCount = 16,
  stepWidth = 40,
  rowHeight = 32,
  rowGap = 8
): {
  container: HTMLDivElement;
  elements: Map<string, HTMLElement>;
} {
  const container = document.createElement('div');
  container.setPointerCapture = vi.fn();
  container.releasePointerCapture = vi.fn();
  container.addEventListener = vi.fn();

  const elements = new Map<string, HTMLElement>();

  tracks.forEach((trackId, rowIdx) => {
    const grid = document.createElement('div');
    grid.dataset.track = trackId;

    const rowTop = rowIdx * (rowHeight + rowGap);

    for (let i = 0; i < stepCount; i++) {
      const btn = document.createElement('button');
      btn.dataset.step = String(i);
      const left = i * stepWidth;
      btn.getBoundingClientRect = () => ({
        left,
        right: left + stepWidth,
        top: rowTop,
        bottom: rowTop + rowHeight,
        width: stepWidth,
        height: rowHeight,
        x: left,
        y: rowTop,
        toJSON: () => ({}),
      });
      grid.appendChild(btn);
      elements.set(`${trackId}-${i}`, btn);
    }

    container.appendChild(grid);
  });

  return { container, elements };
}

/**
 * Mock document.elementFromPoint to look up the
 * element from our mock DOM.
 */
function mockElementFromPoint(
  elements: Map<string, HTMLElement>,
  tracks: TrackId[],
  stepWidth = 40,
  rowHeight = 32,
  rowGap = 8
) {
  document.elementFromPoint = vi.fn(
    (x: number, y: number) => {
      for (let r = 0; r < tracks.length; r++) {
        const rowTop = r * (rowHeight + rowGap);
        if (y < rowTop || y > rowTop + rowHeight) {
          continue;
        }
        const stepIdx = Math.floor(x / stepWidth);
        if (stepIdx < 0 || stepIdx >= 16) continue;
        const key = `${tracks[r]}-${stepIdx}`;
        return elements.get(key) ?? null;
      }
      return null;
    }
  );
}

function makePointerEvent(
  overrides: Partial<React.PointerEvent<HTMLDivElement>>
): React.PointerEvent<HTMLDivElement> {
  return {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: 0,
    clientY: 16,
    shiftKey: false,
    ...overrides,
  } as React.PointerEvent<HTMLDivElement>;
}

function makeDefaultTracks(): Record<TrackId, TrackConfig> {
  const t = {} as Record<TrackId, TrackConfig>;
  for (const id of TRACK_IDS) {
    t[id] = { steps: '0000000000000000' };
  }
  return t;
}

function makeDefaultPatterns(): TrackPattern[] {
  return [
    { id: 'p1', name: 'Pattern 1', steps: '1010101010101010' },
    { id: 'p2', name: 'Pattern 2', steps: '1111000011110000' },
    { id: 'p3', name: 'Pattern 3', steps: '1000100010001000' },
  ];
}

describe('useDragPaint', () => {
  const tracks: TrackId[] = ['bd', 'sd', 'ch'];
  let onSetStep: ReturnType<typeof vi.fn>;
  let container: HTMLDivElement;
  let elements: Map<string, HTMLElement>;
  let containerRef: React.RefObject<
    HTMLDivElement | null
  >;

  beforeEach(() => {
    onSetStep = vi.fn();
    const mock = makeMockDOM(tracks);
    container = mock.container;
    elements = mock.elements;
    containerRef = { current: container };
    mockElementFromPoint(elements, tracks);
  });

  function renderDragPaint(
    tracksOverride?: Record<TrackId, TrackConfig>
  ) {
    return renderHook(() =>
      useDragPaint({
        containerRef,
        trackOrder: tracks,
        tracks:
          tracksOverride ?? makeDefaultTracks(),
        onSetStep,
      })
    );
  }

  it('drag across steps in one track', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 90, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 90, clientY: 16,
    }));

    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 0, '1'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 1, '1'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 2, '1'
    );
  });

  it('drag across multiple tracks', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    // Start on bd step 2 (y=16, in row 0)
    h.onPointerDown(makePointerEvent({
      clientX: 90, clientY: 16,
    }));
    // Move enough to cross threshold
    h.onPointerMove(makePointerEvent({
      clientX: 90, clientY: 22,
    }));
    // Move down to sd (row 1, y=40..72)
    h.onPointerMove(makePointerEvent({
      clientX: 90, clientY: 50,
    }));
    // Move to ch (row 2, y=80..112)
    h.onPointerMove(makePointerEvent({
      clientX: 130, clientY: 90,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 130, clientY: 90,
    }));

    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 2, '1'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'sd', 2, '1'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'ch', 3, '1'
    );
  });

  it('drag starting on ON cell erases across tracks', () => {
    const tc = makeDefaultTracks();
    tc.bd = { steps: '1111111111111111' };
    tc.sd = { steps: '1111111111111111' };

    const { result } = renderDragPaint(tc);
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
    }));
    // Move to sd row
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 50,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 50, clientY: 50,
    }));

    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 0, '0'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 1, '0'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'sd', 1, '0'
    );
  });

  it('cross-track drag keeps paint mode from first cell', () => {
    const tc = makeDefaultTracks();
    tc.bd = { steps: '1111111111111111' };
    tc.sd = { steps: '0000000000000000' };

    const { result } = renderDragPaint(tc);
    const h = result.current;

    // Start on bd[0] (ON) → erase mode
    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    // Drag to sd[1] (OFF, but paint mode is sticky)
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 50,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 50, clientY: 50,
    }));

    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 0, '0'
    );
    expect(onSetStep).toHaveBeenCalledWith(
      'sd', 1, '0'
    );
  });

  it('touch drag on ON cell infers erase mode', () => {
    const tc = makeDefaultTracks();
    tc.bd = { steps: '1000000000000000' };

    const { result } = renderDragPaint(tc);
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
      pointerType: 'touch',
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
      pointerType: 'touch',
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 50, clientY: 16,
    }));

    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 0, '0'
    );
  });

  it('touch drag on OFF cell infers fill mode', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
      pointerType: 'touch',
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
      pointerType: 'touch',
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 50, clientY: 16,
    }));

    expect(onSetStep).toHaveBeenCalledWith(
      'bd', 0, '1'
    );
  });

  it('click with no movement does NOT call onSetStep', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 10, clientY: 16,
    }));

    expect(onSetStep).not.toHaveBeenCalled();
  });

  it('drag starting on disabled cell is ignored', () => {
    const tc = makeDefaultTracks();
    tc.bd = { steps: '00000000' };

    const { result } = renderDragPaint(tc);
    const h = result.current;

    // Step 10 is disabled (trackLength 8)
    h.onPointerDown(makePointerEvent({
      clientX: 410, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 450, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 450, clientY: 16,
    }));

    expect(onSetStep).not.toHaveBeenCalled();
  });

  it('pointer cancel ends gesture cleanly', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
    }));
    h.onPointerCancel(makePointerEvent({
      clientX: 50, clientY: 16,
    }));

    onSetStep.mockClear();
    h.onPointerMove(makePointerEvent({
      clientX: 90, clientY: 16,
    }));

    expect(onSetStep).not.toHaveBeenCalled();
  });

  it('adds one-shot click listener after drag', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 50, clientY: 16,
    }));

    expect(
      container.addEventListener
    ).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      { once: true, capture: true }
    );
  });

  it('does not add click listener when no drag', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 10, clientY: 16,
    }));

    expect(
      container.addEventListener
    ).not.toHaveBeenCalled();
  });

  it('ignores non-primary button', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      button: 2, clientX: 10, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
    }));

    expect(onSetStep).not.toHaveBeenCalled();
  });

  it('interpolates skipped steps on fast drag', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    // Start on bd step 0
    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    // Jump directly to step 5 (skipping 1-4)
    h.onPointerMove(makePointerEvent({
      clientX: 210, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 210, clientY: 16,
    }));

    // All steps 0-5 should be painted
    for (let i = 0; i <= 5; i++) {
      expect(onSetStep).toHaveBeenCalledWith(
        'bd', i, '1'
      );
    }
  });

  it('interpolates across tracks on diagonal drag', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    // Start on bd step 0 (row 0)
    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    // Jump diagonally to ch step 4 (row 2)
    // skipping intermediate cells
    h.onPointerMove(makePointerEvent({
      clientX: 170, clientY: 90,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 170, clientY: 90,
    }));

    // Bresenham from (0,0) to (4,2) should hit:
    // (0,0) -> (1,0) or (1,1) -> (2,1) -> (3,2)
    // -> (4,2) — the exact path depends on the
    // algorithm but all should be on the line
    const calls = onSetStep.mock.calls.map(
      (c: [TrackId, number, string]) =>
        `${c[0]}:${c[1]}`
    );
    // Start and end must be present
    expect(calls).toContain('bd:0');
    expect(calls).toContain('ch:4');
    // At least one sd cell should be filled
    // (interpolation through middle row)
    const sdCells = calls.filter(
      (c: string) => c.startsWith('sd:')
    );
    expect(sdCells.length).toBeGreaterThan(0);
  });

  it('skips duplicate cell during drag', () => {
    const { result } = renderDragPaint();
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16,
    }));
    // Same cell again
    h.onPointerMove(makePointerEvent({
      clientX: 55, clientY: 16,
    }));
    h.onPointerUp(makePointerEvent({
      clientX: 55, clientY: 16,
    }));

    // Step 1 should be called only once
    const step1Calls = onSetStep.mock.calls.filter(
      (c: [TrackId, number, string]) =>
        c[0] === 'bd' && c[1] === 1
    );
    expect(step1Calls).toHaveLength(1);
  });

  describe('pattern cycling mode', () => {
    let onSetTrackSteps: ReturnType<typeof vi.fn>;
    let longPressActiveRef: React.RefObject<boolean>;
    let popoverOpenRef: React.RefObject<boolean>;
    let patterns: TrackPattern[];

    beforeEach(() => {
      onSetTrackSteps = vi.fn();
      longPressActiveRef = { current: false };
      popoverOpenRef = { current: false };
      patterns = makeDefaultPatterns();
    });

    function renderDragPaintWithCycling(
      tracksOverride?: Record<TrackId, TrackConfig>,
      patternOverride?: TrackPattern[]
    ) {
      return renderHook(() =>
        useDragPaint({
          containerRef,
          trackOrder: tracks,
          tracks:
            tracksOverride ?? makeDefaultTracks(),
          onSetStep,
          patterns: patternOverride ?? patterns,
          onSetTrackSteps,
          longPressActiveRef,
          popoverOpenRef,
        })
      );
    }

    it(
      'shift+drag enters cycling mode and applies pattern',
      () => {
        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        // Click bd step 0 with shift
        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        // Drag 45px down — floor(45/20) = 2, idx 2
        // = patterns[0]
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 61,
          shiftKey: true,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 61,
        }));

        expect(onSetTrackSteps).toHaveBeenCalled();
      }
    );

    it(
      'position 0 is current state (no-op on shift+click)',
      () => {
        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        // No movement — pointer up without dragging
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 16,
        }));

        // No drag means no cycling ticks
        expect(onSetTrackSteps).not.toHaveBeenCalled();
        // And regular step painting should not happen
        expect(onSetStep).not.toHaveBeenCalled();
      }
    );

    it(
      'position 1 clears from click step onward',
      () => {
        const tc = makeDefaultTracks();
        // bd has some ON steps
        tc.bd = { steps: '1111111111111111' };

        const { result } = renderDragPaintWithCycling(
          tc
        );
        const h = result.current;

        // Click bd step 4 (x=4*40+10=170)
        h.onPointerDown(makePointerEvent({
          clientX: 170, clientY: 16,
          shiftKey: true,
        }));
        // Drag 7px → floor(7/6) = 1, idx 1 = clear
        h.onPointerMove(makePointerEvent({
          clientX: 170, clientY: 23,
          shiftKey: true,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 170, clientY: 23,
        }));

        // idx 1 = clear from step 4 onward
        // prefix = '1111', remaining = 12 zeros
        expect(onSetTrackSteps).toHaveBeenCalledWith(
          'bd',
          '1111' + '000000000000'
        );
      }
    );

    it(
      'absolute distance determines pattern index',
      () => {
        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        // Drag down 25px
        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 41,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 41,
        }));

        const callsDown = onSetTrackSteps.mock.calls
          .map((c: [TrackId, string]) => c[1]);
        onSetTrackSteps.mockClear();

        // Drag up 25px (clientY goes from 16 to -9)
        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: -9,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: -9,
        }));

        const callsUp = onSetTrackSteps.mock.calls
          .map((c: [TrackId, string]) => c[1]);

        // Both directions should produce same result
        expect(callsDown).toEqual(callsUp);
      }
    );

    it(
      'wraps around after last pattern',
      () => {
        // 3 patterns → 5 total positions (0,1,2,3,4)
        // After position 4 (pattern[2]), wraps to 0
        // floor(100/20) = 5 positions → 5 % 5 = 0
        const tc = makeDefaultTracks();
        tc.bd = { steps: '1010101010101010' };

        const { result: r2 } =
          renderDragPaintWithCycling(tc);
        const h2 = r2.current;

        // 30px → floor(30/6) = 5, 5 % 5 = 0
        // position 0 = snapshot (no change)
        h2.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        h2.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 46,
        }));
        h2.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 46,
        }));

        // The last call should be position 0 (snapshot)
        const lastCall =
          onSetTrackSteps.mock.calls[
            onSetTrackSteps.mock.calls.length - 1
          ];
        expect(lastCall[1]).toBe('1010101010101010');
      }
    );

    it(
      'escape cancels and restores original steps',
      () => {
        const tc = makeDefaultTracks();
        tc.bd = { steps: '1010101010101010' };
        const snapshot = tc.bd.steps;

        const { result } = renderDragPaintWithCycling(
          tc
        );
        const h = result.current;

        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        // Drag enough to start cycling
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 41,
        }));

        onSetTrackSteps.mockClear();

        // Press Escape
        act(() => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape' })
          );
        });

        // Should restore snapshot
        expect(onSetTrackSteps).toHaveBeenCalledWith(
          'bd', snapshot
        );
      }
    );

    it(
      'click-aligned: pattern starts at click step',
      () => {
        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        // Click bd step 4 (x = 4*40+10 = 170)
        // pattern[0] = '1010101010101010'
        // prefix = '0000' (4 steps)
        // remaining = 12 steps from pattern[0]:
        //   '101010101010'
        h.onPointerDown(makePointerEvent({
          clientX: 170, clientY: 16,
          shiftKey: true,
        }));
        // Drag 45px → floor(45/20) = 2, idx 2 = pattern[0]
        h.onPointerMove(makePointerEvent({
          clientX: 170, clientY: 61,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 170, clientY: 61,
        }));

        expect(onSetTrackSteps).toHaveBeenCalledWith(
          'bd',
          '0000' + '101010101010'
        );
      }
    );

    it(
      'respects track length when applying pattern',
      () => {
        const tc = makeDefaultTracks();
        tc.bd = { steps: '00000000' };

        const { result } = renderDragPaintWithCycling(
          tc
        );
        const h = result.current;

        // Click bd step 2 (x = 2*40+10 = 90)
        // remaining = 8 - 2 = 6 steps
        // pattern[0] = '1010101010101010'
        // substring(0, 6) = '101010'
        h.onPointerDown(makePointerEvent({
          clientX: 90, clientY: 16,
          shiftKey: true,
        }));
        // Drag 45px → idx 2 = pattern[0]
        h.onPointerMove(makePointerEvent({
          clientX: 90, clientY: 61,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 90, clientY: 61,
        }));

        expect(onSetTrackSteps).toHaveBeenCalledWith(
          'bd',
          '00' + '101010'
        );
      }
    );

    it(
      'blocked when popover is open',
      () => {
        popoverOpenRef = { current: true };

        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 61,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 61,
        }));

        expect(onSetTrackSteps).not.toHaveBeenCalled();
      }
    );

    it(
      'touch: long-press ref triggers cycling mode',
      () => {
        longPressActiveRef = { current: true };

        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        // Touch down
        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          pointerType: 'touch',
        }));
        // Drag > 10px (touch threshold)
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 47,
          pointerType: 'touch',
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 47,
          pointerType: 'touch',
        }));

        expect(onSetTrackSteps).toHaveBeenCalled();
        // Should NOT have called normal step painter
        expect(onSetStep).not.toHaveBeenCalled();
      }
    );

    it(
      'touch: without long-press ref, normal paint',
      () => {
        // longPressActiveRef remains false
        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          pointerType: 'touch',
        }));
        // Normal horizontal drag
        h.onPointerMove(makePointerEvent({
          clientX: 50, clientY: 16,
          pointerType: 'touch',
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 50, clientY: 16,
          pointerType: 'touch',
        }));

        // Normal paint should fire, not cycling
        expect(onSetStep).toHaveBeenCalledWith(
          'bd', 0, '1'
        );
        expect(onSetTrackSteps).not.toHaveBeenCalled();
      }
    );

    it(
      'cycling: adds click suppression after drag',
      () => {
        const { result } = renderDragPaintWithCycling();
        const h = result.current;

        h.onPointerDown(makePointerEvent({
          clientX: 10, clientY: 16,
          shiftKey: true,
        }));
        h.onPointerMove(makePointerEvent({
          clientX: 10, clientY: 41,
        }));
        h.onPointerUp(makePointerEvent({
          clientX: 10, clientY: 41,
        }));

        expect(
          container.addEventListener
        ).toHaveBeenCalledWith(
          'click',
          expect.any(Function),
          { once: true, capture: true }
        );
      }
    );
  });
});

describe('pageOffset support', () => {
  it('paintOne rejects steps beyond track length with offset', () => {
    const onSetStep = vi.fn();
    const tracks: TrackId[] = ['bd', 'sd'];
    const { container, elements } = makeMockDOM(tracks);
    mockElementFromPoint(elements, tracks);

    const { result } = renderHook(() =>
      useDragPaint({
        containerRef: { current: container },
        trackOrder: tracks,
        tracks: {
          bd: { steps: '0'.repeat(18) },
          sd: { steps: '0'.repeat(18) },
        } as Record<TrackId, TrackConfig>,
        onSetStep,
        pageOffset: 16,
      })
    );

    // Simulate pointer down on bd step 5
    // (global 21, beyond trackLength 18)
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientX: 5 * 40 + 20,
        clientY: 16,
        pointerId: 1,
        pointerType: 'mouse',
        shiftKey: false,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(onSetStep).not.toHaveBeenCalled();
  });
});
