"use client";

import {
  memo, useCallback, useLayoutEffect, useState,
  type RefObject,
} from 'react';
import {
  LongPressEventType, useLongPress,
} from 'use-long-press';
import {
  LONG_PRESS_MS, ENDBAR_LONG_PRESS_CANCEL_PX,
} from './constants';
import Tooltip from './Tooltip';
import {
  lengthFromGridPoint, lengthHandleSpot, measureCells,
  type CellBox,
} from './gridUtils';

/** Widest the visible bar gets, px. */
const BAR_MAX_PX = 6;
/** Narrowest the visible bar gets, px. */
const BAR_MIN_PX = 3;
/** Space kept between the bar and each pad, px. */
const BAR_CLEARANCE_PX = 1;

/**
 * Track the grid's cell boxes, re-measuring whenever
 * the grid resizes (window, sidebar, font load, or the
 * phone/desktop column switch).
 */
function useCellBoxes(
  gridRef: RefObject<HTMLDivElement | null>,
): CellBox[] {
  const [cells, setCells] = useState<CellBox[]>([]);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => setCells(measureCells(grid));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridRef]);
  return cells;
}

interface TrackEndBarProps {
  trackName: string;
  trackLength: number;
  patternLength: number;
  pageOffset: number;
  isFreeRun: boolean;
  onSetTrackLength: (length: number) => void;
  onToggleFreeRun: () => void;
  /** Ref to the parent step-grid container. */
  gridRef: RefObject<HTMLDivElement | null>;
  /** Show tooltip around handle (default true). */
  showTooltip?: boolean;
}

/**
 * Draggable length handle + free-run indicator.
 * Shared by TrackRow and AccentRow.
 *
 * Renders as an absolutely-positioned overlay inside
 * the parent's step grid container. The parent must
 * set `position: relative` on the grid wrapper.
 */
function TrackEndBarInner({
  trackName,
  trackLength,
  patternLength,
  pageOffset,
  isFreeRun,
  onSetTrackLength,
  gridRef,
  onToggleFreeRun,
  showTooltip = true,
}: TrackEndBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const cells = useCellBoxes(gridRef);

  const endBarLongPress = useLongPress(
    () => {
      navigator.vibrate?.(10);
      onToggleFreeRun();
    },
    {
      detect: LongPressEventType.Touch,
      threshold: LONG_PRESS_MS,
      cancelOnMovement: ENDBAR_LONG_PRESS_CANCEL_PX,
    }
  );

  const handleOnPage =
    trackLength > pageOffset
    && trackLength <= pageOffset + 16;
  const countOnPage = trackLength - pageOffset;
  // Centered in the gap after the last used pad.
  // Before the grid is measured (first paint, tests),
  // fall back to a fraction of the grid's width.
  const spot = handleOnPage
    ? lengthHandleSpot(cells, countOnPage)
    : null;
  const barPx = spot
    ? Math.min(
      BAR_MAX_PX,
      Math.max(BAR_MIN_PX, spot.gap - 2 * BAR_CLEARANCE_PX),
    )
    : BAR_MAX_PX;
  const position: React.CSSProperties = spot
    ? { left: spot.x, top: spot.top, height: spot.height }
    : { left: `${(countOnPage / 16) * 100}%` };

  const lengthFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const grid = gridRef.current;
      if (!grid) return pageOffset + 1;
      const rect = grid.getBoundingClientRect();
      const live = measureCells(grid);
      const onPage = lengthHandleSpot(live, 1)
        ? lengthFromGridPoint(
          live, clientX - rect.left, clientY - rect.top,
        )
        : Math.round((clientX - rect.left) / (rect.width / 16));
      return Math.max(
        1,
        Math.min(patternLength, onPage + pageOffset)
      );
    },
    [patternLength, pageOffset, gridRef]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Stop propagation so the parent grid's
      // drag-paint / gap-selection handler doesn't
      // also claim this pointer and steal capture.
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onToggleFreeRun();
        return;
      }
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(
        e.pointerId
      );
      setIsDragging(true);
    },
    [onToggleFreeRun]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const len = lengthFromPointer(e.clientX, e.clientY);
      if (len !== trackLength) {
        onSetTrackLength(len);
      }
    },
    [isDragging, lengthFromPointer, trackLength,
      onSetTrackLength]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!handleOnPage) return null;

  const handle = (
    <div
      role="slider"
      aria-label={`${trackName} length`}
      aria-valuemin={1}
      aria-valuemax={patternLength}
      aria-valuenow={trackLength}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      {...endBarLongPress()}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isDragging) onToggleFreeRun();
      }}
      style={{
        ...position,
        touchAction: 'none',
        ['--bar-w' as string]: `${barPx}px`,
      }}
      className={
        'absolute top-0 h-full w-4'
        + ' -translate-x-1/2 z-20'
        + (isDragging
          ? ' cursor-col-resize'
          : ' cursor-default')
        + ' before:absolute before:inset-y-0'
        + ' before:left-1/2'
        + ' before:-translate-x-1/2'
        + ' before:w-(--bar-w) before:rounded-full'
        + ' before:transition-colors'
        + (isDragging
          ? ' before:bg-ink'
          : ' before:bg-edge'
            + ' hover:before:bg-ink')
      }
    />
  );

  return (
    <>
      {showTooltip ? (
        <Tooltip
          tooltipKey="lengthHandle"
          align="right"
        >
          {handle}
        </Tooltip>
      ) : handle}

      {isFreeRun && (
        <span
          aria-label="free run"
          style={{
            left: position.left,
            top: spot ? spot.top + spot.height / 2 : undefined,
            fontFamily: 'var(--font-barlow-condensed)',
          }}
          className={
            'absolute top-1/2 -translate-x-1/2'
            + ' -translate-y-1/2 z-30'
            + ' pointer-events-none select-none'
            + ' flex items-center'
            + ' justify-center'
            + ' w-3.5 h-3.5 rounded-full'
            + ' bg-accent'
            + ' text-[11px] font-bold'
            + ' text-[#1a0d05]'
            + ' shadow-[0_0_6px_rgb(240_102_42/0.6)]'
          }
        >
          F
        </span>
      )}
    </>
  );
}

const TrackEndBar = memo(TrackEndBarInner);
export default TrackEndBar;
