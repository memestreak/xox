/**
 * Valid track identifiers for the 16-step sequencer.
 */
export type TrackId = 'kick' | 'snare' | 'ch' | 'oh';

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
  steps: Record<TrackId, number[]>;         // Array of 16 numbers (0 or 1) per track
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
