import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../app/configCodec';
import patternsData from '../app/data/patterns.json';
import {
  withLevelsFrom,
  withPresetLevels,
} from '../app/mixerUtils';
import { TRACKS } from '../app/types';
import type { Pattern, TrackId } from '../app/types';

function movedMixer() {
  const mixer = defaultConfig().mixer;
  mixer.bd = { ...mixer.bd, gain: 0.2, pan: 0.1 };
  mixer.sd = { ...mixer.sd, isMuted: true, pan: 0.9 };
  mixer.ac = { ...mixer.ac, gain: 0.8 };
  return mixer;
}

describe('withPresetLevels', () => {
  it('uses defaults when the preset has no mixer', () => {
    const next = withPresetLevels(movedMixer(), undefined);
    for (const { id } of TRACKS) {
      expect(next[id].gain).toBe(1);
      expect(next[id].pan).toBe(0.5);
    }
  });

  it('uses the preset value per field, default for'
    + ' the rest', () => {
    const next = withPresetLevels(movedMixer(), {
      bd: { gain: 0.7 },
      ch: { pan: 0.3 },
    });
    expect(next.bd.gain).toBe(0.7);
    expect(next.bd.pan).toBe(0.5);
    expect(next.ch.gain).toBe(1);
    expect(next.ch.pan).toBe(0.3);
    expect(next.sd.pan).toBe(0.5);
  });

  it('keeps mute, solo and the accent level', () => {
    const next = withPresetLevels(movedMixer(), {
      ac: { gain: 0.1 },
    });
    expect(next.sd.isMuted).toBe(true);
    expect(next.ac.gain).toBe(0.8);
  });
});

describe('withLevelsFrom', () => {
  it('copies volume and pan only', () => {
    const source = movedMixer();
    const next = withLevelsFrom(
      defaultConfig().mixer, source
    );
    expect(next.bd.gain).toBe(0.2);
    expect(next.bd.pan).toBe(0.1);
    expect(next.sd.pan).toBe(0.9);
    expect(next.sd.isMuted).toBe(false);
    expect(next.ac.gain).toBe(0.5);
  });
});

describe('patterns.json mixer values', () => {
  const gridIds = new Set<TrackId>(TRACKS.map(t => t.id));
  const patterns = patternsData.patterns as Pattern[];

  it('name grid tracks and stay within 0-1', () => {
    for (const p of patterns) {
      for (const [id, levels] of
        Object.entries(p.mixer ?? {})) {
        expect(
          gridIds.has(id as TrackId),
          `${p.id}: unknown track ${id}`
        ).toBe(true);
        for (const [key, v] of Object.entries(levels)) {
          expect(['gain', 'pan']).toContain(key);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
