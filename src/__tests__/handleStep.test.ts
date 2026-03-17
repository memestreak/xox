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

// -------------------------------------------------
// handleStep swing timing
// -------------------------------------------------
describe('handleStep swing timing', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
  });

  it('odd step with swing: time is offset', async () => {
    const { result } = renderSequencer();

    // Set swing to 50 and activate bd at step 1
    await act(async () => {
      result.current.actions.setSwing(50);
      // Clear step 0 for bd, set step 1
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.steps[id];
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.steps.bd;
      if (cur[1] === '0') {
        result.current.actions.toggleStep('bd', 1);
      }
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    // Trigger odd step (step 1) at time 1.0
    onStep(1, 1.0);

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    const scheduledTime = mockPlaySound.mock.calls[0][1];
    // BPM 110 (default): halfStep = (60/110)*0.25/2 = 0.06818
    // offset = (50/100) * 0.7 * 0.06818 = 0.02386
    expect(scheduledTime).toBeGreaterThan(1.0);
    expect(scheduledTime).toBeCloseTo(
      1.0 + 0.5 * 0.7 * ((60 / 110) * 0.25 / 2),
      4
    );
  });

  it('even step with swing: no offset', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setSwing(80);
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    // Trigger even step (step 0) at time 1.0
    onStep(0, 1.0);

    // Check that time passed to playSound is exactly
    // 1.0 (no offset for even steps)
    for (const call of mockPlaySound.mock.calls) {
      expect(call[1]).toBe(1.0);
    }
  });

  it('max swing capped by 0.7 multiplier', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setSwing(100);
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.steps[id];
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.steps.bd;
      if (cur[1] === '0') {
        result.current.actions.toggleStep('bd', 1);
      }
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(1, 1.0);

    const scheduledTime = mockPlaySound.mock.calls[0][1];
    // BPM 110: halfStep = (60/110)*0.25/2
    // Max offset = 1.0 * 0.7 * halfStep
    const halfStep = (60 / 110) * 0.25 / 2;
    const maxOffset = 0.7 * halfStep;
    expect(scheduledTime).toBeCloseTo(
      1.0 + maxOffset, 4
    );
    // Verify it's less than a full halfStep
    expect(scheduledTime - 1.0).toBeLessThan(halfStep);
  });

  it('swing offset scales with BPM', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setBpm(60);
      result.current.actions.setSwing(50);
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.steps[id];
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.steps.bd;
      if (cur[1] === '0') {
        result.current.actions.toggleStep('bd', 1);
      }
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(1, 1.0);

    const scheduledTime = mockPlaySound.mock.calls[0][1];
    // BPM 60: halfStep = (60/60)*0.25/2 = 0.125
    // offset = 0.5 * 0.7 * 0.125 = 0.04375
    const halfStep = (60 / 60) * 0.25 / 2;
    expect(scheduledTime).toBeCloseTo(
      1.0 + 0.5 * 0.7 * halfStep, 4
    );
  });

  it('zero swing: no offset on any step', async () => {
    const { result } = renderSequencer();
    // swing defaults to 0

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(1, 1.0);

    for (const call of mockPlaySound.mock.calls) {
      expect(call[1]).toBe(1.0);
    }
  });
});

// -------------------------------------------------
// trig conditions in handleStep
// -------------------------------------------------
describe('trig conditions in handleStep', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
  });

  it('step with probability condition can be suppressed',
    async () => {
      const { result } = renderSequencer();

      // Clear all, then activate bd step 0
      await act(async () => {
        result.current.actions.clearAll();
      });
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
      });

      // Set probability 50 on bd step 0
      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0, { type: 'probability', value: 50 }
        );
      });

      // Mock Math.random to return 0.99 (> 0.50)
      const randomSpy = vi.spyOn(Math, 'random')
        .mockReturnValue(0.99);

      mockPlaySound.mockClear();
      mockStart.mockClear();

      await act(async () => {
        result.current.actions.togglePlay();
      });

      const onStep = mockStart.mock.calls[0][1] as (
        step: number, time: number
      ) => void;

      await waitFor(() => {
        expect(
          result.current.state.isPlaying
        ).toBe(true);
      });
      mockPlaySound.mockClear();

      onStep(0, 0.0);

      expect(mockPlaySound).not.toHaveBeenCalled();
      randomSpy.mockRestore();
    }
  );

  it('step without condition always fires',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.clearAll();
      });
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
      });

      mockPlaySound.mockClear();
      mockStart.mockClear();

      await act(async () => {
        result.current.actions.togglePlay();
      });

      const onStep = mockStart.mock.calls[0][1] as (
        step: number, time: number
      ) => void;

      await waitFor(() => {
        expect(
          result.current.state.isPlaying
        ).toBe(true);
      });
      mockPlaySound.mockClear();

      onStep(0, 0.0);

      expect(mockPlaySound).toHaveBeenCalledTimes(1);
      expect(mockPlaySound.mock.calls[0][0]).toBe('bd');
    }
  );

  it('clearTrigCondition removes condition',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0, { type: 'probability', value: 50 }
        );
      });

      expect(
        result.current.meta.config
          .trigConditions.bd?.[0]
      ).toEqual({ type: 'probability', value: 50 });

      await act(async () => {
        result.current.actions.clearTrigCondition(
          'bd', 0
        );
      });

      expect(
        result.current.meta.config
          .trigConditions.bd?.[0]
      ).toBeUndefined();
    }
  );
});
