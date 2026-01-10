/**
 * Valid track identifiers for the 16-step sequencer.
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
 * Represents a 16-step pattern.
 */
export interface Pattern {
  id: string;                               // Unique identifier
  name: string;                             // Display name
  steps: Record<TrackId, string>;             // Binary string of 16 characters (e.g., "1010...") per track
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
}
