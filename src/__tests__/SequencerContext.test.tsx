import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSequencer } from '../app/SequencerContext';
import { defaultConfig, encodeConfig } from '../app/configCodec';
import {
  CONFIG_STORAGE_KEY, loadSession, saveSession,
} from '../app/configStorage';
import { TRACK_IDS, getPatternLength } from '../app/types';
import type { Pattern, TrackId, TrackConfig } from '../app/types';
import patternsData from '../app/data/patterns.json';
import kitsData from '../app/data/kits.json';
import { TestWrapper } from './helpers/sequencer-wrapper';
import { encodeRaw } from './helpers/encodeRaw';
import {
  setAutoMinimize,
} from '../app/hooks/useAutoMinimizeSetting';
import { gridPrefs } from '../app/preferences';

// Mock the AudioEngine module
vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
    requestReset: vi.fn(),
    decodeSample: vi.fn().mockResolvedValue({}),
    setCustomSample: vi.fn(),
    clearCustomSample: vi.fn(),
    clearCustomSamples: vi.fn(),
  },
}));

function renderSequencer() {
  return renderHook(() => useSequencer(), {
    wrapper: TestWrapper,
  });
}

// -------------------------------------------------------
// A. Derived state
// -------------------------------------------------------
describe('derived state', () => {
  it('initial currentKit is 808', () => {
    const { result } = renderSequencer();
    expect(result.current.state.currentKit.id).toBe('808');
    expect(result.current.state.currentKit.name).toBe('808');
  });

  it('setKit updates currentKit', () => {
    const { result } = renderSequencer();
    const electro = kitsData.kits.find(
      k => k.id === 'electro'
    )!;
    act(() => {
      result.current.actions.setKit(electro);
    });
    expect(result.current.state.currentKit.id).toBe('electro');
  });

  it('trackStates has all 12 TrackIds with defaults', () => {
    const { result } = renderSequencer();
    const states = result.current.state.trackStates;
    for (const id of TRACK_IDS) {
      expect(states[id]).toBeDefined();
      expect(states[id].id).toBe(id);
      expect(states[id].gain).toBe(
        id === 'ac' ? 0.5 : 1
      );
      expect(states[id].isMuted).toBe(false);
      expect(states[id].isSolo).toBe(false);
      expect(typeof states[id].name).toBe('string');
    }
  });

  it('trackStates names match expected values', () => {
    const { result } = renderSequencer();
    const states = result.current.state.trackStates;
    expect(states.bd.name).toBe('BD');
    expect(states.sd.name).toBe('SD');
    expect(states.ac.name).toBe('ACCENT');
  });
});

// -------------------------------------------------------
// B. Action isolation
// -------------------------------------------------------
describe('action isolation', () => {
  it('setBpm changes only bpm', () => {
    const { result } = renderSequencer();
    const before = result.current.meta.config;
    act(() => {
      result.current.actions.setBpm(150);
    });
    const after = result.current.meta.config;
    expect(after.bpm).toBe(150);
    expect(after.tracks).toEqual(before.tracks);
    expect(after.mixer).toEqual(before.mixer);
    expect(after.kitId).toBe(before.kitId);
  });

  it('toggleStep flips only targeted bit', () => {
    const { result } = renderSequencer();
    const before = result.current.meta.config;
    const originalBd = before.tracks.bd.steps;
    const originalBit = originalBd[0];
    const expectedBit = originalBit === '1' ? '0' : '1';

    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });

    const after = result.current.meta.config;
    expect(after.tracks.bd.steps[0]).toBe(expectedBit);
    // Rest of bd string unchanged
    expect(after.tracks.bd.steps.slice(1)).toBe(originalBd.slice(1));
    // Other tracks unchanged
    expect(after.tracks.sd.steps).toBe(before.tracks.sd.steps);
    expect(after.mixer).toEqual(before.mixer);
  });

  it('setStep activates a step', () => {
    const { result } = renderSequencer();
    // Ensure bd step 5 is off first
    act(() => {
      result.current.actions.setStep('bd', 5, '0');
    });
    expect(
      result.current.meta.config.tracks.bd.steps[5]
    ).toBe('0');

    act(() => {
      result.current.actions.setStep('bd', 5, '1');
    });
    expect(
      result.current.meta.config.tracks.bd.steps[5]
    ).toBe('1');
  });

  it('setStep deactivates a step', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setStep('bd', 0, '1');
    });
    act(() => {
      result.current.actions.setStep('bd', 0, '0');
    });
    expect(
      result.current.meta.config.tracks.bd.steps[0]
    ).toBe('0');
  });

  it('setStep is a no-op when value already matches', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setStep('bd', 0, '1');
    });
    const before = result.current.meta.config;
    act(() => {
      result.current.actions.setStep('bd', 0, '1');
    });
    // Same reference — no state change
    expect(result.current.meta.config).toBe(before);
  });

  it('setStep is a no-op beyond track length', () => {
    const { result } = renderSequencer();
    const before = result.current.meta.config;
    act(() => {
      result.current.actions.setStep('bd', 99, '1');
    });
    expect(result.current.meta.config).toBe(before);
  });

  it('toggleStep marks the preset modified', () => {
    const { result } = renderSequencer();
    // Initially should be first preset
    expect(
      result.current.state.selectedPatternId
    ).toBe(patternsData.patterns[0].id);

    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(`${patternsData.patterns[0].id}*`);
  });

  it('setTrackSteps replaces full step string', () => {
    const { result } = renderHook(
      () => useSequencer(), { wrapper: TestWrapper }
    );
    act(() => {
      result.current.actions.setTrackSteps(
        'bd', '1010101010101010'
      );
    });
    expect(
      result.current.meta.config.tracks.bd.steps
    ).toBe('1010101010101010');
  });

  it('setTrackSteps marks the preset modified',
    () => {
      const { result } = renderHook(
        () => useSequencer(), { wrapper: TestWrapper }
      );
      act(() => {
        result.current.actions.setTrackSteps(
          'bd', '1010101010101010'
        );
      });
      expect(
        result.current.state.selectedPatternId
      ).toBe(`${patternsData.patterns[0].id}*`);
    }
  );

  it('setPattern copies tracks and sets pattern ID', () => {
    const { result } = renderSequencer();
    const preset = patternsData.patterns[1];
    act(() => {
      result.current.actions.setPattern(
        preset as Pattern
      );
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(preset.id);
    // Each track's steps should match the preset
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.tracks[id].steps
      ).toBe(
        (preset.tracks as Record<string, { steps: string }>)[id].steps
      );
    }
  });

  it('setGain and setPan on a track mark the preset'
    + ' modified', () => {
    for (const change of [
      (r: ReturnType<typeof renderSequencer>['result']) =>
        r.current.actions.setGain('bd', 0.4),
      (r: ReturnType<typeof renderSequencer>['result']) =>
        r.current.actions.setPan('sd', 0.2),
    ]) {
      const { result } = renderSequencer();
      const presetId = patternsData.patterns[0].id;
      expect(result.current.state.selectedPatternId)
        .toBe(presetId);
      act(() => change(result));
      expect(result.current.state.selectedPatternId)
        .toBe(`${presetId}*`);
    }
  });

  it('changing the accent level keeps the preset name',
    () => {
      const { result } = renderSequencer();
      const id = result.current.state.selectedPatternId;
      act(() => {
        result.current.actions.setGain('ac', 0.8);
      });
      expect(result.current.state.selectedPatternId)
        .toBe(id);
    }
  );

  it('mute and solo keep the preset name', () => {
    const { result } = renderSequencer();
    const id = result.current.state.selectedPatternId;
    act(() => {
      result.current.actions.toggleMute('bd');
      result.current.actions.toggleSolo('sd');
    });
    expect(result.current.state.selectedPatternId)
      .toBe(id);
  });

  it('toggleMute flips only targeted track', () => {
    const { result } = renderSequencer();
    expect(
      result.current.state.trackStates.bd.isMuted
    ).toBe(false);

    act(() => {
      result.current.actions.toggleMute('bd');
    });
    expect(
      result.current.state.trackStates.bd.isMuted
    ).toBe(true);
    expect(
      result.current.state.trackStates.sd.isMuted
    ).toBe(false);
  });

  it('toggleSolo flips only targeted track', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleSolo('sd');
    });
    expect(
      result.current.state.trackStates.sd.isSolo
    ).toBe(true);
    expect(
      result.current.state.trackStates.bd.isSolo
    ).toBe(false);
  });

  it('setGain changes only targeted track', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setGain('ch', 0.5);
    });
    expect(
      result.current.state.trackStates.ch.gain
    ).toBe(0.5);
    expect(
      result.current.state.trackStates.bd.gain
    ).toBe(1);
  });

});

// -------------------------------------------------------
// C. Pattern state machine
// -------------------------------------------------------
describe('pattern state machine', () => {
  it('initial pattern matches first preset', () => {
    const { result } = renderSequencer();
    expect(
      result.current.state.selectedPatternId
    ).toBe(patternsData.patterns[0].id);
  });

  it('after toggleStep, pattern is marked modified', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(`${patternsData.patterns[0].id}*`);
  });

  it('after setPattern, pattern ID is preset.id', () => {
    const { result } = renderSequencer();
    const preset = patternsData.patterns[2];
    act(() => {
      result.current.actions.setPattern(
        preset as Pattern
      );
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(preset.id);
  });

  it('setPattern then toggleStep -> modified', () => {
    const { result } = renderSequencer();
    const preset = patternsData.patterns[2];
    act(() => {
      result.current.actions.setPattern(
        preset as Pattern
      );
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(preset.id);

    act(() => {
      result.current.actions.toggleStep('sd', 3);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(`${preset.id}*`);

    // A second edit doesn't add a second mark, and
    // loading the preset again clears it.
    act(() => {
      result.current.actions.toggleStep('sd', 4);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(`${preset.id}*`);
    act(() => {
      result.current.actions.setPattern(
        preset as Pattern
      );
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(preset.id);
  });
});

// -------------------------------------------------------
// E. setPatternLength track length behavior
// -------------------------------------------------------
describe('setPatternLength track lengths', () => {
  it('shrinking caps tracks exceeding new length', () => {
    const { result } = renderSequencer();
    // Default: all tracks at 16
    act(() => {
      result.current.actions.setPatternLength(8);
    });
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.tracks[id].steps.length
      ).toBe(8);
    }
  });

  it('shrinking preserves shorter track step strings', () => {
    const { result } = renderSequencer();
    // Set bd to custom length 6
    act(() => {
      result.current.actions.setTrackLength('bd', 6);
    });
    expect(
      result.current.meta.config.tracks.bd.steps.length
    ).toBe(6);
    // Shrink pattern from 16 to 10
    act(() => {
      result.current.actions.setPatternLength(10);
    });
    // bd should still have length 6
    expect(
      result.current.meta.config.tracks.bd.steps.length
    ).toBe(6);
  });

  it('growing expands ALL tracks to new length', () => {
    const { result } = renderSequencer();
    // Shrink to 8 (all tracks follow to 8)
    act(() => {
      result.current.actions.setPatternLength(8);
    });
    // Set bd to a custom shorter length
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
    });
    // Grow to 12 — ALL tracks should extend to 12
    act(() => {
      result.current.actions.setPatternLength(12);
    });
    expect(
      result.current.meta.config.tracks.bd.steps.length
    ).toBe(12);
    expect(
      result.current.meta.config.tracks.sd.steps.length
    ).toBe(12);
    expect(
      result.current.meta.config.tracks.ch.steps.length
    ).toBe(12);
  });

  it('accepts pattern length up to 64', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternLength(32);
    });
    const patLen = getPatternLength(
      result.current.meta.config.tracks
    );
    expect(patLen).toBe(32);
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.tracks[id].steps.length
      ).toBe(32);
    }
  });

  it('clamps pattern length at 64', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternLength(100);
    });
    const patLen = getPatternLength(
      result.current.meta.config.tracks
    );
    expect(patLen).toBe(64);
  });
});

// -------------------------------------------------------
// F. clearAll and setSwing actions
// -------------------------------------------------------
describe('clearAll', () => {
  it('sets all track steps to zeros', () => {
    const { result } = renderSequencer();
    // First set some steps active
    act(() => {
      result.current.actions.toggleStep('bd', 0);
      result.current.actions.toggleStep('sd', 4);
    });
    act(() => {
      result.current.actions.clearAll();
    });
    for (const id of TRACK_IDS) {
      const steps =
        result.current.meta.config.tracks[id].steps;
      expect(steps).toMatch(/^0+$/);
    }
  });

  it('resets swing to 0', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(50);
    });
    expect(result.current.meta.config.swing).toBe(50);
    act(() => {
      result.current.actions.clearAll();
    });
    expect(result.current.meta.config.swing).toBe(0);
  });

  it('resets all tracks to 16 steps', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
      result.current.actions.setTrackLength('sd', 8);
    });
    act(() => {
      result.current.actions.clearAll();
    });
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.tracks[id].steps.length
      ).toBe(16);
    }
  });

  it('sets pattern to custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.clearAll();
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('custom');
  });
});

// -------------------------------------------------------
// F2. clearTrack
// -------------------------------------------------------
describe('clearTrack', () => {
  it('clears steps to all zeros for target track only', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('bd', 0);
      result.current.actions.toggleStep('bd', 4);
      result.current.actions.toggleStep('sd', 2);
    });
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    const bdSteps =
      result.current.meta.config.tracks.bd.steps;
    expect(bdSteps).toMatch(/^0+$/);
    // sd should still have its step active
    expect(
      result.current.meta.config.tracks.sd.steps[2]
    ).toBe('1');
  });

  it('resets track to 16 steps', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
    });
    expect(
      result.current.meta.config.tracks.bd.steps.length
    ).toBe(5);
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.tracks.bd.steps.length
    ).toBe(16);
  });

  it('removes trig conditions for target track only', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('bd', 0);
      result.current.actions.toggleStep('sd', 0);
      result.current.actions.setTrigCondition(
        'bd', 0, { probability: 50 }
      );
      result.current.actions.setTrigCondition(
        'sd', 0, { probability: 75 }
      );
    });
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.tracks.bd.trigConditions
    ).toBeUndefined();
    expect(
      result.current.meta.config.tracks.sd.trigConditions
    ).toBeDefined();
  });

  it('resets freeRun to false for target track', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleFreeRun('bd');
    });
    expect(
      result.current.meta.config.tracks.bd.freeRun
    ).toBe(true);
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.tracks.bd.freeRun
    ).toBeUndefined();
  });

  it('leaves other tracks untouched', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('sd', 2);
      result.current.actions.setTrackLength('sd', 8);
      result.current.actions.toggleFreeRun('sd');
    });
    const sdBefore = {
      steps:
        result.current.meta.config.tracks.sd.steps,
      length:
        result.current.meta.config.tracks.sd.steps.length,
      freeRun:
        result.current.meta.config.tracks.sd.freeRun,
    };
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.tracks.sd.steps
    ).toBe(sdBefore.steps);
    expect(
      result.current.meta.config.tracks.sd.steps.length
    ).toBe(sdBefore.length);
    expect(
      result.current.meta.config.tracks.sd.freeRun
    ).toBe(sdBefore.freeRun);
  });

  it('marks the selected preset modified', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe(`${patternsData.patterns[0].id}*`);
  });
});

describe('setSwing', () => {
  it('updates swing value', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(75);
    });
    expect(result.current.meta.config.swing).toBe(75);
  });

  it('clamps below 0', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(-10);
    });
    expect(result.current.meta.config.swing).toBe(0);
  });

  it('clamps above 100', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(150);
    });
    expect(result.current.meta.config.swing).toBe(100);
  });

  it('setPattern does not reset swing', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(60);
    });
    const preset = patternsData.patterns[1];
    act(() => {
      result.current.actions.setPattern(
        preset as Pattern
      );
    });
    expect(result.current.meta.config.swing).toBe(60);
  });
});

// -------------------------------------------------------
// G. Fill state
// -------------------------------------------------------
describe('fill state', () => {
  it('initial fill state is off', () => {
    const { result } = renderSequencer();
    expect(
      result.current.state.isFillActive
    ).toBe(false);
    expect(
      result.current.state.fillMode
    ).toBe('off');
  });

  it('toggleFillLatch toggles fill active', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleFillLatch();
    });
    expect(
      result.current.state.isFillActive
    ).toBe(true);
    expect(
      result.current.state.fillMode
    ).toBe('latched');
    act(() => {
      result.current.actions.toggleFillLatch();
    });
    expect(
      result.current.state.isFillActive
    ).toBe(false);
    expect(
      result.current.state.fillMode
    ).toBe('off');
  });

  it('setFillHeld(true) activates fill', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setFillHeld(true);
    });
    expect(
      result.current.state.isFillActive
    ).toBe(true);
    expect(
      result.current.state.fillMode
    ).toBe('momentary');
  });

  it('setFillHeld(false) clears latch too', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleFillLatch();
    });
    expect(
      result.current.state.isFillActive
    ).toBe(true);
    act(() => {
      result.current.actions.setFillHeld(false);
    });
    expect(
      result.current.state.isFillActive
    ).toBe(false);
  });

  it('steps added while latched or held get Fill', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setTrackSteps(
        'bd', '0'.repeat(16)
      );
      result.current.actions.toggleFillLatch();
    });
    act(() => {
      result.current.actions.toggleStep('bd', 1);
    });
    act(() => {
      result.current.actions.toggleFillLatch();
    });
    act(() => {
      result.current.actions.setFillHeld(true);
    });
    act(() => {
      result.current.actions.setStep('bd', 2, '1');
    });
    act(() => {
      result.current.actions.setFillHeld(false);
    });
    act(() => {
      result.current.actions.toggleStep('bd', 3);
    });
    const conds =
      result.current.meta.config.tracks.bd.trigConditions;
    expect(conds?.[1]).toEqual({ fill: 'fill' });
    expect(conds?.[2]).toEqual({ fill: 'fill' });
    expect(conds?.[3]).toBeUndefined();
  });

  it('clearAll resets fill state', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleFillLatch();
    });
    expect(
      result.current.state.isFillActive
    ).toBe(true);
    act(() => {
      result.current.actions.clearAll();
    });
    expect(
      result.current.state.isFillActive
    ).toBe(false);
    expect(
      result.current.state.fillMode
    ).toBe('off');
  });

  it('fill state not in config (transient)', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleFillLatch();
    });
    const config = result.current.meta.config;
    expect(
      'isFillActive' in config
    ).toBe(false);
    expect(
      'fillMode' in config
    ).toBe(false);
  });
});

// -------------------------------------------------------
// D. URL hash import
// -------------------------------------------------------
describe('URL hash import', () => {
  beforeEach(() => {
    // Reset hash before each test
    window.location.hash = '';
  });

  it('valid hash sets config and pattern to custom', async () => {
    const config = defaultConfig();
    config.bpm = 180;
    config.kitId = 'electro';
    const hash = await encodeConfig(config);
    window.location.hash = hash;

    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.meta.config.bpm).toBe(180);
    });
    expect(result.current.meta.config.kitId).toBe('electro');
    expect(
      result.current.state.selectedPatternId
    ).toBe('custom');
  });

  it('corrupted hash falls back to defaults', async () => {
    window.location.hash = 'CORRUPTED_INVALID_HASH';
    const { result } = renderSequencer();
    // Wait a tick for the async decode to settle
    await waitFor(() => {
      expect(result.current.meta.config).toBeDefined();
    });
    const defaults = defaultConfig();
    expect(result.current.meta.config.bpm).toBe(defaults.bpm);
    expect(result.current.meta.config.kitId).toBe(defaults.kitId);
  });

  it('empty hash uses defaults', () => {
    window.location.hash = '';
    const { result } = renderSequencer();
    const defaults = defaultConfig();
    expect(result.current.meta.config.bpm).toBe(defaults.bpm);
    expect(result.current.meta.config.kitId).toBe(defaults.kitId);
    expect(
      result.current.state.selectedPatternId
    ).toBe(patternsData.patterns[0].id);
  });

  it('hash with invalid fields merges with defaults', async () => {
    // Encode a config with an invalid kitId
    const config = defaultConfig();
    const raw = { ...config, kitId: 'nonexistent', bpm: 999 };
    const json = JSON.stringify(raw);
    const stream = new Blob([json]).stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(
      await new Response(stream).arrayBuffer()
    );
    let binary = '';
    for (const b of bytes) {
      binary += String.fromCharCode(b);
    }
    const hash = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    window.location.hash = hash;
    const { result } = renderSequencer();
    await waitFor(() => {
      expect(
        result.current.state.selectedPatternId
      ).toBe('custom');
    });
    // kitId should fall back to 808, bpm clamped to 300
    expect(result.current.meta.config.kitId).toBe('808');
    expect(result.current.meta.config.bpm).toBe(300);
  });

  it('v4 hash with trigConditions sets conditions in state',
    async () => {
      const config = defaultConfig();
      // Set trigConditions on individual tracks
      config.tracks.bd = {
        ...config.tracks.bd,
        trigConditions: { 0: { probability: 50 } },
      };
      config.tracks.sd = {
        ...config.tracks.sd,
        trigConditions: {
          3: { cycle: { a: 1, b: 4 } },
        },
      };
      const hash = await encodeConfig(config);
      window.location.hash = hash;

      const { result } = renderSequencer();
      await waitFor(() => {
        expect(
          result.current.meta.config
            .tracks.bd.trigConditions?.[0]
        ).toBeDefined();
      });
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions![0]
      ).toEqual(
        { probability: 50 }
      );
      expect(
        result.current.meta.config
          .tracks.sd.trigConditions![3]
      ).toEqual(
        { cycle: { a: 1, b: 4 } }
      );
    }
  );
});

// -------------------------------------------------------
// H. Pattern mode state
// -------------------------------------------------------
describe('pattern mode state', () => {
  it('initial patternMode is direct-jump', () => {
    const { result } = renderSequencer();
    expect(
      result.current.state.patternMode
    ).toBe('direct-jump');
  });

  it('initial tempState is off', () => {
    const { result } = renderSequencer();
    expect(
      result.current.state.tempState
    ).toBe('off');
  });

  it('setPatternMode changes mode', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternMode(
        'direct-start'
      );
    });
    expect(
      result.current.state.patternMode
    ).toBe('direct-start');
    act(() => {
      result.current.actions.setPatternMode(
        'direct-jump'
      );
    });
    expect(
      result.current.state.patternMode
    ).toBe('direct-jump');
  });

  it('toggleTemp arms and disarms', () => {
    const { result } = renderSequencer();
    // Need to be playing for temp to arm
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.toggleTemp();
    });
    expect(
      result.current.state.tempState
    ).toBe('armed');
    act(() => {
      result.current.actions.toggleTemp();
    });
    expect(
      result.current.state.tempState
    ).toBe('off');
  });

  it('toggleTemp does nothing when stopped', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleTemp();
    });
    expect(
      result.current.state.tempState
    ).toBe('off');
  });

  it('patternMode not in config (transient)', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternMode(
        'direct-start'
      );
    });
    const config = result.current.meta.config;
    expect(
      'patternMode' in config
    ).toBe(false);
  });

  it('clearAll resets temp state', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.toggleTemp();
    });
    expect(
      result.current.state.tempState
    ).toBe('armed');
    act(() => {
      result.current.actions.clearAll();
    });
    expect(
      result.current.state.tempState
    ).toBe('off');
  });
});

// -------------------------------------------------------
// I. Pattern switch logic
// -------------------------------------------------------

/** Create a minimal test pattern with all tracks having
 *  TrackConfig. bd gets the provided steps, others zeros. */
function makePattern(
  id: string, bdSteps: string
): Pattern {
  const tracks = {} as Record<TrackId, TrackConfig>;
  for (const tid of TRACK_IDS) {
    tracks[tid] = {
      steps: tid === 'bd'
        ? bdSteps
        : '0'.repeat(bdSteps.length),
    };
  }
  return { id, name: id, tracks };
}

describe('pattern switch logic', () => {
  it('stopped: setPattern applies immediately regardless'
    + ' of mode', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternMode(
        'sequential'
      );
    });
    const pat = makePattern(
      'test', '1010101010101010'
    );
    act(() => {
      result.current.actions.setPattern(pat);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('test');
  });

  it('playing + sequential: setPattern queues, does not'
    + ' apply immediately', () => {
    const { result } = renderSequencer();
    const original =
      result.current.state.selectedPatternId;
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'sequential'
      );
    });
    const pat = makePattern(
      'queued', '1111000011110000'
    );
    act(() => {
      result.current.actions.setPattern(pat);
    });
    // Pattern should NOT have changed yet
    expect(
      result.current.state.selectedPatternId
    ).toBe(original);
  });

  it('playing + direct-start: setPattern applies'
    + ' immediately', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'direct-start'
      );
    });
    const pat = makePattern(
      'direct', '1100110011001100'
    );
    act(() => {
      result.current.actions.setPattern(pat);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('direct');
  });

  it('playing + direct-jump: setPattern applies'
    + ' immediately', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'direct-jump'
      );
    });
    const pat = makePattern(
      'jump', '1010101010101010'
    );
    act(() => {
      result.current.actions.setPattern(pat);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('jump');
  });

  it('playing + sequential: re-selecting replaces'
    + ' pending', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'sequential'
      );
    });
    const pat1 = makePattern(
      'first', '1111111111111111'
    );
    const pat2 = makePattern(
      'second', '0000000000000000'
    );
    act(() => {
      result.current.actions.setPattern(pat1);
    });
    act(() => {
      result.current.actions.setPattern(pat2);
    });
    // Second selection replaces the first
    // (no playlist).
    expect(result.current.state.pendingPatternId)
      .toBe('second');
  });

  it('playing + temp armed + direct-start: takes'
    + ' snapshot and applies', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'direct-start'
      );
    });
    act(() => {
      result.current.actions.toggleTemp();
    });
    expect(
      result.current.state.tempState
    ).toBe('armed');
    const pat = makePattern(
      'temp-pat', '1010101010101010'
    );
    act(() => {
      result.current.actions.setPattern(pat);
    });
    expect(
      result.current.state.tempState
    ).toBe('active');
    expect(
      result.current.state.selectedPatternId
    ).toBe('temp-pat');
  });

  it('stop during temp active reverts to home', () => {
    const { result } = renderSequencer();
    // Load a known pattern first
    const home = (
      patternsData.patterns as Pattern[]
    )[0];
    act(() => {
      result.current.actions.setPattern(home);
    });
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'direct-start'
      );
    });
    act(() => {
      result.current.actions.toggleTemp();
    });
    const tempPat = makePattern(
      'temp', '1111111111111111'
    );
    act(() => {
      result.current.actions.setPattern(tempPat);
    });
    expect(
      result.current.state.tempState
    ).toBe('active');
    // Stop should revert
    act(() => {
      result.current.actions.togglePlay();
    });
    expect(
      result.current.state.tempState
    ).toBe('off');
    // Steps should match the home pattern
    expect(
      result.current.meta.config.tracks.bd.steps
    ).toBe(home.tracks.bd.steps);
  });
});

// -------------------------------------------------
// Pattern presets reset track volume and pan
// -------------------------------------------------
describe('pattern preset resets track levels', () => {
  /** Move bd and sd off their default levels, mute
   *  ch, and lower the accent level. */
  function moveLevels(
    r: ReturnType<typeof renderSequencer>['result']
  ) {
    act(() => {
      r.current.actions.setGain('bd', 0.3);
      r.current.actions.setPan('bd', 0.1);
      r.current.actions.setPan('sd', 0.9);
      r.current.actions.toggleMute('ch');
      r.current.actions.setGain('ac', 0.2);
    });
  }

  function expectDefaultLevels(
    r: ReturnType<typeof renderSequencer>['result']
  ) {
    const mixer = r.current.meta.config.mixer;
    expect(mixer.bd.gain).toBe(1);
    expect(mixer.bd.pan).toBe(0.5);
    expect(mixer.sd.pan).toBe(0.5);
    // Mute and the accent level are kept
    expect(mixer.ch.isMuted).toBe(true);
    expect(mixer.ac.gain).toBe(0.2);
  }

  it('stopped: loading a preset resets levels', () => {
    const { result } = renderSequencer();
    moveLevels(result);
    act(() => {
      result.current.actions.setPattern(
        makePattern('p', '1000100010001000')
      );
    });
    expectDefaultLevels(result);
  });

  it('playing + direct-jump: resets levels', () => {
    const { result } = renderSequencer();
    moveLevels(result);
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPattern(
        makePattern('p', '1000100010001000')
      );
    });
    expectDefaultLevels(result);
  });

  it('playing + sequential: levels wait for the cued'
    + ' pattern', () => {
    const { result } = renderSequencer();
    moveLevels(result);
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.setPatternMode(
        'sequential'
      );
    });
    act(() => {
      result.current.actions.setPattern(
        makePattern('p', '1000100010001000')
      );
    });
    // Still cued: the playing pattern keeps its levels
    expect(
      result.current.meta.config.mixer.bd.gain
    ).toBe(0.3);
  });

  it('a preset with its own levels sets them', () => {
    const { result } = renderSequencer();
    moveLevels(result);
    const pat: Pattern = {
      ...makePattern('p', '1000100010001000'),
      mixer: { bd: { gain: 0.6, pan: 0.25 }, oh: { pan: 0.8 } },
    };
    act(() => {
      result.current.actions.setPattern(pat);
    });
    const mixer = result.current.meta.config.mixer;
    expect(mixer.bd.gain).toBe(0.6);
    expect(mixer.bd.pan).toBe(0.25);
    expect(mixer.oh.gain).toBe(1);
    expect(mixer.oh.pan).toBe(0.8);
    expect(mixer.sd.pan).toBe(0.5);
    expect(mixer.ch.isMuted).toBe(true);
  });

  it('stop during temp brings back home levels', () => {
    const { result } = renderSequencer();
    moveLevels(result);
    act(() => {
      result.current.actions.togglePlay();
    });
    act(() => {
      result.current.actions.toggleTemp();
    });
    act(() => {
      result.current.actions.setPattern(
        makePattern('temp', '1111111111111111')
      );
    });
    expectDefaultLevels(result);
    act(() => {
      result.current.actions.togglePlay();
    });
    const mixer = result.current.meta.config.mixer;
    expect(mixer.bd.gain).toBe(0.3);
    expect(mixer.bd.pan).toBe(0.1);
    expect(mixer.sd.pan).toBe(0.9);
  });
});

// -------------------------------------------------
// setParameterLock merging
// -------------------------------------------------
describe('setParameterLock merging', () => {
  it('setting gain preserves existing pan lock', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setParameterLock(
        'bd', 0, { pan: 0.3 }
      );
    });
    act(() => {
      result.current.actions.setParameterLock(
        'bd', 0, { gain: 0.7 }
      );
    });
    const locks =
      result.current.meta.config.tracks.bd
        .parameterLocks?.[0];
    expect(locks).toEqual({ pan: 0.3, gain: 0.7 });
  });

  it('setting pan preserves existing gain lock', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setParameterLock(
        'bd', 0, { gain: 0.5 }
      );
    });
    act(() => {
      result.current.actions.setParameterLock(
        'bd', 0, { pan: 0.8 }
      );
    });
    const locks =
      result.current.meta.config.tracks.bd
        .parameterLocks?.[0];
    expect(locks).toEqual({ gain: 0.5, pan: 0.8 });
  });

  it(
    'clearParameterLock removes all locks for step',
    () => {
      const { result } = renderSequencer();
      act(() => {
        result.current.actions.setParameterLock(
          'bd', 0, { gain: 0.5, pan: 0.3 }
        );
      });
      act(() => {
        result.current.actions.clearParameterLock(
          'bd', 0
        );
      });
      const locks =
        result.current.meta.config.tracks.bd
          .parameterLocks;
      expect(locks).toBeUndefined();
    }
  );
});

// -------------------------------------------------------
// Autosave and restore (#120)
// -------------------------------------------------------
describe('autosave and restore', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('saves edits to localStorage', async () => {
    const { result } = renderSequencer();
    await act(async () => {
      result.current.actions.setBpm(142);
    });
    await waitFor(() => {
      const session = loadSession();
      expect(session?.config.bpm).toBe(142);
    });
  });

  it('restores the saved session on mount', async () => {
    const config = defaultConfig();
    config.bpm = 97;
    saveSession({ config, selectedPatternId: 'custom' });

    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.meta.config.bpm).toBe(97);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('custom');
  });

  it('a share link wins over the saved session and is'
    + ' cleared from the URL', async () => {
    const saved = defaultConfig();
    saved.bpm = 97;
    saveSession({ config: saved, selectedPatternId: 'x' });

    const shared = defaultConfig();
    shared.bpm = 150;
    window.location.hash = await encodeConfig(shared);

    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.meta.config.bpm).toBe(150);
    });
    expect(window.location.hash).toBe('');
  });

  it('an invalid share link falls back to the saved'
    + ' session', async () => {
    const saved = defaultConfig();
    saved.bpm = 97;
    saveSession({ config: saved, selectedPatternId: 'x' });
    window.location.hash = 'NOT_A_VALID_LINK';

    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.meta.config.bpm).toBe(97);
    });
  });

  it('does not overwrite the saved session with'
    + ' defaults before restoring', async () => {
    const saved = defaultConfig();
    saved.bpm = 97;
    saveSession({ config: saved, selectedPatternId: 'x' });

    renderSequencer();
    await new Promise(r => setTimeout(r, 400));
    expect(loadSession()?.config.bpm).toBe(97);
  });

  it('imports a share link pasted into an open tab',
    async () => {
      const { result } = renderSequencer();
      const shared = defaultConfig();
      shared.bpm = 133;
      const hash = await encodeConfig(shared);

      await act(async () => {
        window.location.hash = hash;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      await waitFor(() => {
        expect(result.current.meta.config.bpm).toBe(133);
      });
    }
  );

  it('an old-version share link keeps the saved session'
    + ' and shows a notice', async () => {
    const saved = defaultConfig();
    saved.bpm = 97;
    saveSession({ config: saved, selectedPatternId: 'x' });
    window.location.hash = await encodeRaw({
      ...defaultConfig(), version: 3, bpm: 150,
    });

    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.state.importNotice)
        .toMatch(/older version/);
    });
    expect(result.current.meta.config.bpm).toBe(97);
    expect(window.location.hash).toBe('');
  });

  it('a newer-version share link loads with a notice',
    async () => {
      window.location.hash = await encodeRaw({
        ...defaultConfig(), version: 99, bpm: 150,
      });

      const { result } = renderSequencer();
      await waitFor(() => {
        expect(result.current.meta.config.bpm).toBe(150);
      });
      expect(result.current.state.importNotice)
        .toMatch(/newer version/);

      await act(async () => {
        result.current.actions.dismissImportNotice();
      });
      expect(result.current.state.importNotice).toBeNull();
    }
  );

  it('an invalid share link shows a notice', async () => {
    window.location.hash = 'NOT_A_VALID_LINK';
    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.state.importNotice)
        .toMatch(/damaged/);
    });
  });

  it('a current share link shows no notice', async () => {
    const shared = defaultConfig();
    shared.bpm = 150;
    window.location.hash = await encodeConfig(shared);
    const { result } = renderSequencer();
    await waitFor(() => {
      expect(result.current.meta.config.bpm).toBe(150);
    });
    expect(result.current.state.importNotice).toBeNull();
  });

  it('ignores corrupted saved data', async () => {
    window.localStorage.setItem(
      CONFIG_STORAGE_KEY, '{not json'
    );
    const { result } = renderSequencer();
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.meta.config.bpm)
      .toBe(defaultConfig().bpm);
  });
});

// -------------------------------------------------------
// Context value memoization (#126)
// -------------------------------------------------------
describe('context value memoization', () => {
  it('keeps the same value when nothing changed',
    async () => {
      const { result, rerender } = renderSequencer();
      await waitFor(() => {
        expect(result.current.state.isLoaded).toBe(true);
      });
      const before = result.current;
      rerender();
      expect(result.current).toBe(before);
    }
  );

  it('keeps actions stable across config edits',
    async () => {
      const { result } = renderSequencer();
      const actions = result.current.actions;
      await act(async () => {
        result.current.actions.setBpm(133);
      });
      expect(result.current.meta.config.bpm).toBe(133);
      expect(result.current.actions).toBe(actions);
    }
  );
});

// -------------------------------------------------------
// Minimized tracks (view state only)
// -------------------------------------------------------
describe('minimized tracks', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('Reset opens every row', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.minimizeEmptyTracks();
    });
    expect(result.current.state.minimizedTracks.size)
      .toBeGreaterThan(0);
    act(() => {
      result.current.actions.clearAll();
    });
    expect(result.current.state.minimizedTracks.size)
      .toBe(0);
  });

  it('a pattern load keeps still-empty tracks minimized',
    () => {
      const { result } = renderSequencer();
      act(() => {
        result.current.actions.minimizeEmptyTracks();
      });
      const next = patternsData.patterns.find(p =>
        p.tracks.sd.steps.includes('1')
        && !p.tracks.ch.steps.includes('1')
      );
      expect(next).toBeDefined();
      act(() => {
        result.current.actions.setPattern(next as Pattern);
      });
      const shown = result.current.state.minimizedTracks;
      expect(shown.has('sd')).toBe(false);
      expect(shown.has('ch')).toBe(true);
    });

  it('never reaches the saved session or share link',
    async () => {
      const { result } = renderSequencer();
      act(() => {
        result.current.actions.minimizeEmptyTracks();
      });
      await act(async () => {
        result.current.actions.setBpm(133);
      });
      await waitFor(() => {
        expect(loadSession()?.config.bpm).toBe(133);
      });
      expect(JSON.stringify(loadSession()))
        .not.toMatch(/minimi/i);
      expect(Object.keys(result.current.meta.config))
        .toEqual(Object.keys(defaultConfig()));
    });
});

// -------------------------------------------------------
// Auto-minimize empty tracks setting
// -------------------------------------------------------
describe('auto-minimize empty tracks', () => {
  beforeEach(() => {
    window.location.hash = '';
    gridPrefs.resetForTests();
  });

  /** A preset with some empty tracks, and its empty ids. */
  function presetWithEmptyTracks() {
    const pattern = patternsData.patterns.find(p =>
      p.tracks.bd.steps.includes('1')
      && !p.tracks.ch.steps.includes('1')
    ) as Pattern;
    const empty = TRACK_IDS.filter(id =>
      id !== 'ac' && !pattern.tracks[id].steps.includes('1')
    );
    return { pattern, empty };
  }

  it('is off by default', () => {
    const { result } = renderSequencer();
    expect(result.current.state.autoMinimize).toBe(false);
    const { pattern } = presetWithEmptyTracks();
    act(() => {
      result.current.actions.setPattern(pattern);
    });
    expect(result.current.state.minimizedTracks.size)
      .toBe(0);
  });

  it('minimizes the empty tracks of a loaded preset', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setAutoMinimize(true);
    });
    act(() => {
      result.current.actions.restoreAllTracks();
    });
    const { pattern, empty } = presetWithEmptyTracks();
    act(() => {
      result.current.actions.setPattern(pattern);
    });
    expect([...result.current.state.minimizedTracks].sort())
      .toEqual([...empty].sort());
  });

  it('minimizes a track when its last step is removed',
    () => {
      const { result } = renderSequencer();
      const { pattern } = presetWithEmptyTracks();
      act(() => {
        result.current.actions.setAutoMinimize(true);
        result.current.actions.setPattern(pattern);
      });
      const steps = result.current.meta.config.tracks.bd.steps;
      act(() => {
        for (let i = 0; i < steps.length; i++) {
          if (steps[i] === '1') {
            result.current.actions.setStep('bd', i, '0');
          }
        }
      });
      expect(result.current.state.minimizedTracks.has('bd'))
        .toBe(true);
    });

  it('waits until the pointer leaves the row', () => {
    const { result } = renderSequencer();
    const { pattern } = presetWithEmptyTracks();
    act(() => {
      result.current.actions.setAutoMinimize(true);
      result.current.actions.setPattern(pattern);
    });
    act(() => {
      result.current.actions.holdAutoMinimize('bd');
    });
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(result.current.state.minimizedTracks.has('bd'))
      .toBe(false);
    act(() => {
      result.current.actions.holdAutoMinimize(null);
    });
    expect(result.current.state.minimizedTracks.has('bd'))
      .toBe(true);
  });

  it('Reset opens every row with the setting on', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setAutoMinimize(true);
    });
    expect(result.current.state.minimizedTracks.size)
      .toBeGreaterThan(0);
    act(() => {
      result.current.actions.clearAll();
    });
    expect(result.current.state.minimizedTracks.size)
      .toBe(0);
  });

  it('H and Shift+H still work with the setting on', () => {
    const { result } = renderSequencer();
    act(() => {
      setAutoMinimize(true);
    });
    act(() => {
      result.current.actions.restoreAllTracks();
    });
    expect(result.current.state.minimizedTracks.size)
      .toBe(0);
    act(() => {
      result.current.actions.minimizeEmptyTracks();
    });
    expect(result.current.state.minimizedTracks.size)
      .toBeGreaterThan(0);
  });
});

// -------------------------------------------------------
// Custom samples (memory only, kept by Reset and kits)
// -------------------------------------------------------
describe('custom samples', () => {
  const wav = () =>
    new File(['x'], 'kick.wav', { type: 'audio/wav' });

  it('loads a sample onto a track', async () => {
    const { result } = renderSequencer();
    const file = wav();
    await act(() =>
      result.current.actions.loadSample('sd', file)
    );
    expect(result.current.state.customSamples.sd).toBe(file);
  });

  it('Reset keeps custom samples', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    act(() => result.current.actions.clearAll());
    expect(result.current.state.customSamples.sd)
      .toBeDefined();
  });

  it('a kit change keeps custom samples', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    const electro = kitsData.kits.find(
      k => k.id === 'electro'
    )!;
    act(() => result.current.actions.setKit(electro));
    expect(result.current.state.currentKit.id)
      .toBe('electro');
    expect(result.current.state.customSamples.sd)
      .toBeDefined();
  });

  it('exposes a refused file as sampleError', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample(
        'sd', new File(['x'], 'a.aif')
      )
    );
    expect(result.current.state.sampleError).toBe(
      'Only WAV samples are supported (got a.aif).'
    );
    act(() => result.current.actions.dismissSampleError());
    expect(result.current.state.sampleError).toBeNull();
  });

  it('resetAllSamples clears every track', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    act(() => result.current.actions.resetAllSamples());
    expect(result.current.state.customSamples).toEqual({});
  });

  it('keeps actions stable across a load', async () => {
    const { result } = renderSequencer();
    const actions = result.current.actions;
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    expect(result.current.actions).toBe(actions);
  });
});
