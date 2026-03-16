import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSequencer } from '../app/SequencerContext';
import { TRACK_IDS } from '../app/types';
import type { TrackId } from '../app/types';
import { TestWrapper } from './helpers/sequencer-wrapper';

// Mock AudioEngine -- capture the onStep callback via start()
const mockPlaySound = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: (...args: unknown[]) => mockPlaySound(...args),
    onStep: vi.fn(),
  },
}));

function renderSequencer() {
  return renderHook(() => useSequencer(), {
    wrapper: TestWrapper,
  });
}

/**
 * Helper: set up a simple pattern where specific tracks have
 * step 0 active, then trigger handleStep for step 0.
 */
async function setupAndTrigger(
  options: {
    activeTracks?: TrackId[];
    accentStep0?: boolean;
    soloTracks?: TrackId[];
    muteTracks?: TrackId[];
    gains?: Partial<Record<TrackId, number>>;
  } = {}
) {
  const {
    activeTracks = ['bd', 'sd'],
    accentStep0 = false,
    soloTracks = [],
    muteTracks = [],
    gains = {},
  } = options;

  const { result } = renderSequencer();

  // Build a pattern: set step 0 active for specified tracks
  await act(async () => {
    // First, set all tracks to inactive at step 0
    for (const id of TRACK_IDS) {
      const current = result.current.meta.config.steps[id];
      if (current[0] === '1') {
        result.current.actions.toggleStep(id, 0);
      }
    }
  });

  // Now activate the tracks we want at step 0
  await act(async () => {
    for (const id of activeTracks) {
      const current = result.current.meta.config.steps[id];
      if (current[0] === '0') {
        result.current.actions.toggleStep(id, 0);
      }
    }
    // Set accent
    if (accentStep0) {
      const acCurrent = result.current.meta.config.steps.ac;
      if (acCurrent[0] === '0') {
        result.current.actions.toggleStep('ac', 0);
      }
    }
  });

  // Set solo/mute/gain states
  await act(async () => {
    for (const id of soloTracks) {
      result.current.actions.toggleSolo(id);
    }
    for (const id of muteTracks) {
      result.current.actions.toggleMute(id);
    }
    for (const [id, value] of Object.entries(gains)) {
      result.current.actions.setGain(id as TrackId, value);
    }
  });

  // Start playback to register handleStep
  mockPlaySound.mockClear();
  mockStart.mockClear();

  await act(async () => {
    result.current.actions.togglePlay();
  });

  // Capture the onStep callback from start() call
  expect(mockStart).toHaveBeenCalled();
  const onStep = mockStart.mock.calls[0][1] as (
    step: number, time: number
  ) => void;

  // Give refs time to sync
  await waitFor(() => {
    expect(result.current.state.isPlaying).toBe(true);
  });

  // Clear any calls from the start itself
  mockPlaySound.mockClear();

  // Trigger step 0
  onStep(0, 0.0);

  return { result, mockPlaySound };
}

// -------------------------------------------------------
// handleStep solo/mute/accent logic
// -------------------------------------------------------
describe('handleStep', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
  });

  it('no solos, no mutes: all active tracks play', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd', 'sd', 'ch'],
    });
    const playedIds = mp.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(playedIds).toContain('bd');
    expect(playedIds).toContain('sd');
    expect(playedIds).toContain('ch');
    expect(playedIds).toHaveLength(3);
  });

  it('one track soloed: only that track plays', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd', 'sd', 'ch'],
      soloTracks: ['bd'],
    });
    const playedIds = mp.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(playedIds).toEqual(['bd']);
  });

  it('multiple tracks soloed: all soloed play', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd', 'sd', 'ch'],
      soloTracks: ['bd', 'ch'],
    });
    const playedIds = mp.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(playedIds).toContain('bd');
    expect(playedIds).toContain('ch');
    expect(playedIds).not.toContain('sd');
  });

  it('muted track silent when no solos', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd', 'sd'],
      muteTracks: ['bd'],
    });
    const playedIds = mp.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(playedIds).not.toContain('bd');
    expect(playedIds).toContain('sd');
  });

  it('muted AND soloed: plays (solo wins)', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd', 'sd'],
      soloTracks: ['bd'],
      muteTracks: ['bd'],
    });
    const playedIds = mp.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(playedIds).toContain('bd');
  });

  it('track with step=0: no playSound', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'], // only bd active at step 0
    });
    const playedIds = mp.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(playedIds).not.toContain('sd');
  });

  it('accent step: gain multiplied by 1.5', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      accentStep0: true,
      gains: { bd: 1.0 },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 1.0^3 * 1.5 = 1.5
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(1.5);
  });

  it('non-accent step: gain is cubic only', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      accentStep0: false,
      gains: { bd: 0.5 },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 0.5^3 = 0.125
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.125);
  });
});
