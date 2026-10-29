import {
  DEFAULT_TRACK_GAIN,
  DEFAULT_TRACK_PAN,
} from './constants';
import {
  CUSTOM_PATTERN_ID,
  basePatternId,
} from './patternUtils';
import { TRACKS, TRACK_IDS } from './types';
import type {
  Pattern,
  PatternMixer,
  PatternTrackLevels,
  SequencerConfig,
  TrackConfig,
  TrackId,
} from './types';

/**
 * Copy pattern (grid menu): the current grid as a
 * `patterns.json` entry, for the developer to save as a
 * preset's default with `npm run save-pattern`.
 *
 * Only what a preset holds is copied: steps, free run,
 * trig conditions, parameter locks, and the grid
 * tracks' volume and pan. BPM, swing, kit, mute, solo
 * and the accent level are not part of a preset.
 */

/** Levels are kept to 2 decimals, like the sliders show. */
function roundLevel(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One track, with empty optional fields left out. */
function exportTrack(track: TrackConfig): TrackConfig {
  const out: TrackConfig = { steps: track.steps };
  if (track.freeRun) out.freeRun = true;
  if (
    track.trigConditions
    && Object.keys(track.trigConditions).length > 0
  ) {
    out.trigConditions = track.trigConditions;
  }
  if (
    track.parameterLocks
    && Object.keys(track.parameterLocks).length > 0
  ) {
    out.parameterLocks = track.parameterLocks;
  }
  return out;
}

/**
 * Grid tracks' volume and pan, leaving out values at the
 * default (a preset's missing value means the default).
 * Undefined when every track is at the default.
 */
function exportMixer(
  mixer: SequencerConfig['mixer']
): PatternMixer | undefined {
  const out: PatternMixer = {};
  for (const { id } of TRACKS) {
    const gain = roundLevel(mixer[id].gain);
    const pan = roundLevel(mixer[id].pan);
    const levels: PatternTrackLevels = {};
    if (gain !== DEFAULT_TRACK_GAIN) levels.gain = gain;
    if (pan !== DEFAULT_TRACK_PAN) levels.pan = pan;
    if (Object.keys(levels).length > 0) out[id] = levels;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The current grid as a preset entry. The id, name and
 * category come from the selected preset (without the
 * edited `*` mark). With no preset selected (a share
 * link or Reset) the id is `custom`, which the save
 * script refuses until it is changed.
 */
export function buildPatternEntry(
  config: SequencerConfig,
  selectedPatternId: string,
  presets: Pattern[]
): Pattern {
  const id = basePatternId(selectedPatternId);
  const preset = presets.find(p => p.id === id);

  const tracks = {} as Record<TrackId, TrackConfig>;
  for (const trackId of TRACK_IDS) {
    tracks[trackId] = exportTrack(config.tracks[trackId]);
  }

  // Key order matches patterns.json.
  const entry: Pattern = {
    id: preset?.id ?? CUSTOM_PATTERN_ID,
    name: preset?.name ?? 'Custom',
    ...(preset?.category && { category: preset.category }),
    tracks,
  };
  const mixer = exportMixer(config.mixer);
  if (mixer) entry.mixer = mixer;
  return entry;
}

/** The entry as text, indented like `patterns.json`. */
export function formatPatternEntry(entry: Pattern): string {
  return JSON.stringify(entry, null, 2) + '\n';
}
