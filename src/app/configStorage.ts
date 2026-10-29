"use client";

import { validateConfig } from './configCodec';
import type { SequencerConfig } from './types';
import { CUSTOM_PATTERN_ID } from './patternUtils';

/**
 * localStorage key for the autosaved session: the work,
 * kept under `works` so it never mixes with the
 * preferences (preferences.ts). xox has one work per
 * device, so its id is fixed.
 */
export const CONFIG_STORAGE_KEY = 'xox.sequencer.works.session';

/** What gets autosaved between visits. */
export interface StoredSession {
  config: SequencerConfig;
  selectedPatternId: string;
}

/**
 * Save the current session to localStorage. Failures
 * (private mode, quota) are ignored: autosave is a
 * convenience, not a guarantee.
 */
export function saveSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(
      CONFIG_STORAGE_KEY, JSON.stringify(session)
    );
  } catch {
    // localStorage unavailable
  }
}

/**
 * Load the autosaved session, or null if there is none
 * or it can't be used. The config goes through the same
 * validation as share links, so a corrupted or outdated
 * entry can't put the app in a bad state.
 */
export function loadSession(): StoredSession | null {
  let raw: unknown;
  try {
    const text = window.localStorage.getItem(
      CONFIG_STORAGE_KEY
    );
    if (!text) return null;
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawConfig = obj.config as
    Record<string, unknown> | null | undefined;
  if (!rawConfig || typeof rawConfig !== 'object') {
    return null;
  }
  const config = validateConfig(rawConfig);
  // validateConfig falls back to defaults for an old
  // version; treat that as "nothing saved".
  if (rawConfig.version !== config.version) return null;
  const selectedPatternId =
    typeof obj.selectedPatternId === 'string'
      ? obj.selectedPatternId
      : CUSTOM_PATTERN_ID;
  return { config, selectedPatternId };
}
