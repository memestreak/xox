"use client";

import {
  useState, useRef, useEffect, useCallback, useMemo,
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
import RetrigEditor from './RetrigEditor';
import {
  clampToWindow,
  getEditorPosition,
  setEditorPosition,
  type EditorPosition,
} from './stepEditorPosition';
import type { Retrig } from './retrig';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';

const POPOVER_WIDTH = 288;

const RESET_BUTTON =
  'ss-key h-6 px-2 text-xs text-muted hover:text-ink'
  + ' disabled:opacity-40 disabled:cursor-default'
  + ' disabled:hover:text-muted';

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
  /** When set, edits apply to all targets. */
  bulkTargets?: Array<{
    trackId: TrackId; stepIndex: number;
  }>;
  /** Auto-focus this section on mount. */
  focusSection?: 'probability' | 'cycle';
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
  bulkTargets,
  focusSection,
}: StepPopoverProps) {
  const { actions } = useSequencer();
  const popoverRef = useRef<HTMLDivElement>(null);
  const probRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<HTMLDivElement>(null);

  const targets = useMemo(
    () => bulkTargets ?? [{ trackId, stepIndex }],
    [bulkTargets, trackId, stepIndex]
  );
  const isBulk = bulkTargets
    && bulkTargets.length > 1;

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
      const empty = Object.keys(sc).length === 0;
      for (const t of targets) {
        if (empty) {
          actions.clearTrigCondition(
            t.trackId, t.stepIndex
          );
        } else {
          actions.setTrigCondition(
            t.trackId, t.stepIndex, sc
          );
        }
      }
    },
    [actions, targets]
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
      for (const t of targets) {
        actions.setParameterLock(
          t.trackId, t.stepIndex, { gain: v / 100 }
        );
      }
    },
    [actions, targets]
  );

  const handlePanChange = useCallback(
    (v: number) => {
      setPanValue(v);
      panTouched.current = true;
      for (const t of targets) {
        actions.setParameterLock(
          t.trackId, t.stepIndex, { pan: v / 100 }
        );
      }
    },
    [actions, targets]
  );

  const handleRetrigChange = useCallback(
    (retrig: Retrig) => {
      for (const t of targets) {
        actions.setParameterLock(
          t.trackId, t.stepIndex, { retrig }
        );
      }
    },
    [actions, targets]
  );

  // ─── Focus management ──────────────────────────
  const triggerRef = useRef<Element | null>(null);

  // Capture triggering element and auto-focus
  // focusSection target or first focusable control
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const sectionRef =
      focusSection === 'probability' ? probRef
        : focusSection === 'cycle' ? cycleRef
          : null;
    if (sectionRef?.current) {
      const input =
        sectionRef.current.querySelector<HTMLElement>(
          'input, select, button'
        );
      input?.focus();
      return;
    }
    const el = popoverRef.current;
    if (!el) return;
    // The move grip is skipped: it's not a first stop
    const first = el.querySelector<HTMLElement>(
      'button:not([data-grip]), input, select, [tabindex]'
    );
    first?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Moving (drag the header) ─────────────────
  // Once moved, the editor floats where it was put (and
  // later editors open there) until the header is
  // double-clicked.
  const [floatPos, setFloatPos] = useState<
    EditorPosition | null
  >(getEditorPosition);
  const floating = floatPos !== null;
  const dragRef = useRef<{ dx: number; dy: number } | null>(
    null
  );

  const moveTo = useCallback((pos: EditorPosition) => {
    const el = popoverRef.current;
    const next = clampToWindow(
      pos,
      el?.offsetWidth ?? POPOVER_WIDTH,
      el?.offsetHeight ?? 0,
    );
    setFloatPos(next);
    setEditorPosition(next);
  }, []);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    // The Reset key keeps its click
    if ((e.target as Element).closest('button:not([data-grip])')) {
      return;
    }
    const rect = popoverRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: e.clientX - rect.left, dy: e.clientY - rect.top,
    };
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    moveTo({ left: e.clientX - d.dx, top: e.clientY - d.dy });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const backToStep = () => {
    setFloatPos(null);
    setEditorPosition(null);
  };

  const onGripKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const d = delta[e.key];
    const from = floatPos
      ?? popoverRef.current?.getBoundingClientRect();
    if (!d || !from) return;
    e.preventDefault();
    moveTo({ left: from.left + d[0], top: from.top + d[1] });
  };

  useEffect(() => {
    // A floating editor isn't tied to its step, so a
    // scroll leaves it open.
    if (
      floating || !anchorRect || !scrollContainerRef?.current
    ) {
      return;
    }
    // Close when the grid scrolls: the track area on
    // desktop, the whole page on phones.
    const el = scrollContainerRef.current;
    el.addEventListener('scroll', onClose, {
      once: true,
    });
    window.addEventListener('scroll', onClose, {
      once: true,
    });
    return () => {
      el.removeEventListener('scroll', onClose);
      window.removeEventListener('scroll', onClose);
    };
  }, [anchorRect, floating, onClose, scrollContainerRef]);

  // ─── Flip above if overflowing ────────────────
  const [flippedTop, setFlippedTop] = useState<
    number | null
  >(null);
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    // A remembered spot may not fit this window or this
    // editor's height any more.
    const saved = getEditorPosition();
    if (saved) {
      moveTo(saved);
      return;
    }
    if (!anchorRect) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      const above =
        anchorRect.top - 4 - 4 - rect.height;
      setFlippedTop(Math.max(8, above));
    }
  }, [anchorRect, moveTo]);

  // ─── Render ───────────────────────────────────
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Step editor"
      className="ss-menu fixed z-30 w-72 p-3.5 space-y-3.5"
      style={floatPos ? {
        top: `${floatPos.top}px`,
        left: `${floatPos.left}px`,
      } : anchorRect ? {
        top: `${flippedTop ?? anchorRect.top}px`,
        // Keep the popover on screen near the right edge.
        left: `${Math.max(
          8,
          Math.min(
            anchorRect.left,
            window.innerWidth - POPOVER_WIDTH - 8
          )
        )}px`,
      } : undefined}
    >
      {/* Header: drag it to move the editor */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={
          'flex items-center justify-between gap-2'
          + ' cursor-move select-none'
        }
        style={{ touchAction: 'none' }}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onLostPointerCapture={endDrag}
        onDoubleClick={e => {
          if (
            !(e.target as Element)
              .closest('button:not([data-grip])')
          ) {
            backToStep();
          }
        }}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <button
            type="button"
            data-grip
            aria-label={
              'Move step editor (arrow keys).'
              + ' Double-click to put it back by the step'
            }
            onKeyDown={onGripKeyDown}
            className={
              'self-center -ml-1 px-0.5 text-sm leading-none'
              + ' cursor-move'
              + (floating ? ' text-accent' : ' text-faint')
            }
          >
            <span aria-hidden="true">⠿</span>
          </button>
          {isBulk ? (
            <span className="ss-label text-ink">
              {`${bulkTargets!.length} cells selected`}
            </span>
          ) : (
            <>
              <span className="ss-cap text-lg leading-none text-ink">
                {trackId.toUpperCase()}
              </span>
              <span className="ss-label">
                Step {stepIndex + 1}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => {
            for (const t of targets) {
              actions.clearTrigCondition(
                t.trackId, t.stepIndex
              );
            }
            onClose();
          }}
          disabled={!isBulk && conditions === undefined}
          className={RESET_BUTTON}
        >
          Reset trig cond.
        </button>
      </div>

      <div ref={probRef}>
        <ProbabilityEditor
          value={probability}
          onChange={handleProbChange}
        />
      </div>
      <div ref={cycleRef}>
        <CycleEditor
          value={cycleValue}
          onChange={handleCycleChange}
        />
      </div>
      <FillConditionEditor
        value={fillValue}
        onChange={handleFillChange}
      />

      {/* Divider */}
      <div className="border-t border-line" />

      {/* Locks header */}
      <div className={
        'flex items-center justify-between'
      }>
        <div className="ss-label text-ink">
          Locks
        </div>
        <button
          onClick={() => {
            for (const t of targets) {
              actions.clearParameterLock(
                t.trackId, t.stepIndex
              );
            }
            setGainValue(100);
            gainTouched.current = false;
            setPanValue(50);
            panTouched.current = false;
          }}
          disabled={!isBulk && locks === undefined}
          className={RESET_BUTTON}
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

      <div className="border-t border-line" />
      <RetrigEditor
        value={locks?.retrig}
        onChange={handleRetrigChange}
      />
    </div>
  );
}
