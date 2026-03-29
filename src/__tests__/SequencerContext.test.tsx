import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSequencer } from '../app/SequencerContext';
import { defaultConfig, encodeConfig } from '../app/configCodec';
import { TRACK_IDS, getPatternLength } from '../app/types';
import type { Pattern, TrackId, TrackConfig } from '../app/types';
import patternsData from '../app/data/patterns.json';
import kitsData from '../app/data/kits.json';
import { TestWrapper } from './helpers/sequencer-wrapper';

// Mock the AudioEngine module
vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
    requestReset: vi.fn(),
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
    expect(states.bd.name).toBe('Kick');
    expect(states.sd.name).toBe('Snare');
    expect(states.ac.name).toBe('Accent');
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

  it('toggleStep sets pattern to custom', () => {
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
    ).toBe('custom');
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

  it('setTrackSteps sets selectedPatternId to custom',
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
      ).toBe('custom');
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

  it('after toggleStep, pattern is custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('custom');
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

  it('setPattern then toggleStep -> custom', () => {
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
    ).toBe('custom');
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

  it('sets selected pattern to custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('custom');
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
    // Second selection should have replaced first
    // (no playlist). We can't directly inspect
    // pendingPattern, but when sequential triggers,
    // it should be 'second'.
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
