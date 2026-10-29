"use client";

import { patternsPrefs } from '../preferences';

/** The current value, for event handlers. */
export function getChooserClickAway(): boolean {
  return patternsPrefs.get().chooserClickAway;
}

/**
 * "Click beside the pattern chooser to close it" (on by
 * default), from Settings › Sequencer › Patterns.
 */
export function useChooserClickAwaySetting(): boolean {
  return patternsPrefs.useValue().chooserClickAway;
}
