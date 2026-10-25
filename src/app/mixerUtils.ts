import {
  DEFAULT_TRACK_GAIN,
  DEFAULT_TRACK_PAN,
} from './constants';
import { TRACKS } from './types';
import type { TrackId, TrackMixerState } from './types';

type Mixer = Record<TrackId, TrackMixerState>;

/**
 * Return a copy of the mixer with every grid track's
 * volume and pan back at their defaults. Loading a
 * pattern preset uses this. Mute, solo and the accent
 * level are left as they are.
 */
export function withDefaultLevels(mixer: Mixer): Mixer {
  const next = { ...mixer };
  for (const { id } of TRACKS) {
    next[id] = {
      ...mixer[id],
      gain: DEFAULT_TRACK_GAIN,
      pan: DEFAULT_TRACK_PAN,
    };
  }
  return next;
}

/**
 * Return a copy of the mixer with every grid track's
 * volume and pan taken from `source`. Temp uses this to
 * bring back the home pattern's levels; mute, solo and
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
