"use client";

import {
  useState, useRef, useEffect, useCallback,
} from 'react';
import type { RefObject } from 'react';
import { useSequencer } from './SequencerContext';
import { CYCLE_OPTIONS } from './trigConditions';
import ProbabilityEditor from './ProbabilityEditor';
import CycleEditor from './CycleEditor';
import FillConditionEditor from './FillConditionEditor';
import {
  GainLockEditor,
  PanLockEditor,
} from './StepLockEditors';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';

interface StepPopoverProps {
  trackId: TrackId;
  stepIndex: number;
  conditions?: StepConditions;
  locks?: StepLocks;
  anchorRect?: { top: number; left: number };
  onClose: () => void;
  scrollContainerRef?: RefObject<
    HTMLDivElement | null
  >;
}

/**
 * Popover for editing per-step trig conditions and
 * parameter locks. Orchestrates sub-editors for
 * probability, cycle, fill, gain, and pan.
 */
export default function StepPopover({
  trackId,
  stepIndex,
  conditions,
  locks,
  anchorRect,
  onClose,
  scrollContainerRef,
}: StepPopoverProps) {
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
  const [fillValue, setFillValue] = useState<
    'none' | 'fill' | '!fill'
  >(conditions?.fill ?? 'none');

  const [gainValue, setGainValue] = useState(
    locks?.gain !== undefined
      ? Math.round(locks.gain * 100)
      : 100
  );
  const gainTouched = useRef(false);

  const [panValue, setPanValue] = useState(
    locks?.pan !== undefined
      ? Math.round(locks.pan * 100)
      : 50
  );
  const panTouched = useRef(false);

  // ─── Condition sync ───────────────────────────
  const updateConditions = useCallback(
    (
      prob: number,
      cycle: string,
      fill: 'none' | 'fill' | '!fill'
    ) => {
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
      if (fill !== 'none') {
        sc.fill = fill;
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
      updateConditions(v, cycleValue, fillValue);
    },
    [updateConditions, cycleValue, fillValue]
  );

  const handleCycleChange = useCallback(
    (v: string) => {
      setCycleValue(v);
      updateConditions(probability, v, fillValue);
    },
    [updateConditions, probability, fillValue]
  );

  const handleFillChange = useCallback(
    (v: 'none' | 'fill' | '!fill') => {
      setFillValue(v);
      updateConditions(probability, cycleValue, v);
    },
    [updateConditions, probability, cycleValue]
  );

  // ─── Lock handlers ────────────────────────────
  const handleGainChange = useCallback(
    (v: number) => {
      setGainValue(v);
      gainTouched.current = true;
      actions.setParameterLock(
        trackId, stepIndex, { gain: v / 100 }
      );
    },
    [actions, trackId, stepIndex]
  );

  const handlePanChange = useCallback(
    (v: number) => {
      setPanValue(v);
      panTouched.current = true;
      actions.setParameterLock(
        trackId, stepIndex, { pan: v / 100 }
      );
    },
    [actions, trackId, stepIndex]
  );

  // ─── Focus management ──────────────────────────
  const triggerRef = useRef<Element | null>(null);

  // Capture triggering element and auto-focus first
  // focusable control on mount
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const el = popoverRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(
      'button, input, select, [tabindex]'
    );
    first?.focus();
  }, []);

  // Restore focus to trigger on unmount
  useEffect(() => {
    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, []);

  // ─── Dismiss + focus trap ─────────────────────
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
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: cycle Tab within popover
      if (e.key === 'Tab') {
        const el = popoverRef.current;
        if (!el) return;
        const focusable = el.querySelectorAll<
          HTMLElement
        >(
          'button, input, select, [tabindex]'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
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

  // ─── Flip above if overflowing ────────────────
  const [flippedTop, setFlippedTop] = useState<
    number | null
  >(null);
  useEffect(() => {
    const el = popoverRef.current;
    if (!el || !anchorRect) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      const above =
        anchorRect.top - 4 - 4 - rect.height;
      setFlippedTop(Math.max(8, above));
    }
  }, [anchorRect]);

  // ─── Render ───────────────────────────────────
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Step editor"
      className={
        'fixed z-30'
        + ' w-56 bg-neutral-900 border'
        + ' border-neutral-700 rounded-lg'
        + ' shadow-xl p-3 space-y-3'
      }
      style={anchorRect ? {
        top: `${flippedTop ?? anchorRect.top}px`,
        left: `${anchorRect.left}px`,
      } : undefined}
    >
      {/* Header */}
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

      <ProbabilityEditor
        value={probability}
        onChange={handleProbChange}
      />
      <CycleEditor
        value={cycleValue}
        onChange={handleCycleChange}
      />
      <FillConditionEditor
        value={fillValue}
        onChange={handleFillChange}
      />

      {/* Divider */}
      <div className="border-t border-neutral-700" />

      {/* Locks header */}
      <div className={
        'flex items-center justify-between'
      }>
        <div className={
          'text-xs font-bold uppercase'
          + ' tracking-wider text-neutral-400'
        }>
          Locks
        </div>
        <button
          onClick={() => {
            actions.clearParameterLock(
              trackId, stepIndex
            );
            setGainValue(100);
            gainTouched.current = false;
            setPanValue(50);
            panTouched.current = false;
          }}
          disabled={locks === undefined}
          className={
            'text-[11px] px-1.5 py-0.5 rounded'
            + ' border transition-colors'
            + (locks !== undefined
              ? ' text-neutral-400'
                + ' hover:text-neutral-200'
                + ' border-neutral-700'
                + ' hover:bg-neutral-800'
              : ' text-neutral-700'
                + ' border-neutral-800'
                + ' cursor-default')
          }
        >
          Reset locks
        </button>
      </div>

      <GainLockEditor
        value={gainValue}
        onChange={handleGainChange}
      />
      <PanLockEditor
        value={panValue}
        onChange={handlePanChange}
      />
    </div>
  );
}
