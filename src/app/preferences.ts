"use client";

import { useSyncExternalStore } from 'react';
import { MASTER_VOLUME_DEFAULT } from './constants';

/*
 * Preferences: per-viewer, per-device settings. They are
 * never part of the work (SequencerConfig), so share
 * links and Reset leave them alone.
 *
 * Each Settings section is saved under one localStorage
 * key, `xox.<page>.<section>`, as a JSON object. Every
 * section has a parser that checks each field, so a
 * missing or invalid field takes its default and a
 * stored value can never break the page. The work is
 * saved apart, under `xox.sequencer.works.*`
 * (configStorage.ts), so a prefix search for
 * preferences never catches it.
 */

/** Read and parse a section; defaults if it can't be read. */
export function readSection<T>(
  key: string,
  parse: (raw: unknown) => T,
): T {
  try {
    const text = window.localStorage.getItem(key);
    if (text !== null) return parse(JSON.parse(text));
  } catch {
    // localStorage unavailable, or not JSON
  }
  return parse(undefined);
}

let saveFailureReported = false;

/**
 * Save a section. A failed save (private mode, blocked
 * storage, full quota) is reported once, quietly, in the
 * console; the page keeps the value for this visit.
 */
export function writeSection(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (!saveFailureReported) {
      saveFailureReported = true;
      console.warn('Settings could not be saved:', err);
    }
  }
}

/** One Settings section held in memory and in localStorage. */
export interface PreferenceSection<T> {
  readonly key: string;
  readonly defaults: T;
  readonly parse: (raw: unknown) => T;
  /** The saved value, for code outside React. */
  get: () => T;
  /** Replace the whole section and save it. */
  set: (value: T) => void;
  /** Change some fields and save the section. */
  update: (partial: Partial<T>) => void;
  /** React hook: the saved value, re-rendered on change. */
  useValue: () => T;
  /** Test helper: forget the in-memory copy. */
  resetForTests: () => void;
}

export function createPreferenceSection<T extends object>(
  key: string,
  defaults: T,
  parse: (raw: unknown) => T,
): PreferenceSection<T> {
  // Loaded on first use, then kept here: useSyncExternalStore
  // needs the same object back until the value changes.
  // Other tabs aren't listened to; they catch up on reload.
  let current: T | null = null;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (current === null) current = readSection(key, parse);
    return current;
  };

  const set = (value: T) => {
    current = value;
    writeSection(key, value);
    listeners.forEach(listener => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    key,
    defaults,
    parse,
    get,
    set,
    update: (partial) => set({ ...get(), ...partial }),
    // The server snapshot keeps the static HTML and the
    // first client render in agreement; the saved value
    // takes over right after hydration.
    useValue: () =>
      useSyncExternalStore(subscribe, get, () => defaults),
    resetForTests: () => {
      current = null;
    },
  };
}

/* ── Field parsers ───────────────────────────── */

function fieldsOf(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {};
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function unit(value: unknown, fallback: number): number {
  return typeof value === 'number'
    && Number.isFinite(value) && value >= 0 && value <= 1
    ? value : fallback;
}

/* ── Sections ────────────────────────────────── */

/** General › Interface (`xox.general.interface`). */
export interface InterfacePrefs {
  showTooltips: boolean;
}

export const INTERFACE_DEFAULTS: InterfacePrefs = {
  showTooltips: true,
};

export const interfacePrefs = createPreferenceSection(
  'xox.general.interface',
  INTERFACE_DEFAULTS,
  (raw): InterfacePrefs => {
    const f = fieldsOf(raw);
    return {
      showTooltips: bool(
        f.showTooltips, INTERFACE_DEFAULTS.showTooltips
      ),
    };
  },
);

/** Sequencer › Grid (`xox.sequencer.grid`). */
export interface GridPrefs {
  autoMinimize: boolean;
}

export const GRID_DEFAULTS: GridPrefs = {
  autoMinimize: false,
};

export const gridPrefs = createPreferenceSection(
  'xox.sequencer.grid',
  GRID_DEFAULTS,
  (raw): GridPrefs => {
    const f = fieldsOf(raw);
    return {
      autoMinimize: bool(
        f.autoMinimize, GRID_DEFAULTS.autoMinimize
      ),
    };
  },
);

/** Sequencer › Patterns (`xox.sequencer.patterns`). */
export interface PatternsPrefs {
  chooserClickAway: boolean;
}

export const PATTERNS_DEFAULTS: PatternsPrefs = {
  chooserClickAway: true,
};

export const patternsPrefs = createPreferenceSection(
  'xox.sequencer.patterns',
  PATTERNS_DEFAULTS,
  (raw): PatternsPrefs => {
    const f = fieldsOf(raw);
    return {
      chooserClickAway: bool(
        f.chooserClickAway, PATTERNS_DEFAULTS.chooserClickAway
      ),
    };
  },
);

/**
 * The master fader (`xox.sequencer.output`). Saved like
 * a section but not shown in Settings: the header fader
 * is its only control (app volume doesn't belong in a
 * settings dialog).
 */
export interface OutputPrefs {
  /** Master fader position, 0-1. */
  volume: number;
}

export const OUTPUT_DEFAULTS: OutputPrefs = {
  volume: MASTER_VOLUME_DEFAULT,
};

export const outputPrefs = createPreferenceSection(
  'xox.sequencer.output',
  OUTPUT_DEFAULTS,
  (raw): OutputPrefs => {
    const f = fieldsOf(raw);
    return { volume: unit(f.volume, OUTPUT_DEFAULTS.volume) };
  },
);

/**
 * Sequencer › MIDI is saved at this key by MidiEngine,
 * which owns the live MIDI config (see midiConfig.ts for
 * its parser).
 */
export const MIDI_PREFS_KEY = 'xox.sequencer.midi';

/** Test helper: forget every section's in-memory copy. */
export function resetPreferencesForTests() {
  interfacePrefs.resetForTests();
  gridPrefs.resetForTests();
  patternsPrefs.resetForTests();
  outputPrefs.resetForTests();
  saveFailureReported = false;
}
