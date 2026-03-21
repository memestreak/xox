import { describe, expect, it } from 'vitest';
import { TRACK_IDS } from '../app/types';
import type {
  NoteLength, MidiTrackConfig, MidiConfig,
} from '../app/types';

describe('MIDI types', () => {
  it('MidiConfig has correct shape', () => {
    const config: MidiConfig = {
      enabled: false,
      deviceId: null,
      channel: 10,
      noteLength: { type: 'fixed', ms: 50 },
      tracks: {
        bd: { noteNumber: 36 },
        sd: { noteNumber: 38 },
        ch: { noteNumber: 42 },
        oh: { noteNumber: 46 },
        cy: { noteNumber: 49 },
        ht: { noteNumber: 50 },
        mt: { noteNumber: 47 },
        lt: { noteNumber: 43 },
        rs: { noteNumber: 37 },
        cp: { noteNumber: 39 },
        cb: { noteNumber: 56 },
      },
    };
    expect(config.channel).toBe(10);
    expect(config.tracks.bd.noteNumber).toBe(36);
  });

  it('NoteLength supports fixed and percent', () => {
    const fixed: NoteLength = { type: 'fixed', ms: 50 };
    const pct: NoteLength = { type: 'percent', value: 75 };
    expect(fixed.type).toBe('fixed');
    expect(pct.type).toBe('percent');
  });
});

// Suppress unused-import warning for type-only import
void (undefined as unknown as MidiTrackConfig);

describe('TRACK_IDS', () => {
  it('ordering matches snapshot (append-only)', () => {
    // TRACK_IDS is documented as append-only. Reordering
    // would silently corrupt serialized mixer data in
    // existing URLs.
    expect(TRACK_IDS).toEqual([
      'ac', 'bd', 'sd', 'ch', 'oh', 'cy',
      'ht', 'mt', 'lt', 'rs', 'cp', 'cb',
    ]);
  });
});
