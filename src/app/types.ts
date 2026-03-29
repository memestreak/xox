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
 * Compound trig conditions for a single step.
 * Both fields are optional; when both are set they
 * combine with AND semantics.
 *
 * - probability: fires randomly (1-99%)
 * - cycle: fires on step a of every b reps (b: 2-8)
 */
export interface StepConditions {
  probability?: number;
  cycle?: { a: number; b: number };
  fill?: 'fill' | '!fill';
}

/**
 * Per-step parameter lock overrides.
 * Each field overrides the track-level default when present.
 */
export interface StepLocks {
  gain?: number; // 0.0–1.0
  pan?: number;  // 0.0–1.0 (0.5 = center)
}

/**
 * Per-track configuration: steps plus optional
 * per-step conditions and parameter locks.
 */
export interface TrackConfig {
  steps: string;
  freeRun?: boolean;
  trigConditions?: Record<number, StepConditions>;
  parameterLocks?: Record<number, StepLocks>;
}

/**
 * Represents a pattern with variable-length step strings.
 */
export interface Pattern {
  id: string;
  name: string;
  category?: string;
  tracks: Record<TrackId, TrackConfig>;
}

/**
 * A single per-track beat pattern used by the
 * shift+drag pattern cycling gesture.
 */
export interface TrackPattern {
  id: string;
  name: string;
  steps: string; // 16-char binary string
}

/**
 * Represents the mutable state of a track in the mixer.
 */
export interface TrackState {
  id: TrackId;
  name: string;
  isMuted: boolean;
  isSolo: boolean;
  gain: number;   // Master volume for this track (0.0 to 1.0)
  pan: number;    // Stereo pan (0.0 = left, 0.5 = center, 1.0 = right)
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
  pan: number;       // 0.0 - 1.0 (0.5 = center)
  isMuted: boolean;
  isSolo: boolean;
}

/**
 * Pattern change mode — controls when a new pattern
 * takes effect during playback.
 */
export type PatternMode =
  | 'sequential'
  | 'direct-start'
  | 'direct-jump';

/**
 * Temp button state machine.
 */
export type TempState = 'off' | 'armed' | 'active';

/**
 * Snapshot of config fields preserved for temp mode
 * revert. Mixer state is excluded because setPattern
 * does not modify it.
 */
export interface HomeSnapshot {
  tracks: Record<TrackId, TrackConfig>;
  selectedPatternId: string;
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
  tracks: Record<TrackId, TrackConfig>;
  mixer: Record<TrackId, TrackMixerState>;
  swing: number;
}

/**
 * Derive the effective pattern length from tracks.
 * Returns the longest step string length across all tracks.
 */
export function getPatternLength(
  tracks: Record<TrackId, TrackConfig>
): number {
  return Math.max(
    ...Object.values(tracks).map(t => t.steps.length)
  );
}

/** Note length: fixed milliseconds or tempo-relative. */
export type NoteLength =
  | { type: 'fixed'; ms: number }
  | { type: 'percent'; value: number };

/** Per-track MIDI note mapping. */
export interface MidiTrackConfig {
  noteNumber: number;  // 0–127
}

/** Complete MIDI output configuration. */
export interface MidiConfig {
  enabled: boolean;
  deviceId: string | null;
  channel: number;  // 1–16
  noteLength: NoteLength;
  tracks: Record<
    Exclude<TrackId, 'ac'>,
    MidiTrackConfig
  >;
}

/** Default GM drum map note numbers. */
export const GM_DRUM_MAP: Record<
  Exclude<TrackId, 'ac'>, number
> = {
  bd: 36, sd: 38, ch: 42, oh: 46, cy: 49,
  ht: 50, mt: 47, lt: 43, rs: 37, cp: 39, cb: 56,
} as const;

/** Factory for default MidiConfig. */
export function defaultMidiConfig(): MidiConfig {
  const tracks = {} as MidiConfig['tracks'];
  for (const [id, note] of
    Object.entries(GM_DRUM_MAP) as
      [Exclude<TrackId, 'ac'>, number][]
  ) {
    tracks[id] = { noteNumber: note };
  }
  return {
    enabled: false,
    deviceId: null,
    channel: 10,
    noteLength: { type: 'fixed', ms: 50 },
    tracks,
  };
}
