import type { MidiConfig, NoteLength } from './types';
import { defaultMidiConfig } from './types';

function isInt(
  v: unknown, min: number, max: number
): v is number {
  return Number.isInteger(v)
    && (v as number) >= min && (v as number) <= max;
}

function validateNoteLength(
  raw: unknown, fallback: NoteLength
): NoteLength {
  if (!raw || typeof raw !== 'object') return fallback;
  const nl = raw as Record<string, unknown>;
  if (
    nl.type === 'fixed'
    && typeof nl.ms === 'number'
    && isFinite(nl.ms) && nl.ms > 0
  ) {
    return { type: 'fixed', ms: nl.ms };
  }
  if (
    nl.type === 'percent'
    && typeof nl.value === 'number'
    && isFinite(nl.value) && nl.value > 0
  ) {
    return { type: 'percent', value: nl.value };
  }
  return fallback;
}

/**
 * Sanitize a MIDI config read from localStorage. Each
 * field falls back to its default when missing or
 * invalid, so a config saved by an older version can't
 * break note sending.
 */
export function validateMidiConfig(raw: unknown): MidiConfig {
  const defaults = defaultMidiConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const tracks = { ...defaults.tracks };
  if (obj.tracks && typeof obj.tracks === 'object') {
    const rawTracks = obj.tracks as Record<string, unknown>;
    for (const id of Object.keys(tracks) as
      (keyof MidiConfig['tracks'])[]) {
      const t = rawTracks[id] as
        { noteNumber?: unknown } | undefined;
      if (t && isInt(t.noteNumber, 0, 127)) {
        tracks[id] = { noteNumber: t.noteNumber };
      }
    }
  }

  return {
    enabled: typeof obj.enabled === 'boolean'
      ? obj.enabled : defaults.enabled,
    deviceId: typeof obj.deviceId === 'string'
      ? obj.deviceId : defaults.deviceId,
    channel: isInt(obj.channel, 1, 16)
      ? obj.channel : defaults.channel,
    noteLength: validateNoteLength(
      obj.noteLength, defaults.noteLength
    ),
    tracks,
  };
}
