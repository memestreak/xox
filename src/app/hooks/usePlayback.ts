import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import kitsData from '../data/kits.json';
import { audioEngine } from '../AudioEngine';
import { midiEngine } from '../MidiEngine';
import { computeStep } from '../computeStep';
import {
  withDefaultLevels,
  withLevelsFrom,
} from '../mixerUtils';
import { GAIN_EXPONENT } from '../constants';
import { getPatternLength } from '../types';
import { enqueueStep } from '../stepQueue';
import { isModalDialogOpen } from '../keyboardUtils';
import type { StepEvent } from '../stepQueue';
import type {
  HomeSnapshot,
  Kit,
  Pattern,
  SequencerConfig,
  TempState,
  TrackId,
  TrackState,
} from '../types';

/** Map of TrackId to display name (includes accent). */
const TRACK_NAMES: Record<TrackId, string> = {
  ac: 'ACCENT',
  bd: 'BD',
  sd: 'SD',
  ch: 'CH',
  oh: 'OH',
  cy: 'CY',
  ht: 'HT',
  mt: 'MT',
  lt: 'LT',
  rs: 'RS',
  cp: 'CP',
  cb: 'CB',
};

/** Mixer state as the audio callback reads it. */
function buildTrackStates(
  mixer: SequencerConfig['mixer']
): Record<TrackId, TrackState> {
  const result = {} as Record<TrackId, TrackState>;
  for (const id of Object.keys(mixer) as TrackId[]) {
    const m = mixer[id];
    result[id] = {
      id,
      name: TRACK_NAMES[id],
      gain: m.gain,
      pan: m.pan,
      isMuted: m.isMuted,
      isSolo: m.isSolo,
    };
  }
  return result;
}

// Input types where Space types a character or toggles
// the control, so it must not start or stop playback.
const SPACE_INPUT_TYPES = new Set([
  'text', 'search', 'email', 'url', 'tel', 'password',
  'checkbox', 'radio',
]);

/**
 * True when Space should go to the focused element
 * rather than toggle playback: text fields, checkboxes
 * and radios. Everything else (sliders, the BPM field,
 * selects, buttons) leaves Space to play/stop.
 */
export function spaceBelongsToTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target instanceof HTMLInputElement) {
    return SPACE_INPUT_TYPES.has(target.type);
  }
  return false;
}

export interface UsePlaybackReturn {
  isPlaying: boolean;
  isLoaded: boolean;
  loadError: string | null;
  currentKit: Kit;
  trackStates: Record<TrackId, TrackState>;
  stepRef: React.RefObject<number>;
  totalStepsRef: React.RefObject<number>;
  triggeredTracksRef: React.RefObject<Set<TrackId>>;
  stepQueueRef: React.RefObject<StepEvent[]>;
  trackStatesRef: React.RefObject<
    Record<TrackId, TrackState>
  >;
  configRef: React.RefObject<SequencerConfig>;
  togglePlay: () => void;
  playPreview: (trackId: TrackId) => void;
  dismissError: () => void;
  setBpm: (bpm: number) => void;
  setKit: (kit: Kit) => void;
}

interface UsePlaybackArgs {
  config: SequencerConfig;
  configRef: React.RefObject<SequencerConfig>;
  isPlayingRef: React.RefObject<boolean>;
  setConfig: React.Dispatch<
    React.SetStateAction<SequencerConfig>
  >;
  setSelectedPatternId: React.Dispatch<
    React.SetStateAction<string>
  >;
  fillActiveRef: React.RefObject<boolean>;
  pendingPatternRef: React.RefObject<Pattern | null>;
  tempStateRef: React.RefObject<TempState>;
  homeSnapshotRef: React.RefObject<
    HomeSnapshot | null
  >;
  cycleCountRef: React.RefObject<
    Record<TrackId, number>
  >;
  initCycleCounts: () => void;
  /** Pattern and Temp hooks from usePatternMode. */
  onPendingApplied: () => void;
  onTempReverted: () => void;
  onPlaybackStart: () => void;
  onPlaybackStop: () => void;
}

/**
 * Manages playback state, audio engine integration,
 * kit loading, BPM/pattern-length sync, handleStep
 * callback, and spacebar keyboard shortcut.
 */
export function usePlayback({
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
  onPendingApplied,
  onTempReverted,
  onPlaybackStart,
  onPlaybackStop,
}: UsePlaybackArgs): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] =
    useState<string | null>(null);
  const stepRef = useRef<number>(-1);
  const totalStepsRef = useRef<number>(0);
  const triggeredTracksRef = useRef<Set<TrackId>>(
    new Set()
  );
  // Steps are scheduled up to SCHEDULE_AHEAD_S early;
  // the grid shows each one when its time arrives.
  const stepQueueRef = useRef<StepEvent[]>([]);

  // Derived state
  const currentKit = useMemo<Kit>(() => {
    const kit = kitsData.kits.find(
      k => k.id === config.kitId
    );
    return kit ?? kitsData.kits[0];
  }, [config.kitId]);

  const trackStates = useMemo(
    () => buildTrackStates(config.mixer),
    [config.mixer]
  );

  // Ref for audio callback
  const trackStatesRef = useRef(trackStates);

  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  // ─── Audio engine effects ─────────────────────

  useEffect(() => {
    audioEngine.onLoadError = (msg) =>
      setLoadError(msg);
    return () => {
      audioEngine.onLoadError = () => {};
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoaded(false);
      setLoadError(null);
      const installed = await audioEngine.preloadKit(
        currentKit.folder
      );
      // A newer kit selection owns isLoaded now.
      if (installed && !cancelled) setIsLoaded(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentKit]);

  useEffect(() => {
    return () => {
      audioEngine.stop();
    };
  }, []);

  useEffect(() => {
    audioEngine.setBpm(config.bpm);
    midiEngine.setBpm(config.bpm);
  }, [config.bpm]);

  useEffect(() => {
    audioEngine.setPatternLength(
      getPatternLength(config.tracks)
    );
  }, [config.tracks]);

  // ─── Audio step callback ──────────────────────

  const handleStep = useCallback(
    (step: number, time: number, late = false) => {
      stepRef.current = step;

      const result = computeStep(step, time, {
        trackStates: trackStatesRef.current,
        config: configRef.current,
        totalSteps: totalStepsRef.current,
        cycleCounts: cycleCountRef.current,
        fillActive: fillActiveRef.current,
        pendingPattern: pendingPatternRef.current,
        tempState: tempStateRef.current,
        homeSnapshot: homeSnapshotRef.current,
      });

      totalStepsRef.current = result.totalSteps;
      cycleCountRef.current = result.cycleCounts;
      triggeredTracksRef.current =
        result.triggeredTracks;
      enqueueStep(stepQueueRef.current, {
        step,
        totalSteps: result.totalSteps,
        time,
        triggered: late
          ? new Set()
          : result.triggeredTracks,
      });

      // Late steps (timer throttled in a background
      // tab) advance state but stay silent.
      const sounds = late ? [] : result.sounds;
      for (const [trackId, scheduledTime, gain, pan]
        of sounds) {
        audioEngine.playSound(
          trackId, scheduledTime, gain, pan
        );
        const perfTimeMs = performance.now()
          + (scheduledTime
            - audioEngine.getCurrentTime()) * 1000;
        midiEngine.sendNote(
          trackId, perfTimeMs, gain
        );
      }

      if (result.applyPending) {
        const { config: newCfg, patternId } =
          result.applyPending;
        configRef.current = newCfg;
        // The next steps may be scheduled before React
        // re-renders, so they need the new levels now.
        trackStatesRef.current =
          buildTrackStates(newCfg.mixer);
        onPendingApplied();
        setConfig(prev => ({
          ...prev,
          tracks: newCfg.tracks,
          mixer: withDefaultLevels(prev.mixer),
        }));
        setSelectedPatternId(patternId);
      }

      if (result.revertTemp) {
        const {
          config: newCfg,
          selectedPatternId: snapPatId,
          patternLength: snapPatLen,
          needsReset,
        } = result.revertTemp;
        configRef.current = newCfg;
        trackStatesRef.current =
          buildTrackStates(newCfg.mixer);
        if (needsReset) {
          audioEngine.setPatternLength(snapPatLen);
        }
        audioEngine.requestReset();
        const homeMixer =
          homeSnapshotRef.current?.mixer;
        setConfig(prev => ({
          ...prev,
          tracks: newCfg.tracks,
          mixer: homeMixer
            ? withLevelsFrom(prev.mixer, homeMixer)
            : prev.mixer,
        }));
        setSelectedPatternId(snapPatId);
        onTempReverted();
      }
    },
    [configRef, cycleCountRef, fillActiveRef,
      pendingPatternRef, tempStateRef, homeSnapshotRef,
      setConfig, setSelectedPatternId, onPendingApplied,
      onTempReverted]
  );

  useEffect(() => {
    if (isPlaying) {
      audioEngine.onStep = handleStep;
    }
  }, [handleStep, isPlaying]);

  // ─── Actions ──────────────────────────────────

  // Reads refs instead of state so the callback stays
  // stable and the actions context value isn't rebuilt
  // on every config edit.
  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      // Revert temp if active
      if (tempStateRef.current === 'active'
          && homeSnapshotRef.current) {
        const snap = homeSnapshotRef.current;
        setConfig(prev => ({
          ...prev,
          tracks: snap.tracks,
          mixer: withLevelsFrom(prev.mixer, snap.mixer),
        }));
        setSelectedPatternId(
          snap.selectedPatternId
        );
      }
      onPlaybackStop();

      audioEngine.stop();
      midiEngine.stop();
      isPlayingRef.current = false;
      setIsPlaying(false);
      stepRef.current = -1;
      totalStepsRef.current = 0;
      triggeredTracksRef.current = new Set();
      stepQueueRef.current = [];
      initCycleCounts();
    } else {
      totalStepsRef.current = 0;
      stepQueueRef.current = [];
      initCycleCounts();
      const cfg = configRef.current;
      audioEngine.start(
        cfg.bpm,
        handleStep,
        getPatternLength(cfg.tracks)
      );
      isPlayingRef.current = true;
      setIsPlaying(true);
      onPlaybackStart();
    }
  }, [configRef, handleStep, initCycleCounts,
    tempStateRef,
    homeSnapshotRef, setConfig, setSelectedPatternId,
    onPlaybackStart, onPlaybackStop, isPlayingRef]);

  // Spacebar shortcut (listed in helpContent.ts)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      if (spaceBelongsToTarget(event.target)) return;
      // Help or Settings is open: Space belongs to it.
      if (isModalDialogOpen()) return;
      event.preventDefault();
      togglePlay();
    };
    document.addEventListener(
      'keydown', handleKeyDown
    );
    return () =>
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
  }, [togglePlay, isLoaded]);

  const playPreview = useCallback(
    (trackId: TrackId) => {
      const st = trackStatesRef.current[trackId];
      const cubic = st.gain ** GAIN_EXPONENT;
      audioEngine.playSound(
        trackId,
        audioEngine.getCurrentTime(),
        cubic,
        st.pan
      );
    },
    []
  );

  const dismissError = useCallback(() => {
    setLoadError(null);
  }, []);

  const setBpm = useCallback(
    (v: number) => {
      setConfig(prev => ({ ...prev, bpm: v }));
    },
    [setConfig]
  );

  const setKit = useCallback(
    (kit: Kit) => {
      setConfig(prev => ({
        ...prev,
        kitId: kit.id,
      }));
    },
    [setConfig]
  );

  return {
    isPlaying,
    isLoaded,
    loadError,
    currentKit,
    trackStates,
    stepRef,
    totalStepsRef,
    triggeredTracksRef,
    stepQueueRef,
    trackStatesRef,
    configRef,
    togglePlay,
    playPreview,
    dismissError,
    setBpm,
    setKit,
  };
}
