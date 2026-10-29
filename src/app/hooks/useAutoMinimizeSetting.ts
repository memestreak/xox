"use client";

import { gridPrefs } from '../preferences';

/**
 * Turn auto-minimize on or off and save it. The grid
 * menu's toggle is a shortcut to the same saved value
 * as Settings › Sequencer › Grid.
 */
export function setAutoMinimize(value: boolean) {
  gridPrefs.update({ autoMinimize: value });
}

/**
 * "Auto-minimize empty tracks" (off by default). A view
 * preference for this device, like the master volume.
 */
export function useAutoMinimizeSetting(): boolean {
  return gridPrefs.useValue().autoMinimize;
}
