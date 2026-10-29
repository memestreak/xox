"use client";

import { useEffect } from 'react';
import { audioEngine } from '../AudioEngine';
import {
  GAIN_EXPONENT,
  MASTER_VOLUME_DEFAULT,
} from '../constants';
import { outputPrefs } from '../preferences';

/**
 * Fader position (0-1) to linear gain. Uses the same
 * cubic curve as the track volume knobs.
 */
export function positionToGain(position: number): number {
  return Math.pow(position, GAIN_EXPONENT);
}

/** Linear gain to a readout such as "−5.8 dB". */
export function formatDb(gain: number): string {
  if (gain <= 0) return '−∞ dB';
  const db = 20 * Math.log10(gain);
  // Avoid "−0.0" from rounding.
  const rounded = Math.round(db * 10) / 10;
  if (rounded === 0) return '0.0 dB';
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${Math.abs(rounded).toFixed(1)} dB`;
}

function clamp(position: number): number {
  return Math.max(0, Math.min(1, position));
}

// Level to return to when unmuting.
let lastAudiblePosition = MASTER_VOLUME_DEFAULT;

function getSnapshot(): number {
  return outputPrefs.get().volume;
}

/**
 * Move the fader and save it. Settings › Sequencer ›
 * Output shows the same saved value.
 */
function setPosition(next: number) {
  const position = clamp(next);
  if (position > 0) lastAudiblePosition = position;
  outputPrefs.update({ volume: position });
}

// Levels captured when a click on the widget began,
// before a click on the fader bar moved the knob.
let gestureStart: { position: number; lastAudible: number } | null = null;

/**
 * Call on the first press of a possible double-click,
 * so toggleMute() works from the level before the
 * press rather than wherever the press moved the knob.
 */
function beginGesture() {
  gestureStart = {
    position: getSnapshot(),
    lastAudible: lastAudiblePosition,
  };
}

/**
 * Mute, or when already muted, return to the last
 * audible level (the default if there was none this
 * session).
 */
function toggleMute() {
  const start = gestureStart ?? {
    position: getSnapshot(),
    lastAudible: lastAudiblePosition,
  };
  gestureStart = null;
  if (start.position > 0) {
    lastAudiblePosition = start.position;
    setPosition(0);
  } else {
    setPosition(start.lastAudible);
  }
}

/** Test helper: forget the in-memory value. */
export function resetMasterVolumeForTests() {
  outputPrefs.resetForTests();
  lastAudiblePosition = MASTER_VOLUME_DEFAULT;
  gestureStart = null;
}

/**
 * Master fader state. It is a listening setting for
 * this device, like the system volume, so it is a
 * preference (Settings › Sequencer › Output) rather
 * than part of SequencerConfig: share links don't carry
 * it and Reset doesn't touch it (hence no reset()).
 */
export function useMasterVolume() {
  // The server snapshot keeps the static HTML and the
  // first client render in agreement; the saved value
  // takes over right after hydration.
  const { volume: position } = outputPrefs.useValue();

  useEffect(() => {
    audioEngine.setOutputVolume(positionToGain(position));
  }, [position]);

  return { position, setPosition, toggleMute, beginGesture };
}
