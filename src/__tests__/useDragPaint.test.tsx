import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { useDragPaint } from '../app/useDragPaint';
import type { TrackId } from '../app/types';
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

function makeDefaultSteps(): Record<TrackId, string> {
  const s = {} as Record<TrackId, string>;
  for (const id of TRACK_IDS) {
    s[id] = '0000000000000000';
  }
  return s;
}

function makeDefaultLengths(): Record<TrackId, number> {
  const l = {} as Record<TrackId, number>;
  for (const id of TRACK_IDS) l[id] = 16;
  return l;
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
    steps?: Record<TrackId, string>,
    trackLengths?: Record<TrackId, number>
  ) {
    return renderHook(() =>
      useDragPaint({
        containerRef,
        trackOrder: tracks,
        trackLengths:
          trackLengths ?? makeDefaultLengths(),
        steps: steps ?? makeDefaultSteps(),
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

  it('shift+drag erases across tracks', () => {
    const steps = makeDefaultSteps();
    steps.bd = '1111111111111111';
    steps.sd = '1111111111111111';

    const { result } = renderDragPaint(steps);
    const h = result.current;

    h.onPointerDown(makePointerEvent({
      clientX: 10, clientY: 16, shiftKey: true,
    }));
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 16, shiftKey: true,
    }));
    // Move to sd row
    h.onPointerMove(makePointerEvent({
      clientX: 50, clientY: 50, shiftKey: true,
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

  it('touch drag on ON cell infers erase mode', () => {
    const steps = makeDefaultSteps();
    steps.bd = '1000000000000000';

    const { result } = renderDragPaint(steps);
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
    const lengths = makeDefaultLengths();
    lengths.bd = 8;

    const { result } = renderDragPaint(
      undefined, lengths
    );
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
});
