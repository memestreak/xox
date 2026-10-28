"use client";

import { createDeviceSetting } from './createDeviceSetting';

/** localStorage key for the auto-minimize setting. */
export const AUTO_MINIMIZE_STORAGE_KEY = 'xox-auto-minimize';

const setting = createDeviceSetting(
  AUTO_MINIMIZE_STORAGE_KEY, false
);

/** Turn auto-minimize on or off and remember it. */
export const setAutoMinimize = setting.set;

/** Test helper: forget the in-memory value. */
export const resetAutoMinimizeForTests = setting.resetForTests;

/**
 * "Auto-minimize empty tracks" (off by default). A view
 * preference for this device, like the master volume.
 */
export const useAutoMinimizeSetting = setting.useValue;
