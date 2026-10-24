"use client";

import { useEffect, useSyncExternalStore } from 'react';
import { audioEngine } from '../AudioEngine';
import {
  GAIN_EXPONENT,
  MASTER_VOLUME_DEFAULT,
} from '../constants';

/** localStorage key for the master fader position. */
export const MASTER_VOLUME_STORAGE_KEY = 'xox-master-volume';

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

function loadPosition(): number | null {
  try {
    const raw = window.localStorage.getItem(
      MASTER_VOLUME_STORAGE_KEY
    );
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? clamp(value) : null;
  } catch {
    return null;
  }
}

function savePosition(position: number) {
  try {
    window.localStorage.setItem(
      MASTER_VOLUME_STORAGE_KEY, String(position)
    );
  } catch {
    // localStorage unavailable
  }
}

// Last value set this session. Used when localStorage
// is unavailable (some private modes), so the fader
// still works there; it just isn't remembered.
let sessionPosition = MASTER_VOLUME_DEFAULT;
// Level to return to when unmuting.
let lastAudiblePosition = MASTER_VOLUME_DEFAULT;
const listeners = new Set<() => void>();

function getSnapshot(): number {
  return loadPosition() ?? sessionPosition;
}

function getServerSnapshot(): number {
  return MASTER_VOLUME_DEFAULT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setPosition(next: number) {
  sessionPosition = clamp(next);
  if (sessionPosition > 0) lastAudiblePosition = sessionPosition;
  savePosition(sessionPosition);
  listeners.forEach(listener => listener());
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
  sessionPosition = MASTER_VOLUME_DEFAULT;
  lastAudiblePosition = MASTER_VOLUME_DEFAULT;
  gestureStart = null;
}

/**
 * Master fader state. It is a listening setting for
 * this device, like the system volume, so it lives in
 * its own localStorage entry rather than in
 * SequencerConfig: share links don't carry it and
 * Reset doesn't touch it (hence no reset()).
 */
export function useMasterVolume() {
  // The server snapshot keeps the static HTML and the
  // first client render in agreement; the saved value
  // takes over right after hydration.
  const position = useSyncExternalStore(
    subscribe, getSnapshot, getServerSnapshot
  );

  useEffect(() => {
    audioEngine.setOutputVolume(positionToGain(position));
  }, [position]);

  return { position, setPosition, toggleMute, beginGesture };
}
