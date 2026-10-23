import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { audioEngine } from '../../app/AudioEngine';
import {
  MASTER_VOLUME_STORAGE_KEY,
  formatDb,
  positionToGain,
  resetMasterVolumeForTests,
  useMasterVolume,
} from '../../app/hooks/useMasterVolume';

vi.mock('../../app/AudioEngine', () => ({
  audioEngine: { setOutputVolume: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  resetMasterVolumeForTests();
});

describe('positionToGain', () => {
  it('uses the cubic track-volume curve', () => {
    expect(positionToGain(0)).toBe(0);
    expect(positionToGain(1)).toBe(1);
    expect(positionToGain(0.5)).toBeCloseTo(0.125);
  });
});

describe('formatDb', () => {
  it('formats unity, cuts and silence', () => {
    expect(formatDb(1)).toBe('0.0 dB');
    expect(formatDb(0.5)).toBe('−6.0 dB');
    expect(formatDb(0)).toBe('−∞ dB');
  });

  it('never shows "−0.0"', () => {
    expect(formatDb(0.9999)).toBe('0.0 dB');
  });
});

describe('useMasterVolume', () => {
  it('defaults to 0 dB and tells the engine', () => {
    const { result } = renderHook(() => useMasterVolume());
    expect(result.current.position).toBe(1);
    expect(audioEngine.setOutputVolume)
      .toHaveBeenLastCalledWith(1);
  });

  it('restores the saved position', () => {
    window.localStorage.setItem(
      MASTER_VOLUME_STORAGE_KEY, '0.5'
    );
    const { result } = renderHook(() => useMasterVolume());
    expect(result.current.position).toBe(0.5);
    expect(audioEngine.setOutputVolume)
      .toHaveBeenLastCalledWith(0.125);
  });

  it('ignores a corrupt saved value', () => {
    window.localStorage.setItem(
      MASTER_VOLUME_STORAGE_KEY, 'loud'
    );
    const { result } = renderHook(() => useMasterVolume());
    expect(result.current.position).toBe(1);
  });

  it('saves, clamps and shares changes between users', () => {
    const a = renderHook(() => useMasterVolume());
    const b = renderHook(() => useMasterVolume());
    act(() => a.result.current.setPosition(0.8));
    expect(b.result.current.position).toBe(0.8);
    expect(window.localStorage.getItem(
      MASTER_VOLUME_STORAGE_KEY
    )).toBe('0.8');
    act(() => a.result.current.setPosition(3));
    expect(a.result.current.position).toBe(1);
  });

  it('mutes, then unmutes to the previous level', () => {
    const { result } = renderHook(() => useMasterVolume());
    act(() => result.current.setPosition(0.6));
    act(() => result.current.toggleMute());
    expect(result.current.position).toBe(0);
    expect(audioEngine.setOutputVolume)
      .toHaveBeenLastCalledWith(0);
    act(() => result.current.toggleMute());
    expect(result.current.position).toBe(0.6);
  });

  it('ignores where the first click of a double-click moved the knob', () => {
    const { result } = renderHook(() => useMasterVolume());
    act(() => result.current.setPosition(0.6));
    // Double-click on the bar: the first press jumps the
    // knob to 0.2 before the double-click registers.
    act(() => {
      result.current.beginGesture();
      result.current.setPosition(0.2);
      result.current.toggleMute();
    });
    expect(result.current.position).toBe(0);
    act(() => {
      result.current.beginGesture();
      result.current.setPosition(0.9);
      result.current.toggleMute();
    });
    expect(result.current.position).toBe(0.6);
  });

  it('unmutes a saved-muted fader to 0 dB', () => {
    window.localStorage.setItem(
      MASTER_VOLUME_STORAGE_KEY, '0'
    );
    const { result } = renderHook(() => useMasterVolume());
    act(() => result.current.toggleMute());
    expect(result.current.position).toBe(1);
  });

  it('still works when localStorage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('denied'); });
    const set = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderHook(() => useMasterVolume());
    act(() => result.current.setPosition(0.3));
    expect(result.current.position).toBe(0.3);
    get.mockRestore();
    set.mockRestore();
  });
});
