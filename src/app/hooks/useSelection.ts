"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import {
  cellKey, parseCellKey,
} from '../types';
import type { TrackConfig, TrackId } from '../types';

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
}: UseSelectionOptions) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set()
  );
  const anchorRef = useRef<SelectionAnchor | null>(null);
  const dragOriginRef = useRef<SelectionAnchor | null>(null);

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

  // Keyboard listener for Escape and Delete/Backspace
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
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [clearSelection, deleteSelected, popoverOpenRef]);

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
