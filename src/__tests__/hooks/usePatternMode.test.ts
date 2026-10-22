import { act, renderHook } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatternMode } from '../../app/hooks/usePatternMode';
import { defaultConfig } from '../../app/configCodec';
import type {
  Pattern, SequencerConfig, TrackConfig, TrackId,
} from '../../app/types';
import { TRACK_IDS } from '../../app/types';

const requestReset = vi.fn();
vi.mock('../../app/AudioEngine', () => ({
  audioEngine: {
    requestReset: () => requestReset(),
  },
}));

function makePattern(id: string, bit: '0' | '1'): Pattern {
  const tracks = {} as Record<TrackId, TrackConfig>;
  for (const t of TRACK_IDS) {
    tracks[t] = { steps: bit.repeat(16) };
  }
  return { id, name: id, category: 'test', tracks };
}

/**
 * Hosts usePatternMode with real config state so
 * tests can observe config/selection changes.
 */
function useHarness(playing: boolean) {
  const [config, setConfig] =
    useState<SequencerConfig>(defaultConfig);
  const [selectedPatternId, setSelectedPatternId] =
    useState('start');
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  const isPlayingRef = useRef(playing);
  const pm = usePatternMode({
    configRef,
    isPlayingRef,
    selectedPatternId,
    setConfig,
    setSelectedPatternId,
  });
  return { pm, config, selectedPatternId, isPlayingRef };
}

const A = makePattern('A', '1');

describe('usePatternMode', () => {
  beforeEach(() => requestReset.mockClear());

  it('defaults to direct-jump with temp off', () => {
    const { result } = renderHook(() => useHarness(false));
    expect(result.current.pm.patternMode).toBe('direct-jump');
    expect(result.current.pm.tempState).toBe('off');
  });

  it('applies immediately when stopped, in any mode', () => {
    const { result } = renderHook(() => useHarness(false));
    act(() => result.current.pm.setPatternMode('sequential'));
    act(() => result.current.pm.setPattern(A));
    expect(result.current.selectedPatternId).toBe('A');
    expect(result.current.config.tracks.bd.steps)
      .toBe('1'.repeat(16));
    expect(result.current.pm.pendingPatternRef.current)
      .toBeNull();
  });

  it('sequential mode queues the pattern while playing', () => {
    const { result } = renderHook(() => useHarness(true));
    act(() => result.current.pm.setPatternMode('sequential'));
    act(() => result.current.pm.setPattern(A));
    expect(result.current.pm.pendingPatternRef.current)
      .toBe(A);
    expect(result.current.selectedPatternId).toBe('start');
  });

  it('direct-start applies and requests an engine reset', () => {
    const { result } = renderHook(() => useHarness(true));
    act(() => result.current.pm.setPatternMode('direct-start'));
    act(() => result.current.pm.setPattern(A));
    expect(requestReset).toHaveBeenCalledTimes(1);
    expect(result.current.selectedPatternId).toBe('A');
  });

  it('direct-jump applies without reset', () => {
    const { result } = renderHook(() => useHarness(true));
    act(() => result.current.pm.setPattern(A));
    expect(requestReset).not.toHaveBeenCalled();
    expect(result.current.selectedPatternId).toBe('A');
  });

  it('toggleTemp does nothing while stopped', () => {
    const { result } = renderHook(() => useHarness(false));
    act(() => result.current.pm.toggleTemp());
    expect(result.current.pm.tempState).toBe('off');
  });

  it('armed temp snapshots home on next pattern', () => {
    const { result } = renderHook(() => useHarness(true));
    const homeTracks = result.current.config.tracks;
    act(() => result.current.pm.toggleTemp());
    expect(result.current.pm.tempState).toBe('armed');
    act(() => result.current.pm.setPattern(A));
    expect(result.current.pm.tempState).toBe('active');
    expect(result.current.pm.tempStateRef.current)
      .toBe('active');
    const snap = result.current.pm.homeSnapshotRef.current;
    expect(snap?.selectedPatternId).toBe('start');
    expect(snap?.tracks).toEqual(homeTracks);
    // Snapshot is a copy, not the live object.
    expect(snap?.tracks).not.toBe(homeTracks);
  });

  it('toggling temp off clears snapshot and pending', () => {
    const { result } = renderHook(() => useHarness(true));
    act(() => result.current.pm.setPatternMode('sequential'));
    act(() => result.current.pm.toggleTemp());
    act(() => result.current.pm.setPattern(A));
    act(() => result.current.pm.toggleTemp());
    expect(result.current.pm.tempState).toBe('off');
    expect(result.current.pm.homeSnapshotRef.current)
      .toBeNull();
    expect(result.current.pm.pendingPatternRef.current)
      .toBeNull();
  });

  it('T key toggles temp while playing', () => {
    const { result } = renderHook(() => useHarness(true));
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyT' })
      );
    });
    expect(result.current.pm.tempState).toBe('armed');
  });

  it('reset clears temp, snapshot and pending', () => {
    const { result } = renderHook(() => useHarness(true));
    act(() => result.current.pm.setPatternMode('sequential'));
    act(() => result.current.pm.toggleTemp());
    act(() => result.current.pm.setPattern(A));
    act(() => result.current.pm.reset());
    expect(result.current.pm.tempState).toBe('off');
    expect(result.current.pm.tempStateRef.current).toBe('off');
    expect(result.current.pm.homeSnapshotRef.current)
      .toBeNull();
    expect(result.current.pm.pendingPatternRef.current)
      .toBeNull();
  });
});
