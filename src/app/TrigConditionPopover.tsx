"use client";

import {
  useState, useRef, useEffect, useCallback,
} from 'react';
import type { RefObject } from 'react';
import { useSequencer } from './SequencerContext';
import { CYCLE_OPTIONS } from './trigConditions';
import ProbabilitySlider from './ProbabilitySlider';
import type { StepConditions, TrackId } from './types';

interface TrigConditionPopoverProps {
  trackId: TrackId;
  stepIndex: number;
  conditions?: StepConditions;
  anchorRect?: { top: number; left: number };
  onClose: () => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Popover for editing per-step trig conditions.
 * Shows probability slider and cycle dropdown.
 *
 * Args:
 *   trackId: Track this condition belongs to
 *   stepIndex: Step index (0-based)
 *   conditions: Current conditions
 *   anchorRect: Position anchor
 *   onClose: Called when popover should close
 */
export default function TrigConditionPopover({
  trackId,
  stepIndex,
  conditions,
  anchorRect,
  onClose,
  scrollContainerRef,
}: TrigConditionPopoverProps) {
  const { actions } = useSequencer();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [probability, setProbability] = useState(
    conditions?.probability ?? 100
  );
  const [cycleValue, setCycleValue] = useState(
    conditions?.cycle
      ? `${conditions.cycle.a}:${conditions.cycle.b}`
      : '1:1'
  );

  const updateConditions = useCallback(
    (prob: number, cycle: string) => {
      const sc: StepConditions = {};
      if (prob < 100) {
        sc.probability = prob;
      }
      const option = CYCLE_OPTIONS.find(
        o => o.label === cycle
      );
      if (option && option.b >= 2) {
        sc.cycle = { a: option.a, b: option.b };
      }
      if (Object.keys(sc).length === 0) {
        actions.clearTrigCondition(
          trackId, stepIndex
        );
      } else {
        actions.setTrigCondition(
          trackId, stepIndex, sc
        );
      }
    },
    [actions, trackId, stepIndex]
  );

  const handleProbChange = useCallback(
    (v: number) => {
      setProbability(v);
      updateConditions(v, cycleValue);
    },
    [updateConditions, cycleValue]
  );

  const handleCycleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      setCycleValue(v);
      updateConditions(probability, v);
    },
    [updateConditions, probability]
  );

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current
        && !popoverRef.current.contains(
          e.target as Node
        )
      ) {
        onClose();
      }
    };
    let active = true;
    setTimeout(() => {
      if (active) {
        document.addEventListener(
          'mousedown', handleMouseDown
        );
      }
    }, 0);
    return () => {
      active = false;
      document.removeEventListener(
        'mousedown', handleMouseDown
      );
    };
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener(
      'keydown', handleKeyDown
    );
    return () =>
      document.removeEventListener(
        'keydown', handleKeyDown
      );
  }, [onClose]);

  useEffect(() => {
    if (!anchorRect || !scrollContainerRef?.current) {
      return;
    }
    const el = scrollContainerRef.current;
    el.addEventListener('scroll', onClose, {
      once: true,
    });
    return () => el.removeEventListener(
      'scroll', onClose
    );
  }, [anchorRect, onClose, scrollContainerRef]);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Trig conditions"
      className={
        'fixed z-30'
        + ' w-56 bg-neutral-900 border'
        + ' border-neutral-700 rounded-lg'
        + ' shadow-xl p-3 space-y-3'
      }
      style={anchorRect ? {
        top: `${anchorRect.top}px`,
        left: `${anchorRect.left}px`,
      } : undefined}
    >
      <div className={
        'flex items-center justify-between'
      }>
        <div className={
          'text-xs font-bold uppercase'
          + ' tracking-wider text-neutral-400'
        }>
          Step {stepIndex + 1}{' '}
          <span className="text-neutral-500">
            {'\u00B7'} {trackId.toUpperCase()}
          </span>
        </div>
        <button
          onClick={() => {
            actions.clearTrigCondition(
              trackId, stepIndex
            );
            onClose();
          }}
          disabled={conditions === undefined}
          className={
            'text-[11px] px-1.5 py-0.5 rounded'
            + ' border transition-colors'
            + (conditions !== undefined
              ? ' text-neutral-400'
                + ' hover:text-neutral-200'
                + ' border-neutral-700'
                + ' hover:bg-neutral-800'
              : ' text-neutral-700'
                + ' border-neutral-800'
                + ' cursor-default')
          }
        >
          Reset trig cond.
        </button>
      </div>

      <div className="space-y-1">
        <div className={
          'text-[10px] uppercase tracking-wider'
          + ' text-neutral-500'
        }>
          Probability
        </div>
        <ProbabilitySlider
          value={probability}
          onChange={handleProbChange}
        />
      </div>

      <div className="space-y-1">
        <div className={
          'text-[10px] uppercase tracking-wider'
          + ' text-neutral-500'
        }>
          Cycle
        </div>
        <select
          value={cycleValue}
          onChange={handleCycleChange}
          className={
            'w-full bg-neutral-800'
            + ' text-neutral-200'
            + ' text-sm rounded px-2 py-1.5'
            + ' border border-neutral-700'
            + ' focus-visible:outline-none'
            + ' focus-visible:ring-2'
            + ' focus-visible:ring-orange-500'
          }
        >
          {CYCLE_OPTIONS.map(opt => (
            <option key={opt.label} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

    </div>
  );
}
