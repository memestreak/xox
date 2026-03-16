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
      expect(states[id].gain).toBe(1);
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
});
