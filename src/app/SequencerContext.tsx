"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import { audioEngine } from './AudioEngine';
import { Kit, Pattern, TrackId, TrackState } from './types';

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

const INITIAL_TRACK_STATES: Record<TrackId, TrackState> = {
  ac: {
    id: 'ac', name: 'Accent',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  bd: {
    id: 'bd', name: 'Kick',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  sd: {
    id: 'sd', name: 'Snare',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  ch: {
    id: 'ch', name: 'C-Hat',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  oh: {
    id: 'oh', name: 'O-Hat',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  cy: {
    id: 'cy', name: 'Cymbal',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  ht: {
    id: 'ht', name: 'Hi-Tom',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  mt: {
    id: 'mt', name: 'Mid-Tom',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  lt: {
    id: 'lt', name: 'Low-Tom',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  rs: {
    id: 'rs', name: 'Rimshot',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  cp: {
    id: 'cp', name: 'Clap',
    isMuted: false, isSolo: false, gain: 1.0,
  },
  cb: {
    id: 'cb', name: 'Cowbell',
    isMuted: false, isSolo: false, gain: 1.0,
  },
};

interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  currentKit: Kit;
  currentPattern: Pattern;
  trackStates: Record<TrackId, TrackState>;
  isLoaded: boolean;
  showMixer: boolean;
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
  toggleMixer: () => void;
}

interface SequencerMeta {
  stepRef: React.RefObject<number>;
}

interface SequencerContextValue {
  state: SequencerState;
  actions: SequencerActions;
  meta: SequencerMeta;
}

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
 */
export function SequencerProvider({
  children,
}: SequencerProviderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(110);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentKit, setCurrentKit] = useState<Kit>(
    kitsData.kits[0]
  );
  const [currentPattern, setCurrentPattern] =
    useState<Pattern>(patternsData.patterns[0]);
  const [showMixer, setShowMixer] = useState(false);
  const [trackStates, setTrackStates] =
    useState<Record<TrackId, TrackState>>(
      INITIAL_TRACK_STATES
    );

  // Ref-based step tracking: avoids full re-renders on
  // every 16th-note tick during playback.
  const stepRef = useRef<number>(-1);

  // Refs for values needed in the audio callback to avoid
  // stale closures and unnecessary effect re-runs.
  const trackStatesRef = useRef(trackStates);
  const patternRef = useRef(currentPattern);

  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  useEffect(() => {
    patternRef.current = currentPattern;
  }, [currentPattern]);

  // --- Effects ---

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
    audioEngine.setBpm(bpm);
  }, [bpm]);

  // --- Audio step callback ---

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

  // --- Actions ---

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      stepRef.current = -1;
    } else {
      audioEngine.start(bpm, handleStep);
      setIsPlaying(true);
    }
  }, [isPlaying, bpm, handleStep]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
    setBpmState(v);
  }, []);

  const setKit = useCallback((kit: Kit) => {
    setCurrentKit(kit);
  }, []);

  const setPattern = useCallback((pattern: Pattern) => {
    setCurrentPattern(pattern);
  }, []);

  const toggleStep = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setCurrentPattern(prev => {
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
    },
    []
  );

  const toggleMute = useCallback((trackId: TrackId) => {
    setTrackStates(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        isMuted: !prev[trackId].isMuted,
      },
    }));
  }, []);

  const toggleSolo = useCallback((trackId: TrackId) => {
    setTrackStates(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        isSolo: !prev[trackId].isSolo,
      },
    }));
  }, []);

  const setGain = useCallback(
    (trackId: TrackId, value: number) => {
      setTrackStates(prev => ({
        ...prev,
        [trackId]: {
          ...prev[trackId],
          gain: value,
        },
      }));
    },
    []
  );

  const toggleMixer = useCallback(() => {
    setShowMixer(prev => !prev);
  }, []);

  const value: SequencerContextValue = {
    state: {
      isPlaying,
      bpm,
      currentKit,
      currentPattern,
      trackStates,
      isLoaded,
      showMixer,
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
      toggleMixer,
    },
    meta: { stepRef },
  };

  return (
    <SequencerContext value={value}>
      {children}
    </SequencerContext>
  );
}
