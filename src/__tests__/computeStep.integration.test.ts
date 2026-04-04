/**
 * Integration tests for computeStep wiring.
 *
 * These verify that SequencerContext correctly threads
 * ref values into computeStep and interprets the result
 * signals. Unlike computeStep.test.ts (pure data-in/
 * data-out), these render the full React provider and
 * exercise the audio callback path.
 *
 * Keep this suite slim (~5-10 tests) — bulk coverage
 * belongs in computeStep.test.ts.
 */
import {
  renderHook, act, waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSequencer } from '../app/SequencerContext';
import { TRACK_IDS } from '../app/types';
import type {
  TrackId, TrackConfig, Pattern,
} from '../app/types';
import { TestWrapper } from './helpers/sequencer-wrapper';

// ── Mocks ──────────────���────────────────────────────

const mockPlaySound = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockSendNote = vi.fn();
const mockRequestReset = vi.fn();

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: (...args: unknown[]) =>
      mockPlaySound(...args),
    requestReset: (...args: unknown[]) =>
      mockRequestReset(...args),
    getCurrentTime: vi.fn().mockReturnValue(0),
    onStep: vi.fn(),
  },
}));

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    sendNote: (...args: unknown[]) =>
      mockSendNote(...args),
    stop: vi.fn(),
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

// ── Helpers ─────��───────────────────────────────────

function renderSequencer() {
  return renderHook(() => useSequencer(), {
    wrapper: TestWrapper,
  });
}

/** Start playback and return the onStep callback. */
async function startPlayback(
  result: ReturnType<typeof renderSequencer>['result']
): Promise<(step: number, time: number) => void> {
  mockStart.mockClear();
  await act(async () => {
    result.current.actions.togglePlay();
  });
  expect(mockStart).toHaveBeenCalled();
  const onStep = mockStart.mock.calls[0][1] as (
    step: number, time: number
  ) => void;
  await waitFor(() => {
    expect(result.current.state.isPlaying).toBe(true);
  });
  return onStep;
}

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

// ── Tests ─────────────────���─────────────────────────

describe('computeStep integration', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
    mockSendNote.mockClear();
    mockRequestReset.mockClear();
  });

  it('ref-threaded playback: active tracks produce'
    + ' sound and MIDI', async () => {
    const { result } = renderSequencer();

    // Clear and set up bd at step 0
    await act(async () => {
      result.current.actions.clearAll();
    });
    await act(async () => {
      result.current.actions.toggleStep('bd', 0);
    });

    const onStep = await startPlayback(result);
    mockPlaySound.mockClear();
    mockSendNote.mockClear();

    onStep(0, 0.0);

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPlaySound.mock.calls[0][0]).toBe('bd');
    expect(mockSendNote).toHaveBeenCalledTimes(1);
    expect(mockSendNote.mock.calls[0][0]).toBe('bd');
  });

  it('fill ref is threaded to computeStep', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.clearAll();
    });
    await act(async () => {
      result.current.actions.toggleStep('bd', 0);
      result.current.actions.setTrigCondition(
        'bd', 0, { fill: 'fill' }
      );
    });

    const onStep = await startPlayback(result);
    mockPlaySound.mockClear();

    // Fill inactive → no sound
    onStep(0, 0.0);
    expect(mockPlaySound).not.toHaveBeenCalled();

    // Activate fill
    await act(async () => {
      result.current.actions.setFillHeld(true);
    });
    mockPlaySound.mockClear();

    onStep(0, 0.0);
    expect(mockPlaySound).toHaveBeenCalledTimes(1);
  });

  it('sequential pending pattern applied at boundary',
    async () => {
      const { result } = renderSequencer();

      const onStep = await startPlayback(result);

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

      expect(result.current.state.selectedPatternId)
        .not.toBe('pending');

      await act(async () => {
        onStep(15, 1.0);
      });

      await waitFor(() => {
        expect(result.current.state.selectedPatternId)
          .toBe('pending');
      });
    }
  );

  it('temp revert at boundary restores home',
    async () => {
      const { result } = renderSequencer();

      const home = makePattern(
        'home', '1010101010101010'
      );
      await act(async () => {
        result.current.actions.setPattern(home);
      });

      const onStep = await startPlayback(result);

      await act(async () => {
        result.current.actions.setPatternMode(
          'direct-start'
        );
      });

      // Arm + select temp
      await act(async () => {
        result.current.actions.toggleTemp();
      });
      const tempPat = makePattern(
        'temp', '1111111111111111'
      );
      await act(async () => {
        result.current.actions.setPattern(tempPat);
      });
      expect(result.current.state.tempState)
        .toBe('active');

      mockRequestReset.mockClear();

      await act(async () => {
        onStep(15, 1.0);
      });

      await waitFor(() => {
        expect(result.current.state.tempState)
          .toBe('off');
      });
      expect(result.current.state.selectedPatternId)
        .toBe('home');
      expect(mockRequestReset).toHaveBeenCalled();
    }
  );

  it('triggeredTracksRef updated after step',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.clearAll();
      });
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
        result.current.actions.toggleStep('ch', 0);
      });

      const onStep = await startPlayback(result);
      onStep(0, 0.0);

      const triggered =
        result.current.meta.triggeredTracksRef.current;
      expect(triggered.has('bd')).toBe(true);
      expect(triggered.has('ch')).toBe(true);
      expect(triggered.has('sd')).toBe(false);
    }
  );

  it('mute resets cycle count for that track',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.clearAll();
      });
      await act(async () => {
        result.current.actions.toggleStep('bd', 0);
        result.current.actions.setTrigCondition(
          'bd', 0, { cycle: { a: 2, b: 2 } }
        );
      });

      const onStep = await startPlayback(result);
      mockPlaySound.mockClear();

      // Run 17 steps to build up cycle count
      for (let s = 0; s < 17; s++) {
        onStep(s % 16, 0.0);
      }

      // Mute/unmute resets cycle count to 0
      await act(async () => {
        result.current.actions.toggleMute('bd');
      });
      await act(async () => {
        result.current.actions.toggleMute('bd');
      });

      mockPlaySound.mockClear();
      onStep(0, 0.0);

      // cycleCount=0, 2:2 requires count%2===1 → skip
      expect(mockPlaySound).not.toHaveBeenCalled();
    }
  );
});
