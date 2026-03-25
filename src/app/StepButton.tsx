"use client";

import { memo, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { useLongPress } from 'use-long-press';
import type { StepConditions, TrackId } from './types';
import Tooltip from './Tooltip';

interface StepButtonProps {
  trackId: TrackId;
  trackName: string;
  stepIndex: number;
  isActive: boolean;
  isCurrent: boolean;
  isBeat: boolean;
  isDisabled: boolean;
  mini?: boolean;
  onToggle: (
    trackId: TrackId, stepIndex: number
  ) => void;
  gainLock?: number;
  conditions?: StepConditions;
  onOpenPopover?: (
    trackId: TrackId,
    stepIndex: number,
    rect: { top: number; left: number }
  ) => void;
  longPressActiveRef?: RefObject<boolean>;
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
  mini,
  onToggle,
  gainLock,
  conditions,
  onOpenPopover,
  longPressActiveRef,
}: StepButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const openPopover = useCallback(
    (clientY?: number, clientX?: number) => {
      if (!onOpenPopover) return;
      const el = buttonRef.current;
      const r = el?.getBoundingClientRect();
      onOpenPopover(trackId, stepIndex, {
        top: (r?.bottom ?? clientY ?? 0) + 4,
        left: r?.left ?? clientX ?? 0,
      });
    },
    [onOpenPopover, trackId, stepIndex]
  );

  const handleToggle = useCallback(
    () => onToggle(trackId, stepIndex),
    [onToggle, trackId, stepIndex]
  );

  const longPress = useLongPress(
    () => {
      navigator.vibrate?.(10);
      if (longPressActiveRef) {
        longPressActiveRef.current = true;
      }
      openPopover();
    },
    {
      threshold: 500,
      cancelOnMovement: 5,
    }
  );

  const handlePointerUp = useCallback(() => {
    if (longPressActiveRef) {
      longPressActiveRef.current = false;
    }
  }, [longPressActiveRef]);

  const sizeClass = mini
    ? 'w-4 h-4 lg:w-5 lg:h-5' : 'h-8 lg:h-12';
  const radiusClass = mini ? 'rounded-full' : 'rounded-sm';

  if (isDisabled) {
    const disabledEl = (
      <div
        data-step={stepIndex}
        aria-label={
          `${trackName} step ${stepIndex + 1}`
          + ' (inactive)'
        }
        className={
          sizeClass + ' ' + radiusClass
          + ' bg-neutral-900/20 cursor-not-allowed'
          + (isBeat && !mini
            ? ' border-l-2 border-neutral-800/30'
            : '')
        }
      />
    );
    if (mini) {
      return (
        <div className="flex items-center justify-center">
          {disabledEl}
        </div>
      );
    }
    return disabledEl;
  }

  let color: string;
  if (isActive) {
    if (isCurrent && !mini) {
      color = 'bg-orange-400 motion-safe:scale-105'
        + ' shadow-[0_0_20px_rgba(251,146,60,0.8)]'
        + ' z-10';
    } else if (isCurrent && mini) {
      color = 'bg-orange-400';
    } else {
      color = 'bg-orange-600';
    }
  } else {
    if (isCurrent) {
      color = 'bg-neutral-700';
    } else {
      color = 'bg-neutral-800/40 hover:bg-neutral-800';
    }
  }

  const longPressHandlers = longPress();

  const btn = (
    <Tooltip tooltipKey="step" position="bottom">
      <button
        ref={buttonRef}
        data-step={stepIndex}
        {...longPressHandlers}
        onPointerUp={(e) => {
          if ('onPointerUp' in longPressHandlers) {
            (longPressHandlers as {
              onPointerUp: React.PointerEventHandler;
            }).onPointerUp(e);
          }
          handlePointerUp();
        }}
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
        style={{
          touchAction: 'manipulation',
          ...(
            isActive && gainLock !== undefined
              ? { opacity: Math.max(0.2, gainLock) }
              : {}
          ),
        }}
        className={
          'relative overflow-hidden'
          + ' ' + sizeClass + ' ' + radiusClass
          + ' transition-colors duration-100'
          + ' motion-safe:transition-transform'
          + ' focus-visible:outline-none'
          + ' focus-visible:ring-2'
          + ' focus-visible:ring-orange-500 '
          + color
          + (isBeat && !mini
            ? ' border-l-2 border-neutral-700'
            : '')
        }
      >
        {!mini && isActive
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
        {!mini && isActive && conditions?.fill
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
        {!mini && isActive && conditions?.cycle != null
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
    </Tooltip>
  );

  if (mini) {
    return (
      <div className="flex items-center justify-center">
        {btn}
      </div>
    );
  }
  return btn;
}

const StepButton = memo(StepButtonInner);
export default StepButton;
