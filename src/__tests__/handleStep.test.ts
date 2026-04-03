import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSequencer } from '../app/SequencerContext';
import { TRACK_IDS } from '../app/types';
import type {
  TrackId, StepLocks, TrackConfig,
} from '../app/types';
import patternsData from '../app/data/patterns.json';
import type { Pattern } from '../app/types';
import { TestWrapper } from './helpers/sequencer-wrapper';

// Mock AudioEngine -- capture the onStep callback via start()
const mockPlaySound = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockSendNote = vi.fn();
const mockMidiStop = vi.fn();

const mockRequestReset = vi.fn();

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: (...args: unknown[]) => mockPlaySound(...args),
    requestReset: (...args: unknown[]) => mockRequestReset(...args),
    getCurrentTime: vi.fn().mockReturnValue(0),
    onStep: vi.fn(),
  },
}));

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    sendNote: (...args: unknown[]) =>
      mockSendNote(...args),
    stop: (...args: unknown[]) =>
      mockMidiStop(...args),
    setBpm: vi.fn(),
    init: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({
      enabled: true,
    }),
    getOutputs: vi.fn().mockReturnValue([]),
    setOnDeviceChange: vi.fn(),
    updateConfig: vi.fn(),
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
    pans?: Partial<Record<TrackId, number>>;
    parameterLocks?: Partial<
      Record<TrackId, Record<number, StepLocks>>
    >;
  } = {}
) {
  const {
    activeTracks = ['bd', 'sd'],
    accentStep0 = false,
    soloTracks = [],
    muteTracks = [],
    gains = {},
    pans = {},
    parameterLocks = {},
  } = options;

  const { result } = renderSequencer();

  // Build a pattern: set step 0 active for specified tracks
  await act(async () => {
    // First, set all tracks to inactive at step 0
    for (const id of TRACK_IDS) {
      const current = result.current.meta.config.tracks[id].steps;
      if (current[0] === '1') {
        result.current.actions.toggleStep(id, 0);
      }
    }
  });

  // Now activate the tracks we want at step 0
  await act(async () => {
    for (const id of activeTracks) {
      const current = result.current.meta.config.tracks[id].steps;
      if (current[0] === '0') {
        result.current.actions.toggleStep(id, 0);
      }
    }
    // Set accent
    if (accentStep0) {
      const acCurrent = result.current.meta.config.tracks.ac.steps;
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
    for (const [id, value] of Object.entries(pans)) {
      result.current.actions.setPan(id as TrackId, value);
    }
    for (const [trackId, stepMap] of
      Object.entries(parameterLocks)) {
      for (const [stepIndex, locks] of
        Object.entries(stepMap as Record<number, StepLocks>)) {
        result.current.actions.setParameterLock(
          trackId as TrackId,
          Number(stepIndex),
          locks
        );
      }
    }
  });

  // Start playback to register handleStep
  mockPlaySound.mockClear();
  mockSendNote.mockClear();
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
    mockSendNote.mockClear();
    mockMidiStop.mockClear();
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

  it('accent step: gain multiplied by 2.0', async () => {
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      accentStep0: true,
      gains: { bd: 1.0 },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 1.0^3 * (1 + 0.5*2) = 2.0
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(2.0);
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

  it('calls midiEngine.sendNote alongside playSound',
    async () => {
      const { mockPlaySound: mp } = await setupAndTrigger({
        activeTracks: ['bd'],
        gains: { bd: 1.0 },
      });

      expect(mp).toHaveBeenCalledTimes(1);
      expect(mockSendNote).toHaveBeenCalledTimes(1);

      // Same track and gain
      expect(mockSendNote.mock.calls[0][0]).toBe('bd');
      expect(mockSendNote.mock.calls[0][2]).toBe(
        mp.mock.calls[0][2]
      );

      // perfTimeMs is a valid number (not NaN/undefined)
      const perfTimeMs = mockSendNote.mock.calls[0][1];
      expect(perfTimeMs).toEqual(expect.any(Number));
      expect(Number.isNaN(perfTimeMs)).toBe(false);
    }
  );

  it('skips MIDI for muted tracks', async () => {
    await setupAndTrigger({
      activeTracks: ['bd', 'sd'],
      muteTracks: ['bd'],
    });

    const sentIds = mockSendNote.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(sentIds).not.toContain('bd');
    expect(sentIds).toContain('sd');
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
    mockSendNote.mockClear();
    mockMidiStop.mockClear();
  });

  it('odd step with swing: time is offset', async () => {
    const { result } = renderSequencer();

    // Set swing to 50 and activate bd at step 1
    await act(async () => {
      result.current.actions.setSwing(50);
      // Clear step 0 for bd, set step 1
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.tracks[id].steps;
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.tracks.bd.steps;
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
          result.current.meta.config.tracks[id].steps;
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.tracks.bd.steps;
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
          result.current.meta.config.tracks[id].steps;
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.tracks.bd.steps;
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
    mockSendNote.mockClear();
    mockMidiStop.mockClear();
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
          'bd', 0, { probability: 50 }
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
          'bd', 0, { probability: 50 }
        );
      });

      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[0]
      ).toEqual({ probability: 50 });

      await act(async () => {
        result.current.actions.clearTrigCondition(
          'bd', 0
        );
      });

      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[0]
      ).toBeUndefined();
    }
  );

  it('shortening track preserves conditions beyond length as dormant',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 15, { probability: 75 }
        );
      });
      await act(async () => {
        result.current.actions.setTrackLength('bd', 8);
      });

      // Condition survives as dormant data even though
      // the track is now shorter than step 15
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[15]
      ).toEqual({ probability: 75 });
    }
  );

  it('shortening track preserves conditions within length',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 3, { probability: 75 }
        );
      });
      await act(async () => {
        result.current.actions.setTrackLength('bd', 8);
      });

      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[3]
      ).toEqual({ probability: 75 });
    }
  );

  it('shortening pattern length preserves conditions as dormant',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 15, { probability: 75 }
        );
      });
      await act(async () => {
        result.current.actions.setPatternLength(8);
      });

      // Condition survives as dormant data even though
      // the pattern is now shorter than step 15
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[15]
      ).toEqual({ probability: 75 });
    }
  );

  it('clearAll resets trigConditions',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0, { probability: 50 }
        );
      });
      await act(async () => {
        result.current.actions.clearAll();
      });

      // After clearAll, every track resets to bare
      // { steps: '0'.repeat(16) } with no conditions
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions
      ).toBeUndefined();
    }
  );

  it('loading preset clears conditions',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0, { probability: 50 }
        );
      });
      await act(async () => {
        result.current.actions.setPattern(
          patternsData.patterns[0] as Pattern
        );
      });

      // Preset patterns have no trigConditions
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions
      ).toBeUndefined();
    }
  );

  it('toggling step off preserves condition',
    async () => {
      const { result } = renderSequencer();

      // Turn step 0 of bd on
      await act(async () => {
        const cur =
          result.current.meta.config.tracks.bd.steps;
        if (cur[0] === '0') {
          result.current.actions.toggleStep('bd', 0);
        }
      });

      // Set a condition
      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0,
          { probability: 50 }
        );
      });

      // Toggle step off
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
      });

      // Condition should persist
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[0]
      ).toEqual({ probability: 50 });

      // Toggle step back on
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
      });

      // Condition should still be there
      expect(
        result.current.meta.config
          .tracks.bd.trigConditions?.[0]
      ).toEqual({ probability: 50 });
    }
  );

  it('clearTrack removes parameterLocks for track',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setParameterLock(
          'bd', 0, { gain: 0.5 }
        );
      });

      expect(
        result.current.meta.config
          .tracks.bd.parameterLocks?.[0]
      ).toEqual({ gain: 0.5 });

      await act(async () => {
        result.current.actions.clearTrack('bd');
      });

      expect(
        result.current.meta.config
          .tracks.bd.parameterLocks
      ).toBeUndefined();
    }
  );

  it('mute resets cycle count for that track',
    async () => {
      const { result } = renderSequencer();

      // Start clean, activate bd step 0
      await act(async () => {
        result.current.actions.clearAll();
      });
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
      });

      // Set cycle 2:2: fires when cycleCount % 2 === 1
      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0,
          { cycle: { a: 2, b: 2 } }
        );
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

      // Play 17 steps: cycle increments at total=16,
      // so cycleCount=1 after 17 calls.
      // total=17 after these calls (not a multiple of 16).
      for (let s = 0; s < 17; s++) {
        onStep(s % 16, 0.0);
      }

      // Mute then unmute bd — each call resets
      // cycleCountRef[bd] to 0
      await act(async () => {
        result.current.actions.toggleMute('bd');
      });
      await act(async () => {
        result.current.actions.toggleMute('bd');
      });

      mockPlaySound.mockClear();

      // totalStepsRef is now 17; 17 % 16 !== 0, so no
      // cycle increment fires. cycleCount stays at 0.
      // cycle 2:2 requires cycleCount % 2 === 1, so
      // bd step 0 should NOT fire.
      onStep(0, 0.0);

      expect(mockPlaySound).not.toHaveBeenCalled();
    }
  );
});

// -------------------------------------------------
// handleStep parameter locks
// -------------------------------------------------
describe('handleStep parameter locks', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
    mockSendNote.mockClear();
    mockMidiStop.mockClear();
  });

  it('gain lock overrides mixer gain', async () => {
    // bd mixer gain = 1.0, but lock = 0.5
    // Expected: 0.5^3 = 0.125
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      gains: { bd: 1.0 },
      parameterLocks: { bd: { 0: { gain: 0.5 } } },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.125);
  });

  it('accent stacks on locked gain', async () => {
    // bd mixer gain = 1.0, lock = 0.5, accented
    // Expected: 0.5^3 * (1 + 0.5*2) = 0.25
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      accentStep0: true,
      gains: { bd: 1.0 },
      parameterLocks: { bd: { 0: { gain: 0.5 } } },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.25);
  });

  it('no lock falls back to mixer gain', async () => {
    // bd mixer gain = 0.8, no lock
    // Expected: 0.8^3 = 0.512
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      gains: { bd: 0.8 },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.512);
  });

  it('gain lock = 0 produces silence', async () => {
    // bd mixer gain = 1.0, lock = 0
    // Expected: 0^3 = 0
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      gains: { bd: 1.0 },
      parameterLocks: { bd: { 0: { gain: 0 } } },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0);
  });

  it('pan lock overrides mixer pan', async () => {
    // bd mixer pan = 0.8, but lock = 0.2
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      pans: { bd: 0.8 },
      parameterLocks: { bd: { 0: { pan: 0.2 } } },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const panArg = mp.mock.calls[0][3];
    expect(panArg).toBeCloseTo(0.2);
  });

  it('pan lock at center produces 0.5', async () => {
    // bd mixer pan = 1.0, lock = 0.5
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      pans: { bd: 1.0 },
      parameterLocks: { bd: { 0: { pan: 0.5 } } },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const panArg = mp.mock.calls[0][3];
    expect(panArg).toBeCloseTo(0.5);
  });

  it('no pan lock falls back to mixer pan', async () => {
    // bd mixer pan = 0.3, no lock
    const { mockPlaySound: mp } = await setupAndTrigger({
      activeTracks: ['bd'],
      pans: { bd: 0.3 },
    });
    expect(mp).toHaveBeenCalledTimes(1);
    const panArg = mp.mock.calls[0][3];
    expect(panArg).toBeCloseTo(0.3);
  });
});

// -------------------------------------------------------
// Step boundary: sequential pending + temp revert
// -------------------------------------------------------

/** Create a minimal test pattern. */
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

describe('step boundary hooks', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockRequestReset.mockClear();
  });

  it('sequential: pending pattern applied at last'
    + ' step', async () => {
    const { result } = renderSequencer();

    // Start playback
    await act(async () => {
      result.current.actions.togglePlay();
    });
    expect(mockStart).toHaveBeenCalled();
    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });

    // Set sequential mode and queue a pattern
    await act(async () => {
      result.current.actions.setPatternMode(
        'sequential'
      );
    });

    const pending = makePattern(
      'pending', '1111000011110000'
    );
    await act(async () => {
      result.current.actions.setPattern(pending);
    });

    // Pattern should NOT have changed yet
    expect(
      result.current.state.selectedPatternId
    ).not.toBe('pending');

    // Step through to the last step (15 for 16-step)
    await act(async () => {
      onStep(15, 1.0);
    });

    // After last step, pending should be applied
    await waitFor(() => {
      expect(
        result.current.state.selectedPatternId
      ).toBe('pending');
    });

    // Sequential should NOT call requestReset
    expect(mockRequestReset).not.toHaveBeenCalled();
  });

  it('temp revert at last step', async () => {
    const { result } = renderSequencer();

    // Load a known home pattern
    const home = makePattern(
      'home', '1010101010101010'
    );
    await act(async () => {
      result.current.actions.setPattern(home);
    });

    // Start playback in direct-start mode
    await act(async () => {
      result.current.actions.togglePlay();
    });
    expect(mockStart).toHaveBeenCalled();
    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });

    await act(async () => {
      result.current.actions.setPatternMode(
        'direct-start'
      );
    });

    // Arm temp and select a temp pattern
    await act(async () => {
      result.current.actions.toggleTemp();
    });
    expect(
      result.current.state.tempState
    ).toBe('armed');

    const tempPat = makePattern(
      'temp', '1111111111111111'
    );
    await act(async () => {
      result.current.actions.setPattern(tempPat);
    });
    expect(
      result.current.state.tempState
    ).toBe('active');
    expect(
      result.current.state.selectedPatternId
    ).toBe('temp');

    mockRequestReset.mockClear();

    // Step through to the last step
    await act(async () => {
      onStep(15, 1.0);
    });

    // After last step, should revert to home
    await waitFor(() => {
      expect(
        result.current.state.tempState
      ).toBe('off');
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('home');
    // Temp revert calls requestReset
    expect(mockRequestReset).toHaveBeenCalled();
  });
});

// -------------------------------------------------------
// triggeredTracksRef
// -------------------------------------------------------
describe('triggeredTracksRef', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
  });

  it('contains fired track IDs after a step',
    async () => {
      const { result } = await setupAndTrigger({
        activeTracks: ['bd', 'ch'],
      });
      const triggered =
        result.current.meta.triggeredTracksRef
          .current;
      expect(triggered.has('bd')).toBe(true);
      expect(triggered.has('ch')).toBe(true);
      expect(triggered.has('sd')).toBe(false);
    }
  );

  it('is cleared at the start of each step',
    async () => {
      const { result } = renderSequencer();

      // Activate bd on step 0, sd on step 1
      await act(async () => {
        for (const id of TRACK_IDS) {
          const s =
            result.current.meta.config.tracks[id]
              .steps;
          if (s[0] === '1')
            result.current.actions.toggleStep(id, 0);
          if (s[1] === '1')
            result.current.actions.toggleStep(id, 1);
        }
        result.current.actions.toggleStep('bd', 0);
        result.current.actions.toggleStep('sd', 1);
      });

      await act(async () => {
        result.current.actions.togglePlay();
      });

      const onStep =
        mockStart.mock.calls[0][1] as (
          step: number, time: number
        ) => void;

      onStep(0, 0.0);
      expect(
        result.current.meta.triggeredTracksRef
          .current.has('bd')
      ).toBe(true);

      // Step 1: bd should no longer be triggered
      onStep(1, 0.5);
      expect(
        result.current.meta.triggeredTracksRef
          .current.has('bd')
      ).toBe(false);
      expect(
        result.current.meta.triggeredTracksRef
          .current.has('sd')
      ).toBe(true);
    }
  );

  it('is cleared when playback stops',
    async () => {
      const { result } = await setupAndTrigger({
        activeTracks: ['bd'],
      });

      expect(
        result.current.meta.triggeredTracksRef
          .current.size
      ).toBeGreaterThan(0);

      await act(async () => {
        result.current.actions.togglePlay();
      });

      expect(
        result.current.meta.triggeredTracksRef
          .current.size
      ).toBe(0);
    }
  );
});

// -------------------------------------------------------
// playPreview
// -------------------------------------------------------
describe('playPreview', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
  });

  it('plays the track sample immediately',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.playPreview('bd');
      });

      expect(mockPlaySound).toHaveBeenCalledTimes(1);
      expect(mockPlaySound.mock.calls[0][0])
        .toBe('bd');
    }
  );

  it('uses the track gain and pan settings',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setGain('bd', 0.5);
        result.current.actions.setPan('bd', 0.75);
      });

      mockPlaySound.mockClear();

      await act(async () => {
        result.current.actions.playPreview('bd');
      });

      expect(mockPlaySound).toHaveBeenCalledTimes(1);
      // gain = 0.5^3 = 0.125
      expect(mockPlaySound.mock.calls[0][2])
        .toBeCloseTo(0.125);
      expect(mockPlaySound.mock.calls[0][3])
        .toBe(0.75);
    }
  );
});
