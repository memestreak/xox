"use client";

import { interfacePrefs } from '../preferences';

/**
 * Turn auto-minimize on or off and save it. The grid
 * menu's toggle is a shortcut to the same saved value
 * as Settings › Interface.
 */
export function setAutoMinimize(value: boolean) {
  interfacePrefs.update({ autoMinimize: value });
}

/**
 * "Auto-minimize empty tracks" (off by default). A view
 * preference for this device, like the master volume.
 */
export function useAutoMinimizeSetting(): boolean {
  return interfacePrefs.useValue().autoMinimize;
}
