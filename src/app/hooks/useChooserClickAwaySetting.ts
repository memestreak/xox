"use client";

import { interfacePrefs } from '../preferences';

/** The current value, for event handlers. */
export function getChooserClickAway(): boolean {
  return interfacePrefs.get().chooserClickAway;
}

/**
 * "Click beside the pattern chooser to close it" (on by
 * default), from Settings › Interface.
 */
export function useChooserClickAwaySetting(): boolean {
  return interfacePrefs.useValue().chooserClickAway;
}
