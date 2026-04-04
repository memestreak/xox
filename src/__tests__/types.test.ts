import { describe, expect, it } from 'vitest';
import {
  TRACK_IDS, getPatternLength,
  cellKey, parseCellKey,
} from '../app/types';
import type {
  NoteLength, MidiTrackConfig, MidiConfig, TrackConfig,
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

describe('TrackConfig', () => {
  it('TrackConfig has expected shape', () => {
    const tc: TrackConfig = {
      steps: '1010101010101010',
    };
    expect(tc.steps).toBe('1010101010101010');
    expect(tc.freeRun).toBeUndefined();
    expect(tc.trigConditions).toBeUndefined();
    expect(tc.parameterLocks).toBeUndefined();

    const tcFull: TrackConfig = {
      steps: '10001000100',
      freeRun: true,
      trigConditions: { 0: { probability: 50 } },
      parameterLocks: { 3: { gain: 0.8 } },
    };
    expect(tcFull.freeRun).toBe(true);
  });

  it('getPatternLength returns max step length', () => {
    const tracks = {
      ac: { steps: '1010' },
      bd: { steps: '10101010' },
      sd: { steps: '101010101010' },
      ch: { steps: '1010' },
      oh: { steps: '1010' },
      cy: { steps: '1010' },
      ht: { steps: '1010' },
      mt: { steps: '1010' },
      lt: { steps: '1010' },
      rs: { steps: '1010' },
      cp: { steps: '1010' },
      cb: { steps: '1010' },
    };
    expect(getPatternLength(tracks)).toBe(12);
  });
});

describe('cellKey / parseCellKey', () => {
  it('cellKey creates expected format', () => {
    expect(cellKey('bd', 3)).toBe('bd:3');
    expect(cellKey('ac', 0)).toBe('ac:0');
  });

  it('parseCellKey round-trips with cellKey', () => {
    const key = cellKey('sd', 15);
    const parsed = parseCellKey(key);
    expect(parsed.trackId).toBe('sd');
    expect(parsed.step).toBe(15);
  });

  it('parseCellKey throws on invalid key', () => {
    expect(() => parseCellKey('invalid'))
      .toThrow('Invalid cell key');
  });

  it('parseCellKey handles two-char track IDs', () => {
    const parsed = parseCellKey('ch:7');
    expect(parsed.trackId).toBe('ch');
    expect(parsed.step).toBe(7);
  });
});

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
