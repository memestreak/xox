"use client";

import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { TrackId } from './types';

interface UseDragPaintOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  trackOrder: TrackId[];
  trackLengths: Record<TrackId, number>;
  steps: Record<TrackId, string>;
  onSetStep: (
    trackId: TrackId,
    stepIndex: number,
    value: '0' | '1'
  ) => void;
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
}

const DRAG_THRESHOLD = 5;

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
 * Returns pointer event handlers to spread on a
 * container div wrapping all track rows.
 */
export function useDragPaint({
  containerRef,
  trackOrder,
  trackLengths,
  steps,
  onSetStep,
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
  });

  const stepsAtDown = useRef(steps);

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
      if (stepIdx >= trackLengths[tid]) return false;
      if (
        trackIdx === drag.lastTrackIdx
        && stepIdx === drag.lastStep
      ) {
        return false;
      }
      drag.lastTrackIdx = trackIdx;
      drag.lastStep = stepIdx;
      onSetStep(tid, stepIdx, drag.paintValue);
      return true;
    },
    [trackOrder, trackLengths, onSetStep]
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const hit = cellFromPoint(
        e.clientX, e.clientY
      );
      if (!hit) return;

      const { trackId, stepIndex } = hit;
      if (stepIndex >= trackLengths[trackId]) return;

      stepsAtDown.current = steps;

      const drag = dragRef.current;
      drag.active = true;
      drag.dragged = false;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.pointerId = e.pointerId;
      drag.lastTrackIdx = -1;
      drag.lastStep = -1;

      drag.paintValue =
        stepsAtDown.current[trackId][stepIndex] === '1'
          ? '0' : '1';
    },
    [trackLengths, steps]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      if (e.pointerId !== drag.pointerId) return;

      const container = containerRef.current;
      if (!container) return;

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
    [containerRef, paintTo]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      if (e.pointerId !== drag.pointerId) return;

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
