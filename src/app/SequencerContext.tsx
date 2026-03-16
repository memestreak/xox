"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import { audioEngine } from './AudioEngine';
import { defaultConfig, decodeConfig } from './configCodec';
import { TRACK_IDS } from './types';
import type {
  Kit,
  Pattern,
  SequencerConfig,
  TrackId,
  TrackState,
} from './types';

/**
 * Track definitions for the sequencer grid (excludes accent).
 */
export const TRACKS: { id: TrackId; name: string }[] = [
  { id: 'bd', name: 'Kick' },
  { id: 'sd', name: 'Snare' },
  { id: 'ch', name: 'C-Hat' },
  { id: 'oh', name: 'O-Hat' },
  { id: 'cy', name: 'Cymbal' },
  { id: 'ht', name: 'Hi-Tom' },
  { id: 'mt', name: 'Mid-Tom' },
  { id: 'lt', name: 'Low-Tom' },
  { id: 'rs', name: 'Rimshot' },
  { id: 'cp', name: 'Clap' },
  { id: 'cb', name: 'Cowbell' },
];

/** Map of TrackId to display name (includes accent). */
const TRACK_NAMES: Record<TrackId, string> = {
  ac: 'Accent',
  bd: 'Kick',
  sd: 'Snare',
  ch: 'C-Hat',
  oh: 'O-Hat',
  cy: 'Cymbal',
  ht: 'Hi-Tom',
  mt: 'Mid-Tom',
  lt: 'Low-Tom',
  rs: 'Rimshot',
  cp: 'Clap',
  cb: 'Cowbell',
};

// ─── Interfaces ──────────────────────────────────────

interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  patternLength: number;
  trackLengths: Record<TrackId, number>;
  currentKit: Kit;
  currentPattern: Pattern;
  trackStates: Record<TrackId, TrackState>;
  isLoaded: boolean;
  swing: number;
}

interface SequencerActions {
  togglePlay: () => void;
  setBpm: (bpm: number) => void;
  setKit: (kit: Kit) => void;
  setPattern: (pattern: Pattern) => void;
  toggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  toggleMute: (trackId: TrackId) => void;
  toggleSolo: (trackId: TrackId) => void;
  setGain: (trackId: TrackId, value: number) => void;
  toggleFreeRun: (trackId: TrackId) => void;
  setPatternLength: (length: number) => void;
  setTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  clearAll: () => void;
  setSwing: (value: number) => void;
}

interface SequencerMeta {
  stepRef: React.RefObject<number>;
  totalStepsRef: React.RefObject<number>;
  config: SequencerConfig;
}

interface SequencerContextValue {
  state: SequencerState;
  actions: SequencerActions;
  meta: SequencerMeta;
}

// ─── Contexts ─────────────────────────────────────────

/** Config context: serializable state that changes on edits. */
const ConfigContext = createContext<{
  config: SequencerConfig;
  setConfig: React.Dispatch<
    React.SetStateAction<SequencerConfig>
  >;
  selectedPatternId: string;
  setSelectedPatternId: React.Dispatch<
    React.SetStateAction<string>
  >;
} | null>(null);

/** Transient context: playback/UI state. */
const TransientContext = createContext<{
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  isLoaded: boolean;
  setIsLoaded: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  stepRef: React.RefObject<number>;
} | null>(null);

/** Combined context for the public useSequencer() hook. */
const SequencerContext = createContext<
  SequencerContextValue | null
>(null);

/**
 * Hook to access sequencer context. Throws if used outside
 * SequencerProvider.
 */
export function useSequencer(): SequencerContextValue {
  const ctx = useContext(SequencerContext);
  if (!ctx) {
    throw new Error(
      'useSequencer must be used within SequencerProvider'
    );
  }
  return ctx;
}

interface SequencerProviderProps {
  children: ReactNode;
}

/**
 * Provides all sequencer state, actions, and audio engine
 * integration to the component tree.
 *
 * Internally split into ConfigContext (serializable state)
 * and TransientContext (playback/UI) for render isolation.
 */
export function SequencerProvider({
  children,
}: SequencerProviderProps) {
  // ─── Config state ─────────────────────────────────
  const [config, setConfig] = useState<SequencerConfig>(
    defaultConfig
  );
  const [selectedPatternId, setSelectedPatternId] =
    useState(patternsData.patterns[0].id);

  // ─── Transient state ──────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const stepRef = useRef<number>(-1);
  const totalStepsRef = useRef<number>(0);

  // ─── Import config from URL hash on mount ─────────
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    decodeConfig(hash)
      .then(decoded => {
        setConfig(decoded);
        setSelectedPatternId('custom');
      })
      .catch(() => {
        // Silently fall back to default config
      });
  }, []);

  // ─── Derived state via useMemo ────────────────────

  const currentKit = useMemo<Kit>(() => {
    const kit = kitsData.kits.find(
      k => k.id === config.kitId
    );
    return kit ?? kitsData.kits[0];
  }, [config.kitId]);

  const currentPattern = useMemo<Pattern>(() => {
    if (selectedPatternId === 'custom') {
      return {
        id: 'custom',
        name: 'Custom',
        steps: config.steps,
      };
    }
    const preset = patternsData.patterns.find(
      p => p.id === selectedPatternId
    );
    return {
      id: selectedPatternId,
      name: preset?.name ?? 'Custom',
      steps: config.steps,
    };
  }, [config.steps, selectedPatternId]);

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
        isMuted: m.isMuted,
        isSolo: m.isSolo,
        freeRun: m.freeRun,
      };
    }
    return result;
  }, [config.mixer]);

  // ─── Audio refs (belt-and-suspenders) ─────────────

  const trackStatesRef = useRef(trackStates);
  const patternRef = useRef(currentPattern);
  const configRef = useRef(config);

  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  useEffect(() => {
    patternRef.current = currentPattern;
  }, [currentPattern]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // ─── Effects ──────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setIsLoaded(false);
      await audioEngine.preloadKit(currentKit.folder);
      setIsLoaded(true);
    };
    load();
  }, [currentKit]);

  useEffect(() => {
    return () => {
      audioEngine.stop();
    };
  }, []);

  useEffect(() => {
    audioEngine.setBpm(config.bpm);
  }, [config.bpm]);

  useEffect(() => {
    audioEngine.setPatternLength(config.patternLength);
  }, [config.patternLength]);

  // ─── Audio step callback ──────────────────────────

  const handleStep = useCallback(
    (step: number, time: number) => {
      const total = totalStepsRef.current;
      totalStepsRef.current = total + 1;
      stepRef.current = step;

      const states = trackStatesRef.current;
      const pattern = patternRef.current;
      const cfg = configRef.current;
      const anySolo = Object.values(states).some(
        t => t.isSolo
      );

      const trackStep = (
        id: TrackId
      ): number => {
        const len = cfg.trackLengths[id];
        return cfg.mixer[id].freeRun
          ? total % len
          : step % len;
      };

      const isAccented =
        pattern.steps.ac[
          trackStep('ac')
        ] === '1';

      TRACKS.forEach(track => {
        const st = states[track.id];
        const audible = anySolo
          ? st.isSolo
          : !st.isMuted;
        if (!audible) return;

        const effectiveStep = trackStep(track.id);
        if (
          pattern.steps[track.id][effectiveStep] === '1'
        ) {
          const cubic = st.gain ** 3;
          const gain =
            isAccented ? cubic * 1.5 : cubic;
          audioEngine.playSound(
            track.id, time, gain
          );
        }
      });
    },
    []
  );

  useEffect(() => {
    if (isPlaying) {
      audioEngine.onStep = handleStep;
    }
  }, [handleStep, isPlaying]);

  // ─── Actions ──────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      stepRef.current = -1;
      totalStepsRef.current = 0;
    } else {
      totalStepsRef.current = 0;
      audioEngine.start(
        config.bpm,
        handleStep,
        config.patternLength
      );
      setIsPlaying(true);
    }
  }, [isPlaying, config.bpm, config.patternLength,
    handleStep]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
      const tag =
        (event.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) return;
      event.preventDefault();
      togglePlay();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () =>
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
  }, [togglePlay, isLoaded]);

  const setBpm = useCallback((v: number) => {
    setConfig(prev => ({ ...prev, bpm: v }));
  }, []);

  const setKit = useCallback((kit: Kit) => {
    setConfig(prev => ({ ...prev, kitId: kit.id }));
  }, []);

  const setPattern = useCallback((pattern: Pattern) => {
    setConfig(prev => {
      const newSteps = { ...pattern.steps };
      for (const id of TRACK_IDS) {
        const cur = newSteps[id] ?? '';
        const len = prev.trackLengths[id];
        if (cur.length < len) {
          newSteps[id] = cur.padEnd(len, '0');
        } else if (cur.length > len) {
          newSteps[id] = cur.substring(0, len);
        }
      }
      return { ...prev, steps: newSteps };
    });
    setSelectedPatternId(pattern.id);
  }, []);

  const toggleStep = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        if (
          stepIndex >= prev.trackLengths[trackId]
        ) {
          return prev;
        }
        const cur = prev.steps[trackId];
        const bit =
          cur[stepIndex] === '1' ? '0' : '1';
        const next =
          cur.substring(0, stepIndex) +
          bit +
          cur.substring(stepIndex + 1);
        return {
          ...prev,
          steps: { ...prev.steps, [trackId]: next },
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const toggleFreeRun = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            freeRun: !prev.mixer[trackId].freeRun,
          },
        },
      }));
    },
    []
  );

  const setPatternLength = useCallback(
    (length: number) => {
      const clamped =
        Math.max(1, Math.min(16, length));
      setConfig(prev => {
        const newTrackLengths = {
          ...prev.trackLengths,
        };
        const newSteps = { ...prev.steps };
        for (const id of TRACK_IDS) {
          if (newTrackLengths[id] > clamped) {
            newTrackLengths[id] = clamped;
          }
          const cur = newSteps[id];
          if (cur.length < clamped) {
            newSteps[id] = cur.padEnd(clamped, '0');
          } else if (cur.length > clamped) {
            newSteps[id] = cur.substring(0, clamped);
          }
        }
        return {
          ...prev,
          patternLength: clamped,
          trackLengths: newTrackLengths,
          steps: newSteps,
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const setTrackLength = useCallback(
    (trackId: TrackId, length: number) => {
      setConfig(prev => {
        const clamped = Math.max(
          1,
          Math.min(prev.patternLength, length)
        );
        const cur = prev.steps[trackId];
        let newSteps: string;
        if (cur.length < clamped) {
          newSteps = cur.padEnd(clamped, '0');
        } else {
          newSteps = cur.substring(0, clamped);
        }
        return {
          ...prev,
          trackLengths: {
            ...prev.trackLengths,
            [trackId]: clamped,
          },
          steps: {
            ...prev.steps,
            [trackId]: newSteps,
          },
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const toggleMute = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            isMuted: !prev.mixer[trackId].isMuted,
          },
        },
      }));
    },
    []
  );

  const toggleSolo = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            isSolo: !prev.mixer[trackId].isSolo,
          },
        },
      }));
    },
    []
  );

  const setGain = useCallback(
    (trackId: TrackId, value: number) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            gain: value,
          },
        },
      }));
    },
    []
  );

  const clearAll = useCallback(() => {
    setConfig(prev => {
      const newSteps = {} as Record<TrackId, string>;
      const newTrackLengths = {} as Record<
        TrackId, number
      >;
      for (const id of TRACK_IDS) {
        newSteps[id] =
          '0'.repeat(prev.patternLength);
        newTrackLengths[id] = prev.patternLength;
      }
      return {
        ...prev,
        steps: newSteps,
        trackLengths: newTrackLengths,
        swing: 0,
      };
    });
    setSelectedPatternId('custom');
  }, []);

  const setSwing = useCallback(
    (value: number) => {
      setConfig(prev => ({
        ...prev,
        swing: Math.max(0, Math.min(100, value)),
      }));
    },
    []
  );

  // ─── Context value ────────────────────────────────

  const value: SequencerContextValue = {
    state: {
      isPlaying,
      bpm: config.bpm,
      patternLength: config.patternLength,
      trackLengths: config.trackLengths,
      currentKit,
      currentPattern,
      trackStates,
      isLoaded,
      swing: config.swing,
    },
    actions: {
      togglePlay,
      setBpm,
      setKit,
      setPattern,
      toggleStep,
      toggleMute,
      toggleSolo,
      setGain,
      toggleFreeRun,
      setPatternLength,
      setTrackLength,
      clearAll,
      setSwing,
    },
    meta: { stepRef, totalStepsRef, config },
  };

  return (
    <ConfigContext
      value={{
        config,
        setConfig,
        selectedPatternId,
        setSelectedPatternId,
      }}
    >
      <TransientContext
        value={{
          isPlaying,
          setIsPlaying,
          isLoaded,
          setIsLoaded,
          stepRef,
        }}
      >
        <SequencerContext value={value}>
          {children}
        </SequencerContext>
      </TransientContext>
    </ConfigContext>
  );
}
