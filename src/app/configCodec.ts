"use client";

import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import type {
  SequencerConfig,
  StepConditions,
  StepLocks,
  TrackConfig,
  TrackId,
  TrackMixerState,
} from './types';
import { TRACK_IDS } from './types';
import {
  BPM_MIN,
  BPM_MAX,
  DEFAULT_BPM,
  DEFAULT_TRACK_LENGTH,
  SWING_MAX,
} from './constants';

const CONFIG_VERSION = 4;
const DEFAULT_KIT_ID = '808';

/**
 * Build the default config from the first kit and pattern.
 *
 * Note: patterns.json may still be in the old format
 * (with `steps` instead of `tracks`), so we handle both.
 */
export function defaultConfig(): SequencerConfig {
  const firstPattern = patternsData.patterns[0];
  const mixer = {} as Record<TrackId, TrackMixerState>;
  const tracks = {} as Record<TrackId, TrackConfig>;
  for (const id of TRACK_IDS) {
    mixer[id] = {
      gain: id === 'ac' ? 0.5 : 1.0,
      pan: 0.5,
      isMuted: false,
      isSolo: false,
    };
    // Handle old format (steps) or new format (tracks)
    const patternAny = firstPattern as Record<
      string, unknown
    >;
    if (
      patternAny.tracks
      && typeof patternAny.tracks === 'object'
    ) {
      const t = (
        patternAny.tracks as Record<string, unknown>
      )[id] as { steps: string } | undefined;
      tracks[id] = {
        steps: t?.steps ?? '0'.repeat(DEFAULT_TRACK_LENGTH),
      };
    } else if (
      patternAny.steps
      && typeof patternAny.steps === 'object'
    ) {
      const s = (
        patternAny.steps as Record<string, string>
      )[id];
      tracks[id] = {
        steps: s ?? '0'.repeat(DEFAULT_TRACK_LENGTH),
      };
    } else {
      tracks[id] = {
        steps: '0'.repeat(DEFAULT_TRACK_LENGTH),
      };
    }
  }
  return {
    version: CONFIG_VERSION,
    kitId: kitsData.kits[0].id,
    bpm: DEFAULT_BPM,
    tracks,
    mixer,
    swing: 0,
  };
}

/**
 * Encode a Uint8Array to a URL-safe base64 string.
 */
function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a URL-safe base64 string to a Uint8Array.
 */
function fromBase64url(str: string): Uint8Array {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a SequencerConfig to a compressed base64url string.
 *
 * Pipeline: JSON.stringify -> deflate-raw -> base64url
 *
 * Strips empty optional fields per-track to keep URLs small.
 */
export async function encodeConfig(
  config: SequencerConfig
): Promise<string> {
  const tracks: Record<string, unknown> = {};
  for (const id of TRACK_IDS) {
    const t = config.tracks[id];
    const compact: Record<string, unknown> = {
      steps: t.steps,
    };
    if (t.freeRun) compact.freeRun = true;
    if (
      t.trigConditions
      && Object.keys(t.trigConditions).length > 0
    ) {
      compact.trigConditions = t.trigConditions;
    }
    if (
      t.parameterLocks
      && Object.keys(t.parameterLocks).length > 0
    ) {
      compact.parameterLocks = t.parameterLocks;
    }
    tracks[id] = compact;
  }
  const toEncode = {
    version: config.version,
    kitId: config.kitId,
    bpm: config.bpm,
    tracks,
    mixer: config.mixer,
    swing: config.swing,
  };
  const json = JSON.stringify(toEncode);
  const stream = new Blob([json]).stream()
    .pipeThrough(
      new CompressionStream('deflate-raw')
    );
  const bytes = new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
  return toBase64url(bytes);
}

/**
 * Decode a compressed base64url string to a SequencerConfig.
 *
 * Applies defensive validation: unknown kit IDs fall back to
 * "808", BPM is clamped to 20-300, missing fields merge with
 * defaults. Old version configs return defaults.
 */
export async function decodeConfig(
  hash: string
): Promise<SequencerConfig> {
  const bytes = fromBase64url(hash);
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(
      new DecompressionStream('deflate-raw')
    );
  const json = await new Response(stream).text();
  const raw = JSON.parse(json);
  return validateConfig(raw);
}

/**
 * Validate and sanitize a raw parsed config object.
 *
 * Rejects old versions (< CONFIG_VERSION) by returning
 * defaults. Validates all fields defensively.
 */
function validateConfig(
  raw: unknown
): SequencerConfig {
  const defaults = defaultConfig();
  if (raw === null || typeof raw !== 'object') {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;

  // Reject old versions
  if (obj.version !== CONFIG_VERSION) {
    return defaults;
  }

  const kitId = validateKitId(obj.kitId);
  const bpm = validateBpm(obj.bpm);
  const tracks = validateTracks(
    obj.tracks, defaults.tracks
  );
  const mixer = validateMixer(
    obj.mixer, defaults.mixer
  );
  const swing = validateSwing(obj.swing);

  return {
    version: CONFIG_VERSION,
    kitId,
    bpm,
    tracks,
    mixer,
    swing,
  };
}

function validateKitId(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_KIT_ID;
  const known = kitsData.kits.find(
    k => k.id === value
  );
  return known ? value : DEFAULT_KIT_ID;
}

function validateBpm(value: unknown): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return DEFAULT_BPM;
  }
  return Math.max(
    BPM_MIN, Math.min(BPM_MAX, Math.round(value))
  );
}

const SWING_MIN = 0;

const DEFAULT_SWING = 0;

function validateSwing(value: unknown): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return DEFAULT_SWING;
  }
  return Math.max(
    SWING_MIN,
    Math.min(SWING_MAX, Math.round(value))
  );
}

const MAX_STEP_LENGTH = 64;
const MAX_STEP_INDEX = 63;

/**
 * Validate all tracks, filling in defaults for missing
 * tracks.
 */
function validateTracks(
  value: unknown,
  fallbackTracks: Record<TrackId, TrackConfig>
): Record<TrackId, TrackConfig> {
  const result = {} as Record<TrackId, TrackConfig>;
  if (value === null || typeof value !== 'object') {
    return { ...fallbackTracks };
  }
  const obj = value as Record<string, unknown>;
  for (const id of TRACK_IDS) {
    result[id] = validateSingleTrack(
      obj[id], fallbackTracks[id]
    );
  }
  return result;
}

/**
 * Validate a single track config.
 * - steps: binary string 1-64 chars
 * - freeRun: optional boolean
 * - trigConditions: optional map of step index -> condition
 * - parameterLocks: optional map of step index -> locks
 */
function validateSingleTrack(
  raw: unknown,
  fallback: TrackConfig
): TrackConfig {
  if (raw === null || typeof raw !== 'object') {
    return { ...fallback };
  }
  const obj = raw as Record<string, unknown>;

  // Validate steps
  let steps: string;
  if (
    typeof obj.steps === 'string'
    && obj.steps.length >= 1
    && obj.steps.length <= MAX_STEP_LENGTH
    && /^[01]+$/.test(obj.steps)
  ) {
    steps = obj.steps;
  } else {
    steps = fallback.steps;
  }

  const track: TrackConfig = { steps };

  // Validate freeRun
  if (typeof obj.freeRun === 'boolean' && obj.freeRun) {
    track.freeRun = true;
  }

  // Validate trigConditions
  if (
    obj.trigConditions !== null
    && obj.trigConditions !== undefined
    && typeof obj.trigConditions === 'object'
  ) {
    const tcObj = obj.trigConditions as Record<
      string, unknown
    >;
    const validConditions: Record<
      number, StepConditions
    > = {};
    for (const key of Object.keys(tcObj)) {
      const stepIndex = Number(key);
      if (
        !Number.isInteger(stepIndex)
        || stepIndex < 0
        || stepIndex > MAX_STEP_INDEX
      ) continue;
      const cond = validateSingleCondition(tcObj[key]);
      if (cond !== null) {
        validConditions[stepIndex] = cond;
      }
    }
    if (Object.keys(validConditions).length > 0) {
      track.trigConditions = validConditions;
    }
  }

  // Validate parameterLocks
  if (
    obj.parameterLocks !== null
    && obj.parameterLocks !== undefined
    && typeof obj.parameterLocks === 'object'
  ) {
    const plObj = obj.parameterLocks as Record<
      string, unknown
    >;
    const validLocks: Record<number, StepLocks> = {};
    for (const key of Object.keys(plObj)) {
      const stepIndex = Number(key);
      if (
        !Number.isInteger(stepIndex)
        || stepIndex < 0
        || stepIndex > MAX_STEP_INDEX
      ) continue;
      const lock = validateSingleLock(plObj[key]);
      if (lock !== null) {
        validLocks[stepIndex] = lock;
      }
    }
    if (Object.keys(validLocks).length > 0) {
      track.parameterLocks = validLocks;
    }
  }

  return track;
}

const PROB_MIN = 1;
const PROB_MAX = 99;
const CYCLE_B_MIN = 2;
const CYCLE_B_MAX = 8;

/**
 * Validate a single StepConditions object.
 * Returns null if the entry has no valid fields.
 */
function validateSingleCondition(
  raw: unknown
): StepConditions | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const sc: StepConditions = {};

  // Legacy discriminated-union format (type field)
  if (obj.type === 'probability') {
    if (
      typeof obj.value === 'number'
      && isFinite(obj.value)
    ) {
      sc.probability = Math.max(
        PROB_MIN,
        Math.min(PROB_MAX, Math.round(obj.value))
      );
    }
  } else if (obj.type === 'cycle') {
    if (
      typeof obj.a === 'number' && isFinite(obj.a)
      && typeof obj.b === 'number' && isFinite(obj.b)
    ) {
      const rawB = Math.round(obj.b);
      if (rawB >= CYCLE_B_MIN) {
        const b = Math.min(CYCLE_B_MAX, rawB);
        const a = Math.max(
          1, Math.min(b, Math.round(obj.a))
        );
        sc.cycle = { a, b };
      }
    }
  } else {
    // New composite format
    if (
      typeof obj.probability === 'number'
      && isFinite(obj.probability)
    ) {
      sc.probability = Math.max(
        PROB_MIN,
        Math.min(
          PROB_MAX, Math.round(obj.probability)
        )
      );
    }
    const cyc = obj.cycle;
    if (
      cyc !== null && cyc !== undefined
      && typeof cyc === 'object'
    ) {
      const c = cyc as Record<string, unknown>;
      if (
        typeof c.a === 'number' && isFinite(c.a)
        && typeof c.b === 'number' && isFinite(c.b)
      ) {
        const rawB = Math.round(c.b);
        if (rawB >= CYCLE_B_MIN) {
          const b = Math.min(CYCLE_B_MAX, rawB);
          const a = Math.max(
            1, Math.min(b, Math.round(c.a))
          );
          sc.cycle = { a, b };
        }
      }
    }
    if (
      obj.fill === 'fill' || obj.fill === '!fill'
    ) {
      sc.fill = obj.fill;
    }
  }

  if (Object.keys(sc).length === 0) return null;
  return sc;
}

/**
 * Validate a single StepLocks object.
 * Returns null if no valid fields remain.
 */
function validateSingleLock(
  raw: unknown
): StepLocks | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const sl: StepLocks = {};

  if (
    typeof obj.gain === 'number'
    && isFinite(obj.gain)
  ) {
    sl.gain = Math.max(0, Math.min(1, obj.gain));
  }

  if (
    typeof obj.pan === 'number'
    && isFinite(obj.pan)
  ) {
    sl.pan = Math.max(0, Math.min(1, obj.pan));
  }

  if (Object.keys(sl).length === 0) return null;
  return sl;
}

function validateMixer(
  value: unknown,
  fallback: Record<TrackId, TrackMixerState>
): Record<TrackId, TrackMixerState> {
  if (value === null || typeof value !== 'object') {
    return fallback;
  }
  const obj = value as Record<string, unknown>;
  const result = { ...fallback };
  for (const id of TRACK_IDS) {
    const track = obj[id];
    if (track !== null && typeof track === 'object') {
      const t = track as Record<string, unknown>;
      result[id] = {
        gain:
          typeof t.gain === 'number' && isFinite(t.gain)
            ? Math.max(0, Math.min(1, t.gain))
            : fallback[id].gain,
        pan:
          typeof t.pan === 'number' && isFinite(t.pan)
            ? Math.max(0, Math.min(1, t.pan))
            : fallback[id].pan,
        isMuted:
          typeof t.isMuted === 'boolean'
            ? t.isMuted
            : fallback[id].isMuted,
        isSolo:
          typeof t.isSolo === 'boolean'
            ? t.isSolo
            : fallback[id].isSolo,
      };
    }
  }
  return result;
}
