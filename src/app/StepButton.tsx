"use client";

import { memo, useCallback, useRef } from 'react';
import { useLongPress } from 'use-long-press';
import type { StepConditions, TrackId } from './types';

interface StepButtonProps {
  trackId: TrackId;
  trackName: string;
  stepIndex: number;
  isActive: boolean;
  isCurrent: boolean;
  isBeat: boolean;
  isDisabled: boolean;
  onToggle: (
    trackId: TrackId, stepIndex: number
  ) => void;
  conditions?: StepConditions;
  onOpenPopover?: (
    trackId: TrackId,
    stepIndex: number,
    rect: { top: number; left: number }
  ) => void;
}

/**
 * Individual step toggle button. Memoized so it only
 * re-renders when its active/current state changes.
 * Disabled steps (beyond the track's length) are dimmed
 * and non-interactive.
 */
function StepButtonInner({
  trackId,
  trackName,
  stepIndex,
  isActive,
  isCurrent,
  isBeat,
  isDisabled,
  onToggle,
  conditions,
  onOpenPopover,
}: StepButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const openPopover = useCallback(
    (clientY?: number, clientX?: number) => {
      if (!isActive || !onOpenPopover) return;
      const el = buttonRef.current;
      const r = el?.getBoundingClientRect();
      onOpenPopover(trackId, stepIndex, {
        top: (r?.bottom ?? clientY ?? 0) + 4,
        left: r?.left ?? clientX ?? 0,
      });
    },
    [isActive, onOpenPopover, trackId, stepIndex]
  );

  const handleToggle = useCallback(
    () => onToggle(trackId, stepIndex),
    [onToggle, trackId, stepIndex]
  );

  const longPress = useLongPress(
    () => {
      navigator.vibrate?.(10);
      openPopover();
    },
    {
      threshold: 500,
      cancelOnMovement: 5,
    }
  );

  if (isDisabled) {
    return (
      <div
        data-step={stepIndex}
        aria-label={
          `${trackName} step ${stepIndex + 1}`
          + ' (inactive)'
        }
        className={
          'h-8 lg:h-12 rounded-sm'
          + ' bg-neutral-900/20 cursor-not-allowed'
          + (isBeat
            ? ' border-l-2 border-neutral-800/30'
            : '')
        }
      />
    );
  }

  let color: string;
  if (isActive) {
    color = isCurrent
      ? 'bg-orange-400 motion-safe:scale-105'
        + ' shadow-[0_0_20px_rgba(251,146,60,0.8)]'
        + ' z-10'
      : 'bg-orange-600';
  } else {
    color = isCurrent
      ? 'bg-neutral-700'
      : 'bg-neutral-800/40 hover:bg-neutral-800';
  }

  return (
    <button
      ref={buttonRef}
      data-step={stepIndex}
      {...longPress()}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          openPopover(e.clientY, e.clientX);
          return;
        }
        handleToggle();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        openPopover(e.clientY, e.clientX);
      }}
      aria-label={
        `${trackName} step ${stepIndex + 1}`
      }
      aria-pressed={isActive}
      style={{ touchAction: 'manipulation' }}
      className={
        'relative overflow-hidden'
        + ' h-8 lg:h-12 rounded-sm'
        + ' transition-colors duration-100'
        + ' motion-safe:transition-transform'
        + ' focus-visible:outline-none'
        + ' focus-visible:ring-2'
        + ' focus-visible:ring-orange-500 '
        + color
        + (isBeat
          ? ' border-l-2 border-neutral-700'
          : '')
      }
    >
      {isActive
        && conditions?.probability !== undefined
        ? (
          <span
            data-testid="prob-bar"
            className={
              'absolute bottom-0 left-0 h-[2px]'
            }
            style={{
              width: `${conditions.probability}%`,
              background: 'rgba(255,255,255,0.85)',
            }}
          />
        ) : null}
      {isActive && conditions?.fill
        ? (
          <span
            data-testid="fill-badge"
            className={
              'absolute top-0 right-0.5'
              + ' text-[8px] font-bold'
              + ' leading-none'
              + ' pointer-events-none'
              + ' text-white'
            }
            style={{
              fontFamily: 'var(--font-orbitron)',
            }}
          >
            {conditions.fill === 'fill'
              ? 'F' : '!F'}
          </span>
        ) : null}
      {isActive && conditions?.cycle != null
        && conditions.cycle.b >= 2
        ? (
          <span
            className={
              'absolute inset-0 flex items-center'
              + ' justify-center text-[13px]'
              + ' font-bold leading-none'
              + ' pointer-events-none'
            }
            style={{
              fontFamily: 'var(--font-orbitron)',
              color: 'rgba(255,255,255,0.9)',
              textShadow:
                '0 1px 2px rgba(0,0,0,0.8)',
              letterSpacing: '0.05em',
            }}
          >
            {conditions.cycle.a}
            :{conditions.cycle.b}
          </span>
        ) : null}
    </button>
  );
}

const StepButton = memo(StepButtonInner);
export default StepButton;
