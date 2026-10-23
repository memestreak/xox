import {
  act, renderHook, waitFor,
} from '@testing-library/react';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../app/configCodec';
import { GAIN_EXPONENT } from '../../app/constants';
import { usePlayback } from '../../app/hooks/usePlayback';
import kitsData from '../../app/data/kits.json';
import type {
  HomeSnapshot, Pattern, SequencerConfig, TempState,
  TrackId,
} from '../../app/types';

const engine = vi.hoisted(() => ({
  preloadKit: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  setBpm: vi.fn(),
  setPatternLength: vi.fn(),
  playSound: vi.fn(),
  requestReset: vi.fn(),
  getCurrentTime: vi.fn(() => 1.5),
  onStep: null as unknown,
  onLoadError: (() => {}) as (msg: string) => void,
}));
vi.mock('../../app/AudioEngine', () => ({
  audioEngine: engine,
}));
vi.mock('../../app/MidiEngine', () => ({
  midiEngine: {
    setBpm: vi.fn(),
    stop: vi.fn(),
    sendNote: vi.fn(),
  },
}));

/** Hosts usePlayback with real config state. */
function useHarness() {
  const [config, setConfig] =
    useState<SequencerConfig>(defaultConfig);
  const [selectedPatternId, setSelectedPatternId] =
    useState('start');
  const configRef = useRef(config);
  const isPlayingRef = useRef(false);
  const fillActiveRef = useRef(false);
  const pendingPatternRef = useRef<Pattern | null>(null);
  const tempStateRef = useRef<TempState>('off');
  const homeSnapshotRef = useRef<HomeSnapshot | null>(null);
  const cycleCountRef = useRef(
    {} as Record<TrackId, number>
  );
  const [initCycleCounts] = useState(() => vi.fn());
  const [patternModeReset] = useState(() => vi.fn());
  const pb = usePlayback({
    config,
    configRef,
    isPlayingRef,
    setConfig,
    setSelectedPatternId,
    fillActiveRef,
    pendingPatternRef,
    tempStateRef,
    homeSnapshotRef,
    cycleCountRef,
    initCycleCounts,
    patternModeReset,
  });
  return {
    pb, config, selectedPatternId, isPlayingRef,
    tempStateRef, homeSnapshotRef,
    initCycleCounts, patternModeReset, setConfig,
  };
}

async function renderLoaded() {
  const hook = renderHook(() => useHarness());
  await waitFor(() =>
    expect(hook.result.current.pb.isLoaded).toBe(true)
  );
  return hook.result;
}

describe('usePlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    engine.preloadKit.mockResolvedValue(true);
  });

  it('preloads the current kit and becomes loaded', async () => {
    const r = await renderLoaded();
    expect(engine.preloadKit).toHaveBeenCalledWith(
      kitsData.kits[0].folder
    );
    expect(r.current.pb.currentKit.id)
      .toBe(kitsData.kits[0].id);
  });

  it('stays unloaded if preload was superseded', async () => {
    engine.preloadKit.mockResolvedValue(false);
    const { result } = renderHook(() => useHarness());
    await waitFor(() =>
      expect(engine.preloadKit).toHaveBeenCalled()
    );
    expect(result.current.pb.isLoaded).toBe(false);
  });

  it('setKit switches kit and reloads', async () => {
    const r = await renderLoaded();
    const other = kitsData.kits[1];
    act(() => r.current.pb.setKit(other));
    expect(r.current.pb.currentKit.id).toBe(other.id);
    await waitFor(() =>
      expect(engine.preloadKit)
        .toHaveBeenLastCalledWith(other.folder)
    );
  });

  it('surfaces and dismisses kit load errors', async () => {
    const r = await renderLoaded();
    act(() => engine.onLoadError('boom'));
    expect(r.current.pb.loadError).toBe('boom');
    act(() => r.current.pb.dismissError());
    expect(r.current.pb.loadError).toBeNull();
  });

  it('setBpm updates config and syncs the engine', async () => {
    const r = await renderLoaded();
    act(() => r.current.pb.setBpm(140));
    expect(r.current.config.bpm).toBe(140);
    expect(engine.setBpm).toHaveBeenLastCalledWith(140);
  });

  it('togglePlay starts then stops the engine', async () => {
    const r = await renderLoaded();
    act(() => r.current.pb.togglePlay());
    expect(r.current.pb.isPlaying).toBe(true);
    expect(r.current.isPlayingRef.current).toBe(true);
    expect(engine.start).toHaveBeenCalledWith(
      r.current.config.bpm,
      expect.any(Function),
      expect.any(Number)
    );
    expect(r.current.initCycleCounts).toHaveBeenCalled();

    act(() => r.current.pb.togglePlay());
    expect(r.current.pb.isPlaying).toBe(false);
    expect(r.current.isPlayingRef.current).toBe(false);
    expect(engine.stop).toHaveBeenCalled();
    expect(r.current.patternModeReset).toHaveBeenCalled();
    expect(r.current.pb.stepRef.current).toBe(-1);
  });

  it('stopping during active temp restores home', async () => {
    const r = await renderLoaded();
    const home = r.current.config.tracks;
    act(() => r.current.pb.togglePlay());
    r.current.tempStateRef.current = 'active';
    r.current.homeSnapshotRef.current = {
      tracks: home,
      selectedPatternId: 'home-pattern',
    };
    act(() => r.current.setConfig(prev => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        bd: { steps: '1'.repeat(16) },
      },
    })));
    act(() => r.current.pb.togglePlay());
    expect(r.current.config.tracks).toBe(home);
    expect(r.current.selectedPatternId).toBe('home-pattern');
  });

  it('spacebar toggles play once loaded', async () => {
    const r = await renderLoaded();
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space' })
      );
    });
    expect(r.current.pb.isPlaying).toBe(true);
  });

  it.each([
    ['range slider', 'input', 'range'],
    ['BPM number field', 'input', 'number'],
    ['select', 'select', ''],
  ])('spacebar toggles play from a focused %s', async (
    _name, tag, type
  ) => {
    const r = await renderLoaded();
    const el = document.createElement(tag);
    if (type) (el as HTMLInputElement).type = type;
    document.body.appendChild(el);
    const event = new KeyboardEvent('keydown', {
      code: 'Space', bubbles: true, cancelable: true,
    });
    act(() => {
      el.dispatchEvent(event);
    });
    expect(r.current.pb.isPlaying).toBe(true);
    // Default (e.g. opening the select) is suppressed.
    expect(event.defaultPrevented).toBe(true);
    el.remove();
  });

  it.each([
    ['text field', 'input', 'text'],
    ['checkbox', 'input', 'checkbox'],
    ['textarea', 'textarea', ''],
  ])('spacebar is left to a focused %s', async (
    _name, tag, type
  ) => {
    const r = await renderLoaded();
    const el = document.createElement(tag);
    if (type) (el as HTMLInputElement).type = type;
    document.body.appendChild(el);
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', {
        code: 'Space', bubbles: true, cancelable: true,
      }));
    });
    expect(r.current.pb.isPlaying).toBe(false);
    el.remove();
  });

  it('spacebar is ignored before the kit loads', () => {
    engine.preloadKit.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHarness());
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space' })
      );
    });
    expect(result.current.pb.isPlaying).toBe(false);
  });

  it('spacebar is ignored while a modal dialog is open', async () => {
    const r = await renderLoaded();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Space' })
      );
    });
    expect(r.current.pb.isPlaying).toBe(false);
    dialog.remove();
  });

  it('playPreview uses cubic gain and track pan', async () => {
    const r = await renderLoaded();
    act(() => r.current.setConfig(prev => ({
      ...prev,
      mixer: {
        ...prev.mixer,
        sd: { ...prev.mixer.sd, gain: 0.5, pan: 0.2 },
      },
    })));
    act(() => r.current.pb.playPreview('sd'));
    expect(engine.playSound).toHaveBeenCalledWith(
      'sd', 1.5, 0.5 ** GAIN_EXPONENT, 0.2
    );
  });

  it('trackStates mirrors the mixer with display names', async () => {
    const r = await renderLoaded();
    const bd = r.current.pb.trackStates.bd;
    expect(bd.name).toBe('BD');
    expect(bd.gain).toBe(r.current.config.mixer.bd.gain);
    expect(r.current.pb.trackStates.ac.name).toBe('ACCENT');
  });
});
