import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSequencer } from '../app/SequencerContext';
import { defaultConfig, encodeConfig } from '../app/configCodec';
import { TRACK_IDS } from '../app/types';
import type { TrackId } from '../app/types';
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
    expect(after.steps).toEqual(before.steps);
    expect(after.mixer).toEqual(before.mixer);
    expect(after.kitId).toBe(before.kitId);
  });

  it('toggleStep flips only targeted bit', () => {
    const { result } = renderSequencer();
    const before = result.current.meta.config;
    const originalBd = before.steps.bd;
    const originalBit = originalBd[0];
    const expectedBit = originalBit === '1' ? '0' : '1';

    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });

    const after = result.current.meta.config;
    expect(after.steps.bd[0]).toBe(expectedBit);
    // Rest of bd string unchanged
    expect(after.steps.bd.slice(1)).toBe(originalBd.slice(1));
    // Other tracks unchanged
    expect(after.steps.sd).toBe(before.steps.sd);
    expect(after.mixer).toEqual(before.mixer);
  });

  it('setStep activates a step', () => {
    const { result } = renderSequencer();
    // Ensure bd step 5 is off first
    act(() => {
      result.current.actions.setStep('bd', 5, '0');
    });
    expect(
      result.current.meta.config.steps.bd[5]
    ).toBe('0');

    act(() => {
      result.current.actions.setStep('bd', 5, '1');
    });
    expect(
      result.current.meta.config.steps.bd[5]
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
      result.current.meta.config.steps.bd[0]
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
      result.current.state.currentPattern.id
    ).toBe(patternsData.patterns[0].id);

    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });
    expect(
      result.current.state.currentPattern.id
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
      result.current.state.currentPattern.steps.bd
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
        result.current.state.currentPattern.id
      ).toBe('custom');
    }
  );

  it('setPattern copies steps and sets pattern ID', () => {
    const { result } = renderSequencer();
    const preset = patternsData.patterns[1];
    act(() => {
      result.current.actions.setPattern({
        id: preset.id,
        name: preset.name,
        steps: preset.steps as Record<TrackId, string>,
      });
    });
    expect(
      result.current.state.currentPattern.id
    ).toBe(preset.id);
    expect(
      result.current.meta.config.steps
    ).toEqual(preset.steps);
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
      result.current.state.currentPattern.id
    ).toBe(patternsData.patterns[0].id);
  });

  it('after toggleStep, pattern is custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('bd', 0);
    });
    expect(
      result.current.state.currentPattern.id
    ).toBe('custom');
    expect(
      result.current.state.currentPattern.name
    ).toBe('Custom');
  });

  it('after setPattern, pattern ID is preset.id', () => {
    const { result } = renderSequencer();
    const preset = patternsData.patterns[2];
    act(() => {
      result.current.actions.setPattern({
        id: preset.id,
        name: preset.name,
        steps: preset.steps as Record<TrackId, string>,
      });
    });
    expect(
      result.current.state.currentPattern.id
    ).toBe(preset.id);
  });

  it('setPattern then toggleStep -> custom', () => {
    const { result } = renderSequencer();
    const preset = patternsData.patterns[2];
    act(() => {
      result.current.actions.setPattern({
        id: preset.id,
        name: preset.name,
        steps: preset.steps as Record<TrackId, string>,
      });
    });
    expect(
      result.current.state.currentPattern.id
    ).toBe(preset.id);

    act(() => {
      result.current.actions.toggleStep('sd', 3);
    });
    expect(
      result.current.state.currentPattern.id
    ).toBe('custom');
  });
});

// -------------------------------------------------------
// E. setPatternLength track length behavior
// -------------------------------------------------------
describe('setPatternLength track lengths', () => {
  it('shrinking clamps tracks exceeding new length', () => {
    const { result } = renderSequencer();
    // Default: all tracks at 16
    act(() => {
      result.current.actions.setPatternLength(8);
    });
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.trackLengths[id]
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
      result.current.meta.config.steps.bd.length
    ).toBe(6);
    // Shrink pattern from 16 to 10
    act(() => {
      result.current.actions.setPatternLength(10);
    });
    // bd should still have length 6 and 6-char step string
    expect(
      result.current.meta.config.trackLengths.bd
    ).toBe(6);
    expect(
      result.current.meta.config.steps.bd.length
    ).toBe(6);
  });

  it('growing expands tracks that were at old max', () => {
    const { result } = renderSequencer();
    // Shrink to 8 (all tracks follow to 8)
    act(() => {
      result.current.actions.setPatternLength(8);
    });
    // Set bd to a custom shorter length
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
    });
    // Grow back to 12 — tracks at 8 (old max) should
    // expand to 12, but bd at 5 should stay at 5
    act(() => {
      result.current.actions.setPatternLength(12);
    });
    expect(
      result.current.meta.config.trackLengths.bd
    ).toBe(5);
    expect(
      result.current.meta.config.trackLengths.sd
    ).toBe(12);
    expect(
      result.current.meta.config.trackLengths.ch
    ).toBe(12);
  });

  it('accepts pattern length up to 64', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternLength(32);
    });
    expect(
      result.current.state.patternLength
    ).toBe(32);
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.trackLengths[id]
      ).toBe(32);
      expect(
        result.current.meta.config.steps[id].length
      ).toBe(32);
    }
  });

  it('clamps pattern length at 64', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setPatternLength(100);
    });
    expect(
      result.current.state.patternLength
    ).toBe(64);
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
      const steps = result.current.meta.config.steps[id];
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

  it('resets all track lengths to patternLength', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
      result.current.actions.setTrackLength('sd', 8);
    });
    act(() => {
      result.current.actions.clearAll();
    });
    const pl = result.current.state.patternLength;
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.trackLengths[id]
      ).toBe(pl);
    }
  });

  it('sets pattern to custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.clearAll();
    });
    expect(
      result.current.state.currentPattern.id
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
      result.current.meta.config.steps.bd;
    expect(bdSteps).toMatch(/^0+$/);
    // sd should still have its step active
    expect(
      result.current.meta.config.steps.sd[2]
    ).toBe('1');
  });

  it('resets track length to patternLength', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
    });
    expect(
      result.current.meta.config.trackLengths.bd
    ).toBe(5);
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.trackLengths.bd
    ).toBe(result.current.state.patternLength);
  });

  it('removes trig conditions for target track only', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('bd', 0);
      result.current.actions.toggleStep('sd', 0);
      result.current.actions.setTrigCondition(
        'bd', 0, { type: 'every', n: 2 }
      );
      result.current.actions.setTrigCondition(
        'sd', 0, { type: 'every', n: 3 }
      );
    });
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.trigConditions.bd
    ).toBeUndefined();
    expect(
      result.current.meta.config.trigConditions.sd
    ).toBeDefined();
  });

  it('resets freeRun to false for target track', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleFreeRun('bd');
    });
    expect(
      result.current.meta.config.mixer.bd.freeRun
    ).toBe(true);
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.mixer.bd.freeRun
    ).toBe(false);
  });

  it('leaves other tracks untouched', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.toggleStep('sd', 2);
      result.current.actions.setTrackLength('sd', 8);
      result.current.actions.toggleFreeRun('sd');
    });
    const sdBefore = {
      steps: result.current.meta.config.steps.sd,
      length:
        result.current.meta.config.trackLengths.sd,
      freeRun:
        result.current.meta.config.mixer.sd.freeRun,
    };
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.meta.config.steps.sd
    ).toBe(sdBefore.steps);
    expect(
      result.current.meta.config.trackLengths.sd
    ).toBe(sdBefore.length);
    expect(
      result.current.meta.config.mixer.sd.freeRun
    ).toBe(sdBefore.freeRun);
  });

  it('sets selected pattern to custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.clearTrack('bd');
    });
    expect(
      result.current.state.currentPattern.id
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
      result.current.actions.setPattern({
        id: preset.id,
        name: preset.name,
        steps: preset.steps as Record<TrackId, string>,
      });
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
      result.current.state.currentPattern.id
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
      result.current.state.currentPattern.id
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
        result.current.state.currentPattern.id
      ).toBe('custom');
    });
    // kitId should fall back to 808, bpm clamped to 300
    expect(result.current.meta.config.kitId).toBe('808');
    expect(result.current.meta.config.bpm).toBe(300);
  });

  it('v3 hash with trigConditions sets conditions in state',
    async () => {
      const config = defaultConfig();
      config.trigConditions = {
        bd: { 0: { probability: 50 } },
        sd: { 3: { cycle: { a: 1, b: 4 } } },
      };
      const hash = await encodeConfig(config);
      window.location.hash = hash;

      const { result } = renderSequencer();
      await waitFor(() => {
        expect(
          result.current.meta.config
            .trigConditions.bd?.[0]
        ).toBeDefined();
      });
      expect(
        result.current.meta.config.trigConditions.bd![0]
      ).toEqual(
        { probability: 50 }
      );
      expect(
        result.current.meta.config.trigConditions.sd![3]
      ).toEqual(
        { cycle: { a: 1, b: 4 } }
      );
    }
  );
});
