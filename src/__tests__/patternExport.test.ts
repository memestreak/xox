import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../app/configCodec';
import patternsData from '../app/data/patterns.json';
import {
  buildPatternEntry,
  formatPatternEntry,
} from '../app/patternExport';
import { TRACK_IDS } from '../app/types';
import type { Pattern, SequencerConfig } from '../app/types';

const presets = patternsData.patterns as Pattern[];
const first = presets[0];

/** The first preset loaded, with nothing edited. */
function presetConfig(): SequencerConfig {
  const config = defaultConfig();
  config.tracks = structuredClone(first.tracks);
  return config;
}

describe('buildPatternEntry', () => {
  it('copies an unedited preset as it is in the file', () => {
    const entry = buildPatternEntry(
      presetConfig(), first.id, presets
    );
    expect(entry).toEqual(first);
  });

  it('drops the edited mark and keeps name and'
    + ' category', () => {
    const entry = buildPatternEntry(
      presetConfig(), first.id + '*', presets
    );
    expect(entry.id).toBe(first.id);
    expect(entry.name).toBe(first.name);
    expect(entry.category).toBe(first.category);
  });

  it('names a grid with no preset "custom"', () => {
    const entry = buildPatternEntry(
      presetConfig(), 'custom', presets
    );
    expect(entry.id).toBe('custom');
    expect(entry.name).toBe('Custom');
    expect(entry).not.toHaveProperty('category');
  });

  it('keeps every track in file order with its'
    + ' conditions, locks and free run', () => {
    const config = presetConfig();
    config.tracks.sd = {
      steps: '10100',
      freeRun: true,
      trigConditions: { 2: { probability: 50 } },
      parameterLocks: { 0: { gain: 0.4 } },
    };
    config.tracks.ch = {
      steps: '1111',
      trigConditions: {},
      parameterLocks: {},
    };
    const entry = buildPatternEntry(
      config, first.id, presets
    );
    expect(Object.keys(entry.tracks)).toEqual(
      [...TRACK_IDS]
    );
    expect(entry.tracks.sd).toEqual(config.tracks.sd);
    expect(entry.tracks.ch).toEqual({ steps: '1111' });
  });

  it('stores volume and pan that differ from the'
    + ' default, rounded', () => {
    const config = presetConfig();
    config.mixer.bd.gain = 0.7300000001;
    config.mixer.sd.pan = 0.25;
    const entry = buildPatternEntry(
      config, first.id, presets
    );
    expect(entry.mixer).toEqual({
      bd: { gain: 0.73 },
      sd: { pan: 0.25 },
    });
  });

  it('leaves out mute, solo and the accent level', () => {
    const config = presetConfig();
    config.mixer.bd.isMuted = true;
    config.mixer.sd.isSolo = true;
    config.mixer.ac.gain = 0.9;
    const entry = buildPatternEntry(
      config, first.id, presets
    );
    expect(entry).not.toHaveProperty('mixer');
  });
});

describe('formatPatternEntry', () => {
  it('indents like patterns.json and ends with a'
    + ' newline', () => {
    const text = formatPatternEntry(first);
    expect(JSON.parse(text)).toEqual(first);
    expect(text).toContain('\n  "tracks": {\n');
    expect(text.endsWith('}\n')).toBe(true);
  });
});
