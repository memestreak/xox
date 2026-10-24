import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useTrackConfig } from '../../app/hooks/useTrackConfig';
import { defaultConfig } from '../../app/configCodec';
import { MAX_PATTERN_LENGTH } from '../../app/constants';
import { TRACK_IDS, getPatternLength } from '../../app/types';
import type { SequencerConfig } from '../../app/types';

/** Hosts useTrackConfig with real config state. */
function useHarness() {
  const [config, setConfig] =
    useState<SequencerConfig>(defaultConfig);
  const [selectedPatternId, setSelectedPatternId] =
    useState('start');
  const tc = useTrackConfig({
    setConfig, setSelectedPatternId,
  });
  return { tc, config, selectedPatternId };
}

function setup() {
  const { result } = renderHook(() => useHarness());
  // Start from an empty 16-step grid for predictability.
  act(() => {
    for (const id of TRACK_IDS) {
      result.current.tc.setTrackSteps(id, '0'.repeat(16));
    }
  });
  return result;
}

describe('useTrackConfig: steps', () => {
  it('toggleStep flips a bit and marks pattern custom', () => {
    const r = setup();
    act(() => r.current.tc.toggleStep('bd', 3));
    expect(r.current.config.tracks.bd.steps[3]).toBe('1');
    expect(r.current.selectedPatternId).toBe('custom');
    act(() => r.current.tc.toggleStep('bd', 3));
    expect(r.current.config.tracks.bd.steps[3]).toBe('0');
  });

  it('toggleStep past the track end is a no-op', () => {
    const r = setup();
    const before = r.current.config;
    act(() => r.current.tc.toggleStep('bd', 40));
    expect(r.current.config.tracks).toBe(before.tracks);
  });

  it('setStep is idempotent', () => {
    const r = setup();
    act(() => r.current.tc.setStep('sd', 0, '1'));
    const after = r.current.config;
    act(() => r.current.tc.setStep('sd', 0, '1'));
    expect(r.current.config).toBe(after);
  });

  it('clearTrack empties steps and drops conditions', () => {
    const r = setup();
    act(() => {
      r.current.tc.toggleStep('ch', 1);
      r.current.tc.setTrigCondition(
        'ch', 1, { probability: 50 }
      );
    });
    act(() => r.current.tc.clearTrack('ch'));
    expect(r.current.config.tracks.ch).toEqual({
      steps: '0'.repeat(16),
    });
  });

  it('toggleFreeRun flips the flag', () => {
    const r = setup();
    act(() => r.current.tc.toggleFreeRun('oh'));
    expect(r.current.config.tracks.oh.freeRun).toBe(true);
    act(() => r.current.tc.toggleFreeRun('oh'));
    expect(r.current.config.tracks.oh.freeRun).toBe(false);
  });
});

describe('useTrackConfig: lengths', () => {
  it('setPatternLength grows every track', () => {
    const r = setup();
    act(() => r.current.tc.setPatternLength(32));
    for (const id of TRACK_IDS) {
      expect(r.current.config.tracks[id].steps)
        .toHaveLength(32);
    }
  });

  it('setPatternLength clamps to 1..MAX', () => {
    const r = setup();
    act(() => r.current.tc.setPatternLength(999));
    expect(getPatternLength(r.current.config.tracks))
      .toBe(MAX_PATTERN_LENGTH);
    act(() => r.current.tc.setPatternLength(0));
    expect(getPatternLength(r.current.config.tracks))
      .toBe(1);
  });

  it('shrinking the pattern keeps shorter tracks short', () => {
    const r = setup();
    act(() => r.current.tc.setPatternLength(32));
    act(() => r.current.tc.setTrackLength('bd', 12));
    act(() => r.current.tc.setPatternLength(20));
    expect(r.current.config.tracks.bd.steps).toHaveLength(12);
    expect(r.current.config.tracks.sd.steps).toHaveLength(20);
  });

  it('setTrackLength clamps to the pattern length', () => {
    const r = setup();
    act(() => r.current.tc.setTrackLength('bd', 64));
    expect(r.current.config.tracks.bd.steps).toHaveLength(16);
    act(() => r.current.tc.setTrackLength('bd', 0));
    expect(r.current.config.tracks.bd.steps).toHaveLength(1);
  });
});

describe('useTrackConfig: mixer', () => {
  it('toggleMute/toggleSolo flip flags and reset cycle', () => {
    const r = setup();
    act(() => r.current.tc.initCycleCounts());
    r.current.tc.cycleCountRef.current.bd = 5;
    r.current.tc.cycleCountRef.current.sd = 7;
    act(() => r.current.tc.toggleMute('bd'));
    act(() => r.current.tc.toggleSolo('sd'));
    expect(r.current.config.mixer.bd.isMuted).toBe(true);
    expect(r.current.config.mixer.sd.isSolo).toBe(true);
    expect(r.current.tc.cycleCountRef.current.bd).toBe(0);
    expect(r.current.tc.cycleCountRef.current.sd).toBe(0);
  });

  it('setGain and setPan update only that track', () => {
    const r = setup();
    act(() => {
      r.current.tc.setGain('cp', 0.3);
      r.current.tc.setPan('cp', 0.9);
    });
    expect(r.current.config.mixer.cp.gain).toBe(0.3);
    expect(r.current.config.mixer.cp.pan).toBe(0.9);
    expect(r.current.config.mixer.cb.gain).toBe(1);
  });

  it('setSwing clamps to 0..100', () => {
    const r = setup();
    act(() => r.current.tc.setSwing(150));
    expect(r.current.config.swing).toBe(100);
    act(() => r.current.tc.setSwing(-5));
    expect(r.current.config.swing).toBe(0);
  });
});

describe('useTrackConfig: conditions and locks', () => {
  it('clearing the last trig condition removes the map', () => {
    const r = setup();
    act(() => r.current.tc.setTrigCondition(
      'bd', 2, { fill: 'fill' }
    ));
    expect(r.current.config.tracks.bd.trigConditions)
      .toEqual({ 2: { fill: 'fill' } });
    act(() => r.current.tc.clearTrigCondition('bd', 2));
    expect(r.current.config.tracks.bd.trigConditions)
      .toBeUndefined();
  });

  it('setParameterLock merges with existing locks', () => {
    const r = setup();
    act(() => r.current.tc.setParameterLock(
      'bd', 0, { gain: 0.4 }
    ));
    act(() => r.current.tc.setParameterLock(
      'bd', 0, { pan: 0.2 }
    ));
    expect(r.current.config.tracks.bd.parameterLocks?.[0])
      .toEqual({ gain: 0.4, pan: 0.2 });
  });

  it('clearing the last lock removes the map', () => {
    const r = setup();
    act(() => r.current.tc.setParameterLock(
      'bd', 0, { gain: 0.4 }
    ));
    act(() => r.current.tc.clearParameterLock('bd', 0));
    expect(r.current.config.tracks.bd.parameterLocks)
      .toBeUndefined();
  });
});

describe('useTrackConfig: reset', () => {
  it('reset zeroes every cycle count', () => {
    const r = setup();
    r.current.tc.cycleCountRef.current = { bd: 9 } as never;
    act(() => r.current.tc.reset());
    for (const id of TRACK_IDS) {
      expect(r.current.tc.cycleCountRef.current[id]).toBe(0);
    }
  });
});

/** Like useHarness, with a controllable Fill flag. */
function useFillHarness(fillActiveRef: { current: boolean }) {
  const [config, setConfig] =
    useState<SequencerConfig>(defaultConfig);
  const [, setSelectedPatternId] = useState('start');
  const tc = useTrackConfig({
    setConfig, setSelectedPatternId, fillActiveRef,
  });
  return { tc, config };
}

function setupFill() {
  const fillActiveRef = { current: false };
  const { result } = renderHook(
    () => useFillHarness(fillActiveRef)
  );
  act(() => {
    for (const id of TRACK_IDS) {
      result.current.tc.setTrackSteps(id, '0'.repeat(16));
    }
  });
  return { r: result, fillActiveRef };
}

describe('useTrackConfig: steps added during Fill', () => {
  it('toggleStep on during Fill adds the Fill condition', () => {
    const { r, fillActiveRef } = setupFill();
    fillActiveRef.current = true;
    act(() => r.current.tc.toggleStep('bd', 2));
    const bd = r.current.config.tracks.bd;
    expect(bd.steps[2]).toBe('1');
    expect(bd.trigConditions?.[2]).toEqual({ fill: 'fill' });
  });

  it('setStep (drag paint) on during Fill adds it too', () => {
    const { r, fillActiveRef } = setupFill();
    fillActiveRef.current = true;
    act(() => r.current.tc.setStep('sd', 5, '1'));
    expect(r.current.config.tracks.sd.trigConditions?.[5])
      .toEqual({ fill: 'fill' });
  });

  it('leaves steps plain when Fill is off', () => {
    const { r } = setupFill();
    act(() => r.current.tc.toggleStep('bd', 2));
    act(() => r.current.tc.setStep('bd', 3, '1'));
    expect(r.current.config.tracks.bd.trigConditions)
      .toBeUndefined();
  });

  it('turning a step off during Fill changes only the step', () => {
    const { r, fillActiveRef } = setupFill();
    act(() => r.current.tc.toggleStep('bd', 2));
    fillActiveRef.current = true;
    act(() => r.current.tc.toggleStep('bd', 2));
    const bd = r.current.config.tracks.bd;
    expect(bd.steps[2]).toBe('0');
    expect(bd.trigConditions).toBeUndefined();
  });

  it('keeps probability and cycle, replaces not-fill', () => {
    const { r, fillActiveRef } = setupFill();
    act(() => r.current.tc.setTrigCondition('ch', 1, {
      probability: 50, cycle: { a: 1, b: 2 }, fill: '!fill',
    }));
    fillActiveRef.current = true;
    act(() => r.current.tc.toggleStep('ch', 1));
    expect(r.current.config.tracks.ch.trigConditions?.[1])
      .toEqual({
        probability: 50, cycle: { a: 1, b: 2 }, fill: 'fill',
      });
  });

  it('does not touch other steps on the track', () => {
    const { r, fillActiveRef } = setupFill();
    act(() => r.current.tc.toggleStep('bd', 0));
    fillActiveRef.current = true;
    act(() => r.current.tc.toggleStep('bd', 4));
    const conds = r.current.config.tracks.bd.trigConditions;
    expect(conds?.[0]).toBeUndefined();
    expect(conds?.[4]).toEqual({ fill: 'fill' });
  });
});

describe('useTrackConfig: preset cycling during Fill', () => {
  // Base track for a shift+drag gesture: steps 0 and 4
  // on, step 4 already has a probability.
  const base = {
    steps: '1000100000000000',
    trigConditions: { 4: { probability: 50 } },
  };

  function setupBase() {
    const s = setupFill();
    act(() => {
      s.r.current.tc.setTrackSteps('bd', base.steps);
      s.r.current.tc.setTrigCondition('bd', 4, { probability: 50 });
    });
    return s;
  }

  it('gives Fill only to steps the preset turns on', () => {
    const { r, fillActiveRef } = setupBase();
    fillActiveRef.current = true;
    act(() => r.current.tc.setTrackSteps(
      'bd', '1010101000000000', base
    ));
    const bd = r.current.config.tracks.bd;
    expect(bd.steps).toBe('1010101000000000');
    expect(bd.trigConditions).toEqual({
      2: { fill: 'fill' },
      4: { probability: 50 },
      6: { fill: 'fill' },
    });
  });

  it('drops Fill from steps the next preset turns off', () => {
    const { r, fillActiveRef } = setupBase();
    fillActiveRef.current = true;
    act(() => r.current.tc.setTrackSteps(
      'bd', '1010101000000000', base
    ));
    act(() => r.current.tc.setTrackSteps(
      'bd', '1000100010000000', base
    ));
    expect(r.current.config.tracks.bd.trigConditions).toEqual({
      4: { probability: 50 },
      8: { fill: 'fill' },
    });
  });

  it('restoring the base (Escape) restores its conditions', () => {
    const { r, fillActiveRef } = setupBase();
    fillActiveRef.current = true;
    act(() => r.current.tc.setTrackSteps(
      'bd', '0000000011110000', base
    ));
    act(() => r.current.tc.setTrackSteps('bd', base.steps, base));
    const bd = r.current.config.tracks.bd;
    expect(bd.steps).toBe(base.steps);
    expect(bd.trigConditions).toEqual(base.trigConditions);
  });

  it('adds nothing when Fill is off', () => {
    const { r } = setupBase();
    act(() => r.current.tc.setTrackSteps(
      'bd', '1010101000000000', base
    ));
    expect(r.current.config.tracks.bd.trigConditions)
      .toEqual(base.trigConditions);
  });
});

describe('useTrackConfig: turning a step off clears Fill', () => {
  it('a Fill step turned off comes back plain', () => {
    const { r, fillActiveRef } = setupFill();
    fillActiveRef.current = true;
    act(() => r.current.tc.toggleStep('bd', 2));
    fillActiveRef.current = false;
    act(() => r.current.tc.toggleStep('bd', 2));
    expect(r.current.config.tracks.bd.trigConditions)
      .toBeUndefined();
    act(() => r.current.tc.toggleStep('bd', 2));
    const bd = r.current.config.tracks.bd;
    expect(bd.steps[2]).toBe('1');
    expect(bd.trigConditions).toBeUndefined();
  });

  it('clears not-fill too, keeps probability and cycle', () => {
    const { r } = setupFill();
    act(() => r.current.tc.toggleStep('ch', 1));
    act(() => r.current.tc.setTrigCondition('ch', 1, {
      probability: 50, cycle: { a: 1, b: 2 }, fill: '!fill',
    }));
    act(() => r.current.tc.toggleStep('ch', 1));
    expect(r.current.config.tracks.ch.trigConditions?.[1])
      .toEqual({ probability: 50, cycle: { a: 1, b: 2 } });
  });

  it('setStep (drag erase, delete) clears it', () => {
    const { r, fillActiveRef } = setupFill();
    fillActiveRef.current = true;
    act(() => r.current.tc.setStep('sd', 5, '1'));
    act(() => r.current.tc.setStep('sd', 5, '0'));
    expect(r.current.config.tracks.sd.trigConditions)
      .toBeUndefined();
  });

  it('does not touch Fill on other steps', () => {
    const { r, fillActiveRef } = setupFill();
    fillActiveRef.current = true;
    act(() => r.current.tc.toggleStep('bd', 0));
    act(() => r.current.tc.toggleStep('bd', 4));
    act(() => r.current.tc.toggleStep('bd', 4));
    expect(r.current.config.tracks.bd.trigConditions)
      .toEqual({ 0: { fill: 'fill' } });
  });

  it('setTrackSteps clears it on steps turned off', () => {
    const { r, fillActiveRef } = setupFill();
    fillActiveRef.current = true;
    act(() => r.current.tc.setTrackSteps(
      'bd', '1000100000000000'
    ));
    fillActiveRef.current = false;
    act(() => r.current.tc.setTrackSteps(
      'bd', '1000000000000000'
    ));
    expect(r.current.config.tracks.bd.trigConditions)
      .toEqual({ 0: { fill: 'fill' } });
  });
});
