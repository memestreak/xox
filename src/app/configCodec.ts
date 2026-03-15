"use client";

import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import type {
  SequencerConfig,
  TrackId,
  TrackMixerState,
} from './types';
import { TRACK_IDS } from './types';

const CONFIG_VERSION = 1;
const DEFAULT_KIT_ID = '808';
const BPM_MIN = 20;
const BPM_MAX = 300;
const DEFAULT_BPM = 110;

/**
 * Build the default config from the first kit and pattern.
 */
export function defaultConfig(): SequencerConfig {
  const firstPattern = patternsData.patterns[0];
  const mixer = {} as Record<TrackId, TrackMixerState>;
  for (const id of TRACK_IDS) {
    mixer[id] = { gain: 1.0, isMuted: false, isSolo: false };
  }
  return {
    version: CONFIG_VERSION,
    kitId: kitsData.kits[0].id,
    bpm: DEFAULT_BPM,
    steps: firstPattern.steps as Record<TrackId, string>,
    mixer,
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
 * Args:
 *   config: The sequencer configuration to encode.
 *
 * Returns:
 *   A URL-safe base64 encoded string.
 */
export async function encodeConfig(
  config: SequencerConfig
): Promise<string> {
  const json = JSON.stringify(config);
  const stream = new Blob([json]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
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
 * defaults.
 *
 * Args:
 *   hash: The URL-safe base64 encoded string to decode.
 *
 * Returns:
 *   A validated SequencerConfig.
 *
 * Raises:
 *   Error: If decompression or JSON parsing fails.
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
 * Merges missing fields from defaults, clamps BPM, and
 * validates the kit ID against known kits.
 */
function validateConfig(raw: unknown): SequencerConfig {
  const defaults = defaultConfig();
  if (
    raw === null ||
    typeof raw !== 'object'
  ) {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;

  const kitId = validateKitId(obj.kitId);
  const bpm = validateBpm(obj.bpm);
  const steps = validateSteps(obj.steps, defaults.steps);
  const mixer = validateMixer(obj.mixer, defaults.mixer);

  return {
    version: CONFIG_VERSION,
    kitId,
    bpm,
    steps,
    mixer,
  };
}

function validateKitId(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_KIT_ID;
  const known = kitsData.kits.find(k => k.id === value);
  return known ? value : DEFAULT_KIT_ID;
}

function validateBpm(value: unknown): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return DEFAULT_BPM;
  }
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(value)));
}

function validateSteps(
  value: unknown,
  fallback: Record<TrackId, string>
): Record<TrackId, string> {
  if (value === null || typeof value !== 'object') {
    return fallback;
  }
  const obj = value as Record<string, unknown>;
  const result = { ...fallback };
  for (const id of TRACK_IDS) {
    const s = obj[id];
    if (
      typeof s === 'string' &&
      s.length === 16 &&
      /^[01]+$/.test(s)
    ) {
      result[id] = s;
    }
  }
  return result;
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
        gain: typeof t.gain === 'number' && isFinite(t.gain)
          ? Math.max(0, Math.min(1, t.gain))
          : fallback[id].gain,
        isMuted: typeof t.isMuted === 'boolean'
          ? t.isMuted
          : fallback[id].isMuted,
        isSolo: typeof t.isSolo === 'boolean'
          ? t.isSolo
          : fallback[id].isSolo,
      };
    }
  }
  return result;
}
