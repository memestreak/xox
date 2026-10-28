"use client";

import { createDeviceSetting } from './createDeviceSetting';

/** localStorage key for the chooser click-away setting. */
export const CHOOSER_CLICK_AWAY_STORAGE_KEY =
  'xox-chooser-click-away';

const setting = createDeviceSetting(
  CHOOSER_CLICK_AWAY_STORAGE_KEY, true
);

/** Turn click-away closing on or off and remember it. */
export const setChooserClickAway = setting.set;

/** The current value, for event handlers. */
export const getChooserClickAway = setting.get;

/** Test helper: forget the in-memory value. */
export const resetChooserClickAwayForTests =
  setting.resetForTests;

/**
 * "Click beside the pattern chooser to close it" (on by
 * default). A preference for this device, like
 * auto-minimize.
 */
export const useChooserClickAwaySetting = setting.useValue;
