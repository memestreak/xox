"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import {
  cellKey, parseCellKey,
} from '../types';
import type {
  StepConditions, TrackConfig, TrackId,
} from '../types';

interface SelectionAnchor {
  trackId: TrackId;
  step: number;
}

interface UseSelectionOptions {
  /** Ordered list of selectable track IDs (no accent). */
  trackOrder: TrackId[];
  /** Current track configs (for track length checks). */
  tracks: Record<TrackId, TrackConfig>;
  /** Ref indicating whether a popover is open. */
  popoverOpenRef: RefObject<boolean>;
  /** Set a single step value. */
  setStep: (
    trackId: TrackId, stepIndex: number,
    value: '0' | '1'
  ) => void;
  /** Clear trig conditions for a step. */
  clearTrigCondition: (
    trackId: TrackId, stepIndex: number
  ) => void;
  /** Clear parameter locks for a step. */
  clearParameterLock: (
    trackId: TrackId, stepIndex: number
  ) => void;
  /** Toggle a single step (flip 0↔1). */
  toggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  /** Set trig conditions for a step. */
  setTrigCondition: (
    trackId: TrackId, stepIndex: number,
    conditions: StepConditions
  ) => void;
  /** Open popover in bulk mode for selected cells. */
  openBulkPopover: (
    focusSection?: 'probability' | 'cycle'
  ) => void;
}

/**
 * Compute all cells in the bounding rectangle between two
 * anchor points, skipping disabled steps (beyond track
 * length).
 */
function computeRect(
  a: SelectionAnchor,
  b: SelectionAnchor,
  trackOrder: TrackId[],
  tracks: Record<TrackId, TrackConfig>,
): Set<string> {
  const result = new Set<string>();

  const idxA = trackOrder.indexOf(a.trackId);
  const idxB = trackOrder.indexOf(b.trackId);
  if (idxA === -1 || idxB === -1) return result;

  const minTrack = Math.min(idxA, idxB);
  const maxTrack = Math.max(idxA, idxB);
  const minStep = Math.min(a.step, b.step);
  const maxStep = Math.max(a.step, b.step);

  for (let t = minTrack; t <= maxTrack; t++) {
    const tid = trackOrder[t];
    const len = tracks[tid].steps.length;
    for (let s = minStep; s <= maxStep; s++) {
      if (s < len) {
        result.add(cellKey(tid, s));
      }
    }
  }
  return result;
}

export function useSelection({
  trackOrder,
  tracks,
  popoverOpenRef,
  setStep,
  clearTrigCondition,
  clearParameterLock,
  toggleStep,
  setTrigCondition,
  openBulkPopover,
}: UseSelectionOptions) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set()
  );
  const anchorRef = useRef<SelectionAnchor | null>(null);
  const dragOriginRef = useRef<SelectionAnchor | null>(null);
  // Uniform fill cycle: 0=none, 1=fill, 2=!fill
  const fillCycleRef = useRef(0);

  // Stable refs for keyboard handler and callbacks
  const tracksRef = useRef(tracks);
  const trackOrderRef = useRef(trackOrder);
  const selectedRef = useRef(selected);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    trackOrderRef.current = trackOrder;
  }, [trackOrder]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
    dragOriginRef.current = null;
    fillCycleRef.current = 0;
  }, []);

  const ctrlClickCell = useCallback(
    (trackId: TrackId, step: number) => {
      setSelected(prev => {
        const key = cellKey(trackId, step);
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      anchorRef.current = { trackId, step };
      fillCycleRef.current = 0;
    },
    []
  );

  const shiftClickCell = useCallback(
    (trackId: TrackId, step: number) => {
      const anchor = anchorRef.current;
      if (!anchor) {
        // No anchor yet — treat as single select
        setSelected(
          new Set([cellKey(trackId, step)])
        );
        anchorRef.current = { trackId, step };
        return;
      }
      const rect = computeRect(
        anchor,
        { trackId, step },
        trackOrderRef.current,
        tracksRef.current,
      );
      setSelected(rect);
      fillCycleRef.current = 0;
    },
    []
  );

  const startRectDrag = useCallback(
    (trackId: TrackId, step: number) => {
      dragOriginRef.current = { trackId, step };
      anchorRef.current = { trackId, step };
      setSelected(
        new Set([cellKey(trackId, step)])
      );
      fillCycleRef.current = 0;
    },
    []
  );

  const updateRectDrag = useCallback(
    (trackId: TrackId, step: number) => {
      // If no origin yet (drag started from empty
      // space), set it now
      if (!dragOriginRef.current) {
        dragOriginRef.current = { trackId, step };
        anchorRef.current = { trackId, step };
      }
      const rect = computeRect(
        dragOriginRef.current,
        { trackId, step },
        trackOrderRef.current,
        tracksRef.current,
      );
      setSelected(rect);
      fillCycleRef.current = 0;
    },
    []
  );

  const deleteSelected = useCallback(() => {
    const cur = selectedRef.current;
    if (cur.size === 0) return;

    for (const key of cur) {
      const { trackId: tid, step } = parseCellKey(key);
      setStep(tid, step, '0');
      clearTrigCondition(tid, step);
      clearParameterLock(tid, step);
    }

    setSelected(new Set());
    anchorRef.current = null;
    dragOriginRef.current = null;
  }, [setStep, clearTrigCondition, clearParameterLock]);

  const toggleSelected = useCallback(() => {
    const cur = selectedRef.current;
    if (cur.size === 0) return false;

    for (const key of cur) {
      const { trackId: tid, step } = parseCellKey(key);
      toggleStep(tid, step);
    }

    return true;
  }, [toggleStep]);

  /** Apply a fill value to all selected cells,
   *  merging with existing conditions. */
  const applyFillToSelected = useCallback(
    (fill: 'fill' | '!fill' | undefined) => {
      const cur = selectedRef.current;
      for (const key of cur) {
        const { trackId: tid, step } =
          parseCellKey(key);
        const existing =
          tracksRef.current[tid]
            .trigConditions?.[step];
        if (fill === undefined) {
          // Remove fill from conditions
          if (!existing) continue;
          const rest: StepConditions = {};
          if (existing.probability !== undefined) {
            rest.probability = existing.probability;
          }
          if (existing.cycle !== undefined) {
            rest.cycle = existing.cycle;
          }
          if (Object.keys(rest).length === 0) {
            clearTrigCondition(tid, step);
          } else {
            setTrigCondition(tid, step, rest);
          }
        } else {
          setTrigCondition(tid, step, {
            ...existing, fill,
          });
        }
      }
    },
    [clearTrigCondition, setTrigCondition]
  );

  // Keyboard shortcuts for selection
  // Registered in capture phase so F key can be
  // intercepted before SequencerContext's fill handler.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Layered dismissal: popover closes first
        if (popoverOpenRef.current) return;
        if (selectedRef.current.size === 0) return;
        clearSelection();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRef.current.size === 0) return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT'
        ) return;
        e.preventDefault();
        deleteSelected();
        (document.activeElement as HTMLElement)
          ?.blur();
        return;
      }

      // All remaining shortcuts require selection
      if (selectedRef.current.size === 0) return;
      if (popoverOpenRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) return;

      // F: uniform fill cycle (none -> fill -> !fill)
      if (
        e.code === 'KeyF'
        && !e.ctrlKey && !e.metaKey
        && !e.shiftKey && !e.repeat
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        fillCycleRef.current =
          (fillCycleRef.current + 1) % 3;
        const fills: Array<'fill' | '!fill' | undefined> =
          [undefined, 'fill', '!fill'];
        applyFillToSelected(
          fills[fillCycleRef.current]
        );
        return;
      }

      // Shift+F: directly set !fill
      if (
        e.code === 'KeyF'
        && e.shiftKey
        && !e.ctrlKey && !e.metaKey
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        fillCycleRef.current = 2;
        applyFillToSelected('!fill');
        return;
      }

      // R: clear all trig conditions + parameter locks
      if (
        e.code === 'KeyR'
        && !e.ctrlKey && !e.metaKey
        && !e.shiftKey && !e.repeat
      ) {
        e.preventDefault();
        for (const key of selectedRef.current) {
          const { trackId: tid, step } =
            parseCellKey(key);
          clearTrigCondition(tid, step);
          clearParameterLock(tid, step);
        }
        return;
      }

      // P: open bulk popover on probability
      if (
        e.code === 'KeyP'
        && !e.ctrlKey && !e.metaKey
        && !e.shiftKey && !e.repeat
      ) {
        e.preventDefault();
        openBulkPopover('probability');
        return;
      }

      // C: open bulk popover on cycle
      if (
        e.code === 'KeyC'
        && !e.ctrlKey && !e.metaKey
        && !e.shiftKey && !e.repeat
      ) {
        e.preventDefault();
        openBulkPopover('cycle');
        return;
      }
    };
    document.addEventListener(
      'keydown', handler, true
    );
    return () => {
      document.removeEventListener(
        'keydown', handler, true
      );
    };
  }, [
    clearSelection, deleteSelected, popoverOpenRef,
    applyFillToSelected, clearTrigCondition,
    clearParameterLock, openBulkPopover,
  ]);

  // Pre-compute per-track selected step sets
  const selectedByTrack = useMemo(() => {
    const map = new Map<TrackId, Set<number>>();
    for (const key of selected) {
      const { trackId: tid, step } = parseCellKey(key);
      if (!map.has(tid)) map.set(tid, new Set());
      map.get(tid)!.add(step);
    }
    return map;
  }, [selected]);

  return {
    selected,
    selectedByTrack,
    ctrlClickCell,
    shiftClickCell,
    startRectDrag,
    updateRectDrag,
    clearSelection,
    deleteSelected,
    toggleSelected,
  };
}
