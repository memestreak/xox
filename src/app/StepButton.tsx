"use client";

import { memo, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { useLongPress } from 'use-long-press';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';
import { LONG_PRESS_MS, LONG_PRESS_CANCEL_PX } from './constants';
import { getStepColor, stepGroup } from './stepColors';
import {
  ProbabilityBar,
  PanIndicator,
  FillBadge,
  CycleBadge,
  RetrigBadge,
} from './StepBadges';
import {
  useMockVariant, useRetrigMode, nextRetrigCount,
  applyRetrigCount,
} from './mockVariant';
import Tooltip from './Tooltip';

interface StepButtonProps {
  trackId: TrackId;
  trackName: string;
  stepIndex: number;
  isActive: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
  isSelected?: boolean;
  mini?: boolean;
  onToggle: (
    trackId: TrackId, stepIndex: number
  ) => void;
  locks?: StepLocks;
  conditions?: StepConditions;
  onOpenPopover?: (
    trackId: TrackId,
    stepIndex: number,
    rect: { top: number; left: number }
  ) => void;
  onCtrlClick?: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onShiftClick?: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onPlainClick?: () => boolean;
  onClearSelection?: () => void;
  longPressActiveRef?: RefObject<boolean>;
}

/**
 * Individual step toggle button. Memoized so it only
 * re-renders when its active/current state changes.
 */
function StepButtonInner({
  trackId,
  trackName,
  stepIndex,
  isActive,
  isCurrent,
  isDisabled,
  isSelected,
  mini,
  onToggle,
  locks,
  conditions,
  onOpenPopover,
  onCtrlClick,
  onShiftClick,
  onPlainClick,
  onClearSelection,
  longPressActiveRef,
}: StepButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gainLock = locks?.gain;
  const panLock = locks?.pan;
  const mock = useMockVariant();
  const retrigMode = useRetrigMode() && mock === 'C';
  const retrigCount = locks?.retrig?.count ?? 1;

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
      threshold: LONG_PRESS_MS,
      cancelOnMovement: LONG_PRESS_CANCEL_PX,
    }
  );

  const handlePointerUp = useCallback(() => {
    if (longPressActiveRef) {
      longPressActiveRef.current = false;
    }
  }, [longPressActiveRef]);

  const sizeClass = mini
    ? 'w-4 h-4 lg:w-5 lg:h-5' : 'h-12 lg:h-[52px]';
  const radiusClass = mini
    ? 'rounded-full' : 'rounded-[5px]';

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
          + ' bg-well/60 cursor-not-allowed'
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

  const color = getStepColor(
    isActive, isCurrent, mini, stepGroup(stepIndex)
  );
  const showBadges = !mini && isActive;

  const longPressHandlers = longPress();

  const btn = (
    <Tooltip tooltipKey="step" position="bottom">
      <button
        ref={buttonRef}
        data-step={stepIndex}
        data-retrig={retrigCount > 1 ? retrigCount : undefined}
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
          if (e.shiftKey && onShiftClick) {
            e.preventDefault();
            onShiftClick(trackId, stepIndex);
            return;
          }
          if (
            (e.ctrlKey || e.metaKey) && onCtrlClick
          ) {
            e.preventDefault();
            onCtrlClick(trackId, stepIndex);
            return;
          }
          if (retrigMode && isActive) {
            // MOCK C: a tap cycles the retrig count.
            applyRetrigCount(
              trackId, stepIndex, nextRetrigCount(retrigCount)
            );
            return;
          }
          if (isSelected) {
            onPlainClick?.();
            return;
          }
          onClearSelection?.();
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
          + ' transition-[background-color,filter]'
          + ' duration-100'
          + ' focus:outline-none'
          + ' focus-visible:outline-2'
          + ' focus-visible:outline-offset-2'
          + ' focus-visible:outline-accent '
          + color
          + (mini
            ? ''
            // Indicator LED notch at the top of the key
            : ' after:absolute after:left-1/2'
              + ' after:top-[5px] after:w-1.5'
              + ' after:h-[3px] after:-translate-x-1/2'
              + ' after:rounded-sm')
          + (isSelected
            ? ' ring-2 ring-blue-400/70' : '')
        }
      >
        {showBadges
          && conditions?.probability !== undefined
          && <ProbabilityBar
            probability={conditions.probability}
          />}
        {showBadges
          && panLock !== undefined
          && <PanIndicator panLock={panLock} />}
        {showBadges
          && conditions?.fill
          && <FillBadge fill={conditions.fill} />}
        {showBadges
          && !retrigMode
          && conditions?.cycle != null
          && conditions.cycle.b >= 2
          && <CycleBadge
            a={conditions.cycle.a}
            b={conditions.cycle.b}
          />}
        {showBadges && mock && (
          <RetrigBadge
            count={retrigCount}
            variant={mock}
            editing={retrigMode}
          />
        )}
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
