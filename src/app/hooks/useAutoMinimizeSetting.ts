"use client";

import { useSyncExternalStore } from 'react';

/** localStorage key for the auto-minimize setting. */
export const AUTO_MINIMIZE_STORAGE_KEY = 'xox-auto-minimize';

// Last value set this session, used when localStorage
// is unavailable (some private modes).
let sessionValue = false;
const listeners = new Set<() => void>();

function load(): boolean | null {
  try {
    const raw = window.localStorage.getItem(
      AUTO_MINIMIZE_STORAGE_KEY
    );
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
}

function getSnapshot(): boolean {
  return load() ?? sessionValue;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Turn auto-minimize on or off and remember it. */
export function setAutoMinimize(value: boolean) {
  sessionValue = value;
  try {
    window.localStorage.setItem(
      AUTO_MINIMIZE_STORAGE_KEY, String(value)
    );
  } catch {
    // localStorage unavailable
  }
  listeners.forEach(listener => listener());
}

/** Test helper: forget the in-memory value. */
export function resetAutoMinimizeForTests() {
  sessionValue = false;
}

/**
 * "Auto-minimize empty tracks" (off by default). A view
 * preference for this device, like the master volume:
 * its own localStorage entry, not in SequencerConfig, so
 * share links and Reset leave it alone.
 */
export function useAutoMinimizeSetting(): boolean {
  // The server snapshot keeps the static HTML and the
  // first client render in agreement; the saved value
  // takes over right after hydration.
  return useSyncExternalStore(
    subscribe, getSnapshot, getServerSnapshot
  );
}
