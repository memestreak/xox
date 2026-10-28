"use client";

import { useSyncExternalStore } from 'react';

/**
 * An on/off preference for this device, kept in its own
 * localStorage entry: not in SequencerConfig, so share
 * links and Reset leave it alone.
 */
export interface DeviceSetting {
  /** React hook: the current value, re-rendered on change. */
  useValue: () => boolean;
  /** The current value, for code outside React. */
  get: () => boolean;
  /** Change the value and remember it. */
  set: (value: boolean) => void;
  /** Test helper: forget the in-memory value. */
  resetForTests: () => void;
}

export function createDeviceSetting(
  storageKey: string,
  defaultValue: boolean,
): DeviceSetting {
  // Last value set this session, used when localStorage
  // is unavailable (some private modes).
  let sessionValue = defaultValue;
  const listeners = new Set<() => void>();

  function load(): boolean | null {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return null;
      return raw === 'true';
    } catch {
      return null;
    }
  }

  const get = () => load() ?? sessionValue;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const set = (value: boolean) => {
    sessionValue = value;
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      // localStorage unavailable
    }
    listeners.forEach(listener => listener());
  };

  // The server snapshot keeps the static HTML and the
  // first client render in agreement; the saved value
  // takes over right after hydration.
  const useValue = () =>
    useSyncExternalStore(subscribe, get, () => defaultValue);

  return {
    useValue,
    get,
    set,
    resetForTests: () => {
      sessionValue = defaultValue;
    },
  };
}
