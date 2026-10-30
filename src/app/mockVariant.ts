import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * MOCK ONLY: reads `?mock=A|B|C` from the URL so one
 * build can show design variants side by side. Not for
 * main. Read after mount so hydration matches.
 */
export function useMockVariant(): string | null {
  const [mock, setMock] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMock(
      new URLSearchParams(window.location.search).get('mock'),
    );
  }, []);
  return mock;
}

// MOCK ONLY (variant C): the grid's Retrig edit mode.
let retrigMode = false;
const listeners = new Set<() => void>();

export function setRetrigMode(on: boolean) {
  retrigMode = on;
  listeners.forEach(l => l());
}

export function useRetrigMode(): boolean {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => retrigMode,
    () => false,
  );
}

/** Counts a retrig cycles through in variant C. */
export const RETRIG_COUNTS = [1, 2, 3, 4, 6, 8];

export function nextRetrigCount(count: number): number {
  const i = RETRIG_COUNTS.indexOf(count);
  return RETRIG_COUNTS[(i + 1) % RETRIG_COUNTS.length];
}

// MOCK ONLY (variant C): StepGrid registers how a tap
// in Retrig mode sets a step's count.
type RetrigSetter = (
  trackId: import('./types').TrackId,
  stepIndex: number,
  count: number,
) => void;
let retrigSetter: RetrigSetter | null = null;

export function registerRetrigSetter(fn: RetrigSetter | null) {
  retrigSetter = fn;
}

export function applyRetrigCount(
  trackId: import('./types').TrackId,
  stepIndex: number,
  count: number,
) {
  retrigSetter?.(trackId, stepIndex, count);
}
