import {
  DEFAULT_TRACK_GAIN,
  DEFAULT_TRACK_PAN,
} from './constants';
import { TRACKS } from './types';
import type {
  PatternMixer,
  TrackId,
  TrackMixerState,
} from './types';

type Mixer = Record<TrackId, TrackMixerState>;

/**
 * Return a copy of the mixer with every grid track's
 * volume and pan set by a pattern preset: the preset's
 * value where it has one, otherwise the default.
 * Mute, solo and the accent level are left as they are.
 */
export function withPresetLevels(
  mixer: Mixer,
  preset: PatternMixer | undefined
): Mixer {
  const next = { ...mixer };
  for (const { id } of TRACKS) {
    next[id] = {
      ...mixer[id],
      gain: preset?.[id]?.gain ?? DEFAULT_TRACK_GAIN,
      pan: preset?.[id]?.pan ?? DEFAULT_TRACK_PAN,
    };
  }
  return next;
}

/**
 * Return a copy of the mixer with every grid track's
 * volume and pan taken from `source`. Mute, solo and
 * the accent level stay as they are now.
 */
export function withLevelsFrom(
  mixer: Mixer,
  source: Mixer
): Mixer {
  const next = { ...mixer };
  for (const { id } of TRACKS) {
    next[id] = {
      ...mixer[id],
      gain: source[id].gain,
      pan: source[id].pan,
    };
  }
  return next;
}
