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
import { GAIN_EXPONENT } from '../constants';
import { getPatternLength } from '../types';
import { enqueueStep } from '../stepQueue';
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
  patternModeReset: () => void;
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
  patternModeReset,
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

  const trackStates = useMemo<
    Record<TrackId, TrackState>
  >(() => {
    const result = {} as Record<TrackId, TrackState>;
    for (const id of Object.keys(
      config.mixer
    ) as TrackId[]) {
      const m = config.mixer[id];
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
  }, [config.mixer]);

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
        pendingPatternRef.current = null;
        setConfig(prev => ({
          ...prev,
          tracks: newCfg.tracks,
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
        if (needsReset) {
          audioEngine.setPatternLength(snapPatLen);
        }
        audioEngine.requestReset();
        setConfig(prev => ({
          ...prev,
          tracks: newCfg.tracks,
        }));
        setSelectedPatternId(snapPatId);
        patternModeReset();
      }
    },
    [configRef, cycleCountRef, fillActiveRef,
      pendingPatternRef, tempStateRef, homeSnapshotRef,
      setConfig, setSelectedPatternId, patternModeReset]
  );

  useEffect(() => {
    if (isPlaying) {
      audioEngine.onStep = handleStep;
    }
  }, [handleStep, isPlaying]);

  // ─── Actions ──────────────────────────────────

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      // Revert temp if active
      if (tempStateRef.current === 'active'
          && homeSnapshotRef.current) {
        const snap = homeSnapshotRef.current;
        setConfig(prev => ({
          ...prev,
          tracks: snap.tracks,
        }));
        setSelectedPatternId(
          snap.selectedPatternId
        );
      }
      patternModeReset();

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
      audioEngine.start(
        config.bpm,
        handleStep,
        getPatternLength(config.tracks)
      );
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, [isPlaying, config.bpm, config.tracks,
    handleStep, initCycleCounts, tempStateRef,
    homeSnapshotRef, setConfig, setSelectedPatternId,
    patternModeReset, isPlayingRef]);

  // Spacebar shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      const target = event.target as HTMLElement;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) return;
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
