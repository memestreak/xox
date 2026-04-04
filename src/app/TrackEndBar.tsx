"use client";

import { memo, useCallback, useRef, useState } from 'react';
import {
  LongPressEventType, useLongPress,
} from 'use-long-press';
import {
  LONG_PRESS_MS, ENDBAR_LONG_PRESS_CANCEL_PX,
} from './constants';
import Tooltip from './Tooltip';

interface TrackEndBarProps {
  trackName: string;
  trackLength: number;
  patternLength: number;
  pageOffset: number;
  isFreeRun: boolean;
  onSetTrackLength: (length: number) => void;
  onToggleFreeRun: () => void;
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
  onToggleFreeRun,
  showTooltip = true,
}: TrackEndBarProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
  const handlePct = handleOnPage
    ? ((trackLength - pageOffset) / 16) * 100
    : 0;

  const lengthFromPointer = useCallback(
    (clientX: number): number => {
      const grid = gridRef.current;
      if (!grid) return trackLength;
      const rect = grid.getBoundingClientRect();
      const x = clientX - rect.left;
      const stepWidth = rect.width / 16;
      const raw = Math.round(x / stepWidth);
      return Math.max(
        1,
        Math.min(patternLength, raw + pageOffset)
      );
    },
    [patternLength, trackLength, pageOffset]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
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
      const len = lengthFromPointer(e.clientX);
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
      ref={gridRef}
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
        left: `${handlePct}%`,
        touchAction: 'none',
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
        + ' before:w-1.5 before:rounded-full'
        + ' before:transition-colors'
        + (isDragging
          ? ' before:bg-neutral-300'
          : ' before:bg-neutral-500/60'
            + ' hover:before:bg-neutral-300')
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
            left: `${handlePct}%`,
            fontFamily: 'var(--font-orbitron)',
          }}
          className={
            'absolute top-1/2 -translate-x-1/2'
            + ' -translate-y-1/2 z-30'
            + ' pointer-events-none select-none'
            + ' flex items-center'
            + ' justify-center'
            + ' w-3.5 h-3.5 rounded-full'
            + ' bg-orange-500'
            + ' text-[10px] font-bold'
            + ' text-white'
            + ' shadow-[0_0_6px_rgba(251,146,60,0.6)]'
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
