"use client";

import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { TrackConfig, TrackId, TrackPattern } from './types';

interface UseDragPaintOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  trackOrder: TrackId[];
  tracks: Record<TrackId, TrackConfig>;
  onSetStep: (
    trackId: TrackId,
    stepIndex: number,
    value: '0' | '1'
  ) => void;
  patterns?: TrackPattern[];
  onSetTrackSteps?: (trackId: TrackId, steps: string) => void;
  longPressActiveRef?: RefObject<boolean>;
  popoverOpenRef?: RefObject<boolean>;
  pageOffset?: number;
  onSelectionStart?: (
    trackId: TrackId, step: number
  ) => void;
  onSelectionUpdate?: (
    trackId: TrackId, step: number
  ) => void;
  onClearSelection?: () => void;
}

interface CellHit {
  trackId: TrackId;
  stepIndex: number;
}

interface DragState {
  active: boolean;
  dragged: boolean;
  startX: number;
  startY: number;
  pointerId: number;
  paintValue: '0' | '1';
  lastTrackIdx: number;
  lastStep: number;
  cyclingMode: boolean;
  cycleTrackId: TrackId | null;
  cycleStartStep: number;
  cycleSnapshot: string;
  cyclePatternIdx: number;
  escapeHandler: ((e: KeyboardEvent) => void) | null;
  selectionMode: boolean;
  selectionHit: CellHit | null;
}

const DRAG_THRESHOLD = 5;
const CYCLE_THRESHOLD_TOUCH = 10;
const CYCLE_PX_PER_STEP = 6;

/**
 * Find the track and step under a point using
 * data-track and data-step attributes. Walks up
 * from the element at the point to find both.
 *
 * Returns null if the point is outside all cells.
 */
function cellFromPoint(
  clientX: number,
  clientY: number
): CellHit | null {
  const el = document.elementFromPoint(
    clientX, clientY
  );
  if (!el) return null;

  let node: Element | null = el;
  while (
    node
    && !('step' in (node as HTMLElement).dataset)
  ) {
    node = node.parentElement;
  }
  if (!node) return null;
  const stepIndex = Number(
    (node as HTMLElement).dataset.step
  );

  while (
    node
    && !('track' in (node as HTMLElement).dataset)
  ) {
    node = node.parentElement;
  }
  if (!node) return null;
  const trackId = (
    node as HTMLElement
  ).dataset.track as TrackId;

  return { trackId, stepIndex };
}

/**
 * Bresenham's line algorithm yielding all (col, row)
 * cells between two grid coordinates, inclusive of
 * both endpoints.
 */
function* bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Generator<[number, number]> {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    yield [x0, y0];
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/**
 * Hook for click-drag painting/erasing of sequencer
 * steps across multiple tracks. Paint mode is inferred
 * from the first cell: if ON, the drag erases; if OFF,
 * the drag fills. Fast drags interpolate using
 * Bresenham's line algorithm so no cells are skipped.
 *
 * When shift is held (mouse) or longPressActiveRef is
 * true (touch), vertical drag cycles through patterns
 * instead of painting individual cells.
 *
 * Returns pointer event handlers to spread on a
 * container div wrapping all track rows.
 */
export function useDragPaint({
  containerRef,
  trackOrder,
  tracks,
  onSetStep,
  patterns = [],
  onSetTrackSteps,
  longPressActiveRef,
  popoverOpenRef,
  pageOffset = 0,
  onSelectionStart,
  onSelectionUpdate,
  onClearSelection,
}: UseDragPaintOptions) {
  const dragRef = useRef<DragState>({
    active: false,
    dragged: false,
    startX: 0,
    startY: 0,
    pointerId: -1,
    paintValue: '1',
    lastTrackIdx: -1,
    lastStep: -1,
    cyclingMode: false,
    cycleTrackId: null,
    cycleStartStep: 0,
    cycleSnapshot: '',
    cyclePatternIdx: -1,
    escapeHandler: null,
    selectionMode: false,
    selectionHit: null,
  });

  const stepsAtDown = useRef(
    Object.fromEntries(
      Object.entries(tracks).map(
        ([id, tc]) => [id, tc.steps]
      )
    ) as Record<TrackId, string>
  );

  const trackIndex = useCallback(
    (id: TrackId): number => trackOrder.indexOf(id),
    [trackOrder]
  );

  /**
   * Paint a single cell and update last-painted
   * position. Returns false if the cell was skipped
   * (disabled or same as last).
   */
  const paintOne = useCallback(
    (
      trackIdx: number,
      stepIdx: number,
      drag: DragState
    ): boolean => {
      if (
        trackIdx < 0
        || trackIdx >= trackOrder.length
      ) {
        return false;
      }
      const tid = trackOrder[trackIdx];
      if (stepIdx + pageOffset >= tracks[tid].steps.length) return false;
      if (
        trackIdx === drag.lastTrackIdx
        && stepIdx === drag.lastStep
      ) {
        return false;
      }
      drag.lastTrackIdx = trackIdx;
      drag.lastStep = stepIdx;
      onSetStep(tid, stepIdx + pageOffset, drag.paintValue);
      return true;
    },
    [trackOrder, tracks, onSetStep, pageOffset]
  );

  /**
   * Paint from the last-painted cell to the target
   * cell, interpolating any skipped cells via
   * Bresenham's line algorithm.
   */
  const paintTo = useCallback(
    (hit: CellHit, drag: DragState) => {
      const tIdx = trackIndex(hit.trackId);
      if (tIdx === -1) return;

      if (drag.lastTrackIdx === -1) {
        // First cell — no interpolation needed
        paintOne(tIdx, hit.stepIndex, drag);
        return;
      }

      for (const [col, row] of bresenham(
        drag.lastStep,
        drag.lastTrackIdx,
        hit.stepIndex,
        tIdx
      )) {
        paintOne(row, col, drag);
      }
    },
    [trackIndex, paintOne]
  );

  /**
   * Apply a pattern at the given cycle index for a
   * track starting at startStep. Returns the new
   * steps string.
   *
   * - idx 0: return snapshot (no-op / current state)
   * - idx 1: clear from startStep onward
   * - idx 2+: apply pattern[idx-2] from startStep
   */
  const applyPatternAtIndex = useCallback(
    (
      trackId: TrackId,
      startStep: number,
      snapshot: string,
      idx: number
    ): string => {
      const prefix = snapshot.substring(0, startStep);
      const remaining = tracks[trackId].steps.length - startStep;

      if (idx === 0) {
        return snapshot;
      }
      if (idx === 1) {
        return prefix + '0'.repeat(remaining);
      }
      const pattern = patterns[idx - 2];
      const fill = pattern.steps
        .substring(0, remaining)
        .padEnd(remaining, '0');
      return prefix + fill;
    },
    [tracks, patterns]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const hit = cellFromPoint(
        e.clientX, e.clientY
      );

      // Selection mode: Ctrl/Cmd held — can start
      // from empty space between rows
      if (
        (e.ctrlKey || e.metaKey)
        && onSelectionStart
      ) {
        const drag = dragRef.current;
        drag.active = true;
        drag.dragged = false;
        drag.startX = e.clientX;
        drag.startY = e.clientY;
        drag.pointerId = e.pointerId;
        drag.lastTrackIdx = -1;
        drag.lastStep = -1;
        drag.escapeHandler = null;
        drag.selectionMode = true;
        drag.cyclingMode = false;
        drag.selectionHit = hit
          ? {
              trackId: hit.trackId,
              stepIndex: hit.stepIndex + pageOffset,
            }
          : null;
        e.preventDefault();
        return;
      }

      if (!hit) return;

      const { trackId, stepIndex } = hit;
      if (stepIndex + pageOffset >= tracks[trackId].steps.length) return;

      stepsAtDown.current = Object.fromEntries(
        Object.entries(tracks).map(
          ([id, tc]) => [id, tc.steps]
        )
      ) as Record<TrackId, string>;

      const drag = dragRef.current;
      drag.active = true;
      drag.dragged = false;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.pointerId = e.pointerId;
      drag.lastTrackIdx = -1;
      drag.lastStep = -1;
      drag.escapeHandler = null;
      drag.selectionMode = false;

      // Selection is cleared when a drag actually starts
      // (in onPointerMove), not here on pointerdown.
      // This lets StepButton's click handler act on the
      // selection before it's cleared (e.g. toggle all
      // selected cells on plain click).
      // Shift+click preserves selection (handled in
      // StepButton onClick).

      // Determine if we should enter cycling mode
      const isMouseShift =
        e.pointerType === 'mouse' && e.shiftKey;
      const isTouchLongPress =
        e.pointerType !== 'mouse'
        && (longPressActiveRef?.current === true);
      const popoverOpen =
        popoverOpenRef?.current === true;

      if (
        (isMouseShift || isTouchLongPress)
        && !popoverOpen
        && patterns.length > 0
        && onSetTrackSteps
      ) {
        // Cycling mode
        drag.cyclingMode = true;
        drag.cycleTrackId = trackId;
        drag.cycleStartStep = stepIndex;
        drag.cycleSnapshot = stepsAtDown.current[trackId];
        drag.cyclePatternIdx = -1;
        return;
      }

      // Normal paint mode
      drag.cyclingMode = false;
      drag.paintValue =
        stepsAtDown.current[trackId][
          stepIndex + pageOffset
        ] === '1'
          ? '0' : '1';
    },
    [
      tracks,
      patterns,
      onSetTrackSteps,
      longPressActiveRef,
      popoverOpenRef,
      pageOffset,
      onSelectionStart,
    ]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      if (e.pointerId !== drag.pointerId) return;

      const container = containerRef.current;
      if (!container) return;

      // Selection mode branch
      if (drag.selectionMode) {
        if (!drag.dragged) {
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          if (
            Math.sqrt(dx * dx + dy * dy)
            < DRAG_THRESHOLD
          ) {
            return;
          }
          drag.dragged = true;
          try {
            container.setPointerCapture(
              drag.pointerId
            );
          } catch {
            // Pointer may already be captured or lost
          }
          // Start the selection rectangle from the
          // initial pointerDown hit (if any)
          if (drag.selectionHit && onSelectionStart) {
            onSelectionStart(
              drag.selectionHit.trackId,
              drag.selectionHit.stepIndex
            );
          }
        }

        const hit = cellFromPoint(
          e.clientX, e.clientY
        );
        if (hit) {
          const globalStep =
            hit.stepIndex + (pageOffset ?? 0);
          if (onSelectionUpdate) {
            onSelectionUpdate(
              hit.trackId, globalStep
            );
          }
        }
        return;
      }

      // Cycling mode branch
      if (drag.cyclingMode) {
        const dy = Math.abs(e.clientY - drag.startY);
        const threshold =
          e.pointerType !== 'mouse'
            ? CYCLE_THRESHOLD_TOUCH
            : DRAG_THRESHOLD;

        if (!drag.dragged) {
          if (dy < threshold) return;

          drag.dragged = true;
          onClearSelection?.();
          try {
            container.setPointerCapture(drag.pointerId);
          } catch {
            // Pointer may already be captured or lost
          }

          // Add Escape key listener to cancel cycling
          const escHandler = (ev: KeyboardEvent) => {
            if (ev.key !== 'Escape') return;
            const d = dragRef.current;
            if (
              d.cyclingMode
              && d.cycleTrackId
              && onSetTrackSteps
            ) {
              onSetTrackSteps(
                d.cycleTrackId, d.cycleSnapshot
              );
            }
            document.removeEventListener(
              'keydown', escHandler
            );
            d.escapeHandler = null;
            d.active = false;
            d.dragged = false;
            d.cyclingMode = false;
            d.cycleTrackId = null;
            const cont = containerRef.current;
            if (cont) {
              try {
                cont.releasePointerCapture(d.pointerId);
              } catch {
                // Already released
              }
            }
          };
          drag.escapeHandler = escHandler;
          document.addEventListener('keydown', escHandler);
        }

        // Calculate which pattern position we're at
        const totalPositions = patterns.length + 2;
        const rawIdx = Math.floor(
          dy / CYCLE_PX_PER_STEP
        );
        const idx = rawIdx % totalPositions;

        if (
          idx !== drag.cyclePatternIdx
          && drag.cycleTrackId
          && onSetTrackSteps
        ) {
          drag.cyclePatternIdx = idx;
          const newSteps = applyPatternAtIndex(
            drag.cycleTrackId,
            drag.cycleStartStep,
            drag.cycleSnapshot,
            idx
          );
          onSetTrackSteps(drag.cycleTrackId, newSteps);
        }

        return;
      }

      // Normal paint mode
      if (!drag.dragged) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (
          Math.sqrt(dx * dx + dy * dy)
          < DRAG_THRESHOLD
        ) {
          return;
        }
        drag.dragged = true;
        onClearSelection?.();
        try {
          container.setPointerCapture(
            drag.pointerId
          );
        } catch {
          // Pointer may already be captured or lost
        }

        const startHit = cellFromPoint(
          drag.startX, drag.startY
        );
        if (startHit) paintTo(startHit, drag);
      }

      const hit = cellFromPoint(
        e.clientX, e.clientY
      );
      if (hit) paintTo(hit, drag);
    },
    [containerRef, paintTo, applyPatternAtIndex,
      patterns, onSetTrackSteps,
      onSelectionStart, onSelectionUpdate, pageOffset,
      onClearSelection]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      if (e.pointerId !== drag.pointerId) return;

      // Selection mode cleanup
      if (drag.selectionMode) {
        const wasDragged = drag.dragged;
        drag.active = false;
        drag.dragged = false;
        drag.selectionMode = false;

        const container = containerRef.current;
        if (container) {
          try {
            container.releasePointerCapture(
              drag.pointerId
            );
          } catch {
            // Already released
          }
          if (wasDragged) {
            container.addEventListener(
              'click',
              (evt) => evt.stopPropagation(),
              { once: true, capture: true }
            );
          }
        }
        return;
      }

      // Cycling mode cleanup
      if (drag.cyclingMode) {
        if (drag.escapeHandler) {
          document.removeEventListener(
            'keydown', drag.escapeHandler
          );
          drag.escapeHandler = null;
        }

        const wasDragged = drag.dragged;
        drag.active = false;
        drag.dragged = false;
        drag.cyclingMode = false;
        drag.cycleTrackId = null;

        const container = containerRef.current;
        if (container) {
          try {
            container.releasePointerCapture(
              drag.pointerId
            );
          } catch {
            // Already released
          }
          if (wasDragged) {
            container.addEventListener(
              'click',
              (evt) => evt.stopPropagation(),
              { once: true, capture: true }
            );
          }
        }

        return;
      }

      // Normal paint mode cleanup
      const wasDragged = drag.dragged;
      drag.active = false;
      drag.dragged = false;

      const container = containerRef.current;
      if (container) {
        try {
          container.releasePointerCapture(
            drag.pointerId
          );
        } catch {
          // Already released
        }
      }

      if (wasDragged && container) {
        container.addEventListener(
          'click',
          (evt) => evt.stopPropagation(),
          { once: true, capture: true }
        );
      }
    },
    [containerRef]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
}
