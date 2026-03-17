"use client";

import { memo, useRef } from 'react';
import { useLongPress } from 'use-long-press';
import type { StepConditions } from './types';

interface StepButtonProps {
  trackName: string;
  stepIndex: number;
  isActive: boolean;
  isCurrent: boolean;
  isBeat: boolean;
  isDisabled: boolean;
  onToggle: () => void;
  conditions?: StepConditions;
  onOpenPopover?: (
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

  const longPress = useLongPress(
    () => {
      if (isActive && onOpenPopover) {
        navigator.vibrate?.(10);
        const el = buttonRef.current;
        const r = el?.getBoundingClientRect();
        onOpenPopover({
          top: (r?.bottom ?? 0) + 4,
          left: r?.left ?? 0,
        });
      }
    },
    {
      threshold: 500,
      cancelOnMovement: 25,
    }
  );

  if (isDisabled) {
    return (
      <div
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
      {...longPress()}
      onClick={onToggle}
      onContextMenu={(e) => {
        e.preventDefault();
        if (isActive && onOpenPopover) {
          const el = buttonRef.current;
          const r = el?.getBoundingClientRect();
          onOpenPopover({
            top: (r?.bottom ?? e.clientY) + 4,
            left: r?.left ?? e.clientX,
          });
        }
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
