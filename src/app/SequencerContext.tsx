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

// ─── Interfaces (unchanged consumer API) ──────────────

interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  currentKit: Kit;
  currentPattern: Pattern;
  trackStates: Record<TrackId, TrackState>;
  isLoaded: boolean;
}

interface SequencerActions {
  togglePlay: () => void;
  setBpm: (bpm: number) => void;
  setKit: (kit: Kit) => void;
  setPattern: (pattern: Pattern) => void;
  toggleStep: (trackId: TrackId, stepIndex: number) => void;
  toggleMute: (trackId: TrackId) => void;
  toggleSolo: (trackId: TrackId) => void;
  setGain: (trackId: TrackId, value: number) => void;
}

interface SequencerMeta {
  stepRef: React.RefObject<number>;
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
      };
    }
    return result;
  }, [config.mixer]);

  // ─── Audio refs (belt-and-suspenders) ─────────────

  const trackStatesRef = useRef(trackStates);
  const patternRef = useRef(currentPattern);

  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  useEffect(() => {
    patternRef.current = currentPattern;
  }, [currentPattern]);

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

  // ─── Audio step callback ──────────────────────────

  const handleStep = useCallback(
    (step: number, time: number) => {
      stepRef.current = step;

      const states = trackStatesRef.current;
      const pattern = patternRef.current;
      const anySolo = Object.values(states).some(
        t => t.isSolo
      );
      const isAccented =
        pattern.steps.ac[step] === '1';

      TRACKS.forEach(track => {
        const st = states[track.id];
        const audible = anySolo
          ? st.isSolo
          : !st.isMuted;
        if (
          audible &&
          pattern.steps[track.id][step] === '1'
        ) {
          const cubic = st.gain ** 3;
          const gain = isAccented ? cubic * 1.5 : cubic;
          audioEngine.playSound(track.id, time, gain);
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
    } else {
      audioEngine.start(config.bpm, handleStep);
      setIsPlaying(true);
    }
  }, [isPlaying, config.bpm, handleStep]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
    setConfig(prev => ({
      ...prev,
      steps: pattern.steps,
    }));
    setSelectedPatternId(pattern.id);
  }, []);

  const toggleStep = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
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

  const toggleMute = useCallback((trackId: TrackId) => {
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
  }, []);

  const toggleSolo = useCallback((trackId: TrackId) => {
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
  }, []);

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

  // ─── Context value ────────────────────────────────

  const value: SequencerContextValue = {
    state: {
      isPlaying,
      bpm: config.bpm,
      currentKit,
      currentPattern,
      trackStates,
      isLoaded,
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
    },
    meta: { stepRef, config },
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
