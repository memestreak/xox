"use client";

import {
  memo, useCallback, useRef, useState,
} from 'react';
import {
  LongPressEventType, useLongPress,
} from 'use-long-press';
import type { TrackId } from './types';
import StepButton from './StepButton';
import Knob from './Knob';
import Tooltip from './Tooltip';

interface AccentRowProps {
  steps: string;
  trackLength: number;
  patternLength: number;
  pageOffset: number;
  isFreeRun: boolean;
  gain: number;
  currentStep: number;
  totalSteps: number;
  onToggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onSetTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  onToggleFreeRun: (trackId: TrackId) => void;
  onSetGain: (
    trackId: TrackId, value: number
  ) => void;
  onClearTrack: (trackId: TrackId) => void;
}

/**
 * Mini accent row at the bottom of the step grid.
 * Half-height step buttons for toggling accent steps,
 * with a draggable length handle, free-run support,
 * and an intensity knob.
 */
function AccentRowInner({
  steps,
  trackLength,
  patternLength,
  pageOffset,
  isFreeRun,
  gain,
  currentStep,
  totalSteps,
  onToggleStep,
  onSetTrackLength,
  onToggleFreeRun,
  onSetGain,
  onClearTrack,
}: AccentRowProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFreeRun = useCallback(
    () => onToggleFreeRun('ac'),
    [onToggleFreeRun]
  );

  const handleGain = useCallback(
    (v: number) => onSetGain('ac', v),
    [onSetGain]
  );

  const handleClear = useCallback(
    () => onClearTrack('ac'),
    [onClearTrack]
  );

  const handleToggleStep = useCallback(
    (tid: TrackId, localStep: number) =>
      onToggleStep(tid, localStep + pageOffset),
    [onToggleStep, pageOffset]
  );

  // ─── Drag handle logic ──────────────────────────
  const endBarLongPress = useLongPress(
    () => {
      navigator.vibrate?.(10);
      handleFreeRun();
    },
    {
      detect: LongPressEventType.Touch,
      threshold: 500,
      cancelOnMovement: 1,
    }
  );

  const effectiveStep =
    currentStep >= 0
      ? (isFreeRun ? totalSteps : currentStep)
        % trackLength
      : -1;

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
        handleFreeRun();
        return;
      }
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(
        e.pointerId
      );
      setIsDragging(true);
    },
    [handleFreeRun]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const len = lengthFromPointer(e.clientX);
      if (len !== trackLength) {
        onSetTrackLength('ac', len);
      }
    },
    [isDragging, lengthFromPointer, trackLength,
      onSetTrackLength]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleOnPage =
    trackLength > pageOffset
    && trackLength <= pageOffset + 16;
  const handlePct = handleOnPage
    ? ((trackLength - pageOffset) / 16) * 100
    : 0;

  return (
    <div>
      {/* Mobile: label + knob above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <button
          type="button"
          onClick={(e) => {
            if (e.shiftKey) handleClear();
          }}
          className={
            'text-[10px] font-bold uppercase'
            + ' tracking-wider bg-transparent'
            + ' border-none cursor-pointer'
            + ' font-[family-name:var(--font-orbitron)]'
            + (isFreeRun
              ? ' text-orange-400'
              : ' text-neutral-400')
          }
        >
          ACCENT
        </button>
        <div className="ml-auto">
          <Tooltip tooltipKey="accentIntensity" position="bottom">
            <Knob
              value={gain}
              onChange={handleGain}
              trackName="ACCENT"
              size={20}
              defaultValue={0.5}
            />
          </Tooltip>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Desktop: sidebar with label + knob */}
        <div className="hidden lg:flex w-56 items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              if (e.shiftKey) handleClear();
            }}
            className={
              'w-16 truncate text-xs text-left'
              + ' font-bold uppercase tracking-wider'
              + ' bg-transparent border-none cursor-pointer'
              + ' font-[family-name:var(--font-orbitron)]'
              + (isFreeRun
                ? ' text-orange-400'
                : ' text-neutral-400')
            }
          >
            ACCENT
          </button>
          {/* Spacer matching mute + solo toggle widths */}
          <div className="w-6 h-6" />
          <div className="w-6 h-6" />
          <Tooltip tooltipKey="accentIntensity" position="bottom">
            <Knob
              value={gain}
              onChange={handleGain}
              trackName="ACCENT"
              defaultValue={0.5}
            />
          </Tooltip>
        </div>

        {/* Step grid with drag handle */}
        <div className="flex-1 relative">
          <div
            ref={gridRef}
            data-track="ac"
            className="grid grid-cols-8 lg:grid-cols-16 gap-[3px] lg:gap-1.5"
          >
            {Array.from(
              { length: 16 },
              (_, i) => {
                const globalIdx = pageOffset + i;
                const disabled =
                  globalIdx >= trackLength
                  || globalIdx >= patternLength;
                return (
                  <StepButton
                    key={i}
                    trackId={'ac' as TrackId}
                    trackName="accent"
                    stepIndex={i}
                    isActive={
                      !disabled
                      && steps[globalIdx] === '1'
                    }
                    isCurrent={
                      !disabled
                      && effectiveStep === globalIdx
                    }
                    isBeat={globalIdx % 4 === 0}
                    isDisabled={disabled}
                    mini
                    onToggle={handleToggleStep}
                  />
                );
              }
            )}
          </div>

          {/* Draggable length handle */}
          {handleOnPage && (
            <div
              role="slider"
              aria-label="accent length"
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
                if (!isDragging) handleFreeRun();
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
          )}

          {/* Free-run indicator */}
          {isFreeRun && handleOnPage && (
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
        </div>
      </div>
    </div>
  );
}

const AccentRow = memo(AccentRowInner);
export default AccentRow;
