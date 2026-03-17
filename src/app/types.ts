/**
 * Valid track identifiers for the sequencer.
 */
export type TrackId = 'ac' | 'bd' | 'sd' | 'ch' | 'oh' | 'cy' | 'ht' | 'mt' | 'lt' | 'rs' | 'cp' | 'cb';

/**
 * Represents a Drum Kit configuration.
 */
export interface Kit {
  id: string;     // Unique identifier
  name: string;   // Display name
  folder: string; // Folder name in /public/kits/ where .wav files reside
}

/**
 * A trig condition controlling when a step fires.
 *
 * - probability: fires randomly with the given percentage (1-99)
 * - cycle: fires on step `a` of every `b` repetitions (1/b to b/b)
 */
export type TrigCondition =
  | { type: 'probability'; value: number }
  | { type: 'cycle'; a: number; b: number };

/**
 * Represents a pattern with variable-length step strings.
 */
export interface Pattern {
  id: string;
  name: string;
  steps: Record<TrackId, string>;
  trigConditions?: Partial<
    Record<TrackId, Record<number, TrigCondition>>
  >;
}

/**
 * Represents the mutable state of a track in the mixer.
 */
export interface TrackState {
  id: TrackId;
  name: string;
  isMuted: boolean;
  isSolo: boolean;
  freeRun: boolean;
  gain: number;   // Master volume for this track (0.0 to 1.0)
}

/**
 * Canonical track ordering for binary serialization.
 * Append only — never reorder once URLs are in the wild.
 */
export const TRACK_IDS: readonly TrackId[] = [
  'ac', 'bd', 'sd', 'ch', 'oh', 'cy',
  'ht', 'mt', 'lt', 'rs', 'cp', 'cb',
] as const;

/**
 * Per-track mixer state within a serialized config.
 */
export interface TrackMixerState {
  gain: number;      // 0.0 - 1.0
  isMuted: boolean;
  isSolo: boolean;
  freeRun: boolean;
}

/**
 * Complete serializable sequencer configuration.
 *
 * This is the single source of truth for all persistable
 * state. Transient state (isPlaying, isLoaded, stepRef)
 * is excluded.
 */
export interface SequencerConfig {
  version: number;
  kitId: string;
  bpm: number;
  patternLength: number;
  trackLengths: Record<TrackId, number>;
  steps: Record<TrackId, string>;
  mixer: Record<TrackId, TrackMixerState>;
  swing: number;
  trigConditions: Partial<
    Record<TrackId, Record<number, TrigCondition>>
  >;
}
