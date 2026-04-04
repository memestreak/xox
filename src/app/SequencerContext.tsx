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
import { midiEngine } from './MidiEngine';
import { defaultConfig, decodeConfig } from './configCodec';
import { evaluateCondition } from './trigConditions';
import {
  ACCENT_GAIN_MULTIPLIER,
  GAIN_EXPONENT,
  MAX_PATTERN_LENGTH,
} from './constants';
import { TRACK_IDS, getPatternLength } from './types';
import type {
  HomeSnapshot,
  Kit,
  Pattern,
  PatternMode,
  SequencerConfig,
  StepConditions,
  StepLocks,
  TempState,
  TrackConfig,
  TrackId,
  TrackState,
} from './types';

/**
 * Track definitions for the sequencer grid (excludes accent).
 */
export const TRACKS: { id: TrackId; name: string }[] = [
  { id: 'bd', name: 'BD' },
  { id: 'sd', name: 'SD' },
  { id: 'ch', name: 'CH' },
  { id: 'oh', name: 'OH' },
  { id: 'cy', name: 'CY' },
  { id: 'ht', name: 'HT' },
  { id: 'mt', name: 'MT' },
  { id: 'lt', name: 'LT' },
  { id: 'rs', name: 'RS' },
  { id: 'cp', name: 'CP' },
  { id: 'cb', name: 'CB' },
];

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

// ─── Interfaces ──────────────────────────────────────

interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  currentKit: Kit;
  trackStates: Record<TrackId, TrackState>;
  isLoaded: boolean;
  loadError: string | null;
  swing: number;
  isFillActive: boolean;
  fillMode: 'off' | 'latched' | 'momentary';
  patternMode: PatternMode;
  tempState: TempState;
  selectedPatternId: string;
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
  setPan: (trackId: TrackId, value: number) => void;
  toggleFreeRun: (trackId: TrackId) => void;
  setPatternLength: (length: number) => void;
  setTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  clearAll: () => void;
  clearTrack: (trackId: TrackId) => void;
  setSwing: (value: number) => void;
  toggleFillLatch: () => void;
  setFillHeld: (held: boolean) => void;
  setStep: (
    trackId: TrackId,
    stepIndex: number,
    value: '0' | '1'
  ) => void;
  setTrackSteps: (
    trackId: TrackId, steps: string
  ) => void;
  setTrigCondition: (
    trackId: TrackId,
    stepIndex: number,
    conditions: StepConditions
  ) => void;
  clearTrigCondition: (
    trackId: TrackId,
    stepIndex: number
  ) => void;
  setParameterLock: (
    trackId: TrackId,
    stepIndex: number,
    locks: StepLocks
  ) => void;
  clearParameterLock: (
    trackId: TrackId,
    stepIndex: number
  ) => void;
  setPatternMode: (mode: PatternMode) => void;
  toggleTemp: () => void;
  playPreview: (trackId: TrackId) => void;
  dismissError: () => void;
}

interface SequencerMeta {
  stepRef: React.RefObject<number>;
  totalStepsRef: React.RefObject<number>;
  triggeredTracksRef: React.RefObject<Set<TrackId>>;
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
  const [loadError, setLoadError] =
    useState<string | null>(null);
  const stepRef = useRef<number>(-1);
  const totalStepsRef = useRef<number>(0);
  const triggeredTracksRef = useRef<Set<TrackId>>(
    new Set()
  );

  // ─── Fill state ──────────────────────────────────
  const [isLatched, setIsLatched] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const fillActiveRef = useRef(false);
  const isFillActive = isLatched || isHeld;
  const fillMode: 'off' | 'latched' | 'momentary' =
    isHeld ? 'momentary'
      : isLatched ? 'latched'
        : 'off';

  // ─── Pattern mode state ─────────────────────────────
  const [patternMode, setPatternMode] =
    useState<PatternMode>('direct-jump');
  const [tempState, setTempState] =
    useState<TempState>('off');
  const [homeSnapshot, setHomeSnapshot] =
    useState<HomeSnapshot | null>(null);
  const [pendingPattern, setPendingPattern] =
    useState<Pattern | null>(null);

  const tempStateRef = useRef<TempState>('off');
  const homeSnapshotRef =
    useRef<HomeSnapshot | null>(null);
  const pendingPatternRef =
    useRef<Pattern | null>(null);

  useEffect(() => {
    tempStateRef.current = tempState;
  }, [tempState]);

  useEffect(() => {
    homeSnapshotRef.current = homeSnapshot;
  }, [homeSnapshot]);

  useEffect(() => {
    pendingPatternRef.current = pendingPattern;
  }, [pendingPattern]);

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

  // ─── Audio refs (belt-and-suspenders) ─────────────

  const trackStatesRef = useRef(trackStates);
  const configRef = useRef(config);
  const cycleCountRef = useRef<Record<TrackId, number>>(
    {} as Record<TrackId, number>
  );

  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // ─── Effects ──────────────────────────────────────

  useEffect(() => {
    audioEngine.onLoadError = (msg) =>
      setLoadError(msg);
    return () => {
      audioEngine.onLoadError = () => {};
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoaded(false);
      setLoadError(null);
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
    midiEngine.setBpm(config.bpm);
  }, [config.bpm]);

  useEffect(() => {
    audioEngine.setPatternLength(
      getPatternLength(config.tracks)
    );
  }, [config.tracks]);

  // ─── Audio step callback ──────────────────────────

  const handleStep = useCallback(
    (step: number, time: number) => {
      const total = totalStepsRef.current;
      totalStepsRef.current = total + 1;
      stepRef.current = step;
      triggeredTracksRef.current = new Set();

      const states = trackStatesRef.current;
      const cfg = configRef.current;

      // Swing: offset odd steps forward in time
      const halfStep =
        (60 / cfg.bpm) * 0.25 / 2;
      const swingOffset = step % 2 === 1
        ? (cfg.swing / 100) * 0.7 * halfStep
        : 0;
      const scheduledTime = time + swingOffset;

      const anySolo = Object.values(states).some(
        t => t.isSolo
      );

      // Increment cycle count at cycle boundaries
      for (const id of TRACK_IDS) {
        const len = cfg.tracks[id].steps.length;
        if (total > 0 && total % len === 0) {
          cycleCountRef.current[id] =
            (cycleCountRef.current[id] ?? 0) + 1;
        }
      }

      const trackStep = (
        id: TrackId
      ): number => {
        const len = cfg.tracks[id].steps.length;
        return cfg.tracks[id].freeRun
          ? total % len
          : step % len;
      };

      const accentStep = trackStep('ac');
      const accentActive =
        cfg.tracks.ac.steps[accentStep] === '1';
      let isAccented = false;
      if (accentActive) {
        const accentCond =
          cfg.tracks.ac.trigConditions?.[accentStep];
        isAccented = evaluateCondition(accentCond, {
          cycleCount:
            cycleCountRef.current.ac ?? 0,
          fillActive: fillActiveRef.current,
        });
      }

      TRACKS.forEach(track => {
        const st = states[track.id];
        const audible = anySolo
          ? st.isSolo
          : !st.isMuted;
        if (!audible) return;

        const effectiveStep = trackStep(track.id);
        if (
          cfg.tracks[track.id]
            .steps[effectiveStep] === '1'
        ) {
          const cond =
            cfg.tracks[track.id]
              .trigConditions?.[effectiveStep];
          const shouldFire = evaluateCondition(
            cond,
            {
              cycleCount:
                cycleCountRef.current[track.id]
                  ?? 0,
              fillActive: fillActiveRef.current,
            }
          );
          if (!shouldFire) return;

          const locks =
            cfg.tracks[track.id]
              .parameterLocks?.[effectiveStep];
          const baseGain = locks?.gain ?? st.gain;
          const cubic = baseGain ** GAIN_EXPONENT;
          const gain =
            isAccented
              ? cubic * (1 + states.ac.gain * ACCENT_GAIN_MULTIPLIER)
              : cubic;
          const pan = locks?.pan ?? st.pan;
          audioEngine.playSound(
            track.id, scheduledTime, gain, pan
          );
          triggeredTracksRef.current.add(track.id);
          // MIDI output (convert AudioContext time to
          // performance.now timestamp)
          const perfTimeMs = performance.now()
            + (scheduledTime
              - audioEngine.getCurrentTime()) * 1000;
          midiEngine.sendNote(
            track.id, perfTimeMs, gain
          );
        }
      });

      // ─── Step boundary: pattern mode hooks ──────
      const patLen = getPatternLength(cfg.tracks);
      if (step === patLen - 1) {
        // Sequential: apply pending pattern
        const pending = pendingPatternRef.current;
        if (pending) {
          configRef.current = {
            ...cfg,
            tracks: pending.tracks,
          };
          pendingPatternRef.current = null;
          // Update React state for UI
          setConfig(prev => ({
            ...prev,
            tracks: pending.tracks,
          }));
          setSelectedPatternId(pending.id);
          setPendingPattern(null);
          // No requestReset — natural wrap
        }

        // Temp revert
        if (
          tempStateRef.current === 'active'
          && homeSnapshotRef.current
          && !pending // Don't revert on same step
                      // as applying pending
        ) {
          const snap = homeSnapshotRef.current;
          const snapPatLen =
            getPatternLength(snap.tracks);
          configRef.current = {
            ...cfg,
            tracks: snap.tracks,
          };
          if (snapPatLen !== patLen) {
            audioEngine.setPatternLength(snapPatLen);
          }
          audioEngine.requestReset();
          // Update React state
          setConfig(prev => ({
            ...prev,
            tracks: snap.tracks,
          }));
          setSelectedPatternId(
            snap.selectedPatternId
          );
          setTempState('off');
          tempStateRef.current = 'off';
          setHomeSnapshot(null);
          homeSnapshotRef.current = null;
        }
      }
    },
    []
  );

  useEffect(() => {
    if (isPlaying) {
      audioEngine.onStep = handleStep;
    }
  }, [handleStep, isPlaying]);

  // ─── Actions ──────────────────────────────────────

  const initCycleCounts = useCallback(() => {
    const counts = {} as Record<TrackId, number>;
    for (const id of TRACK_IDS) { counts[id] = 0; }
    cycleCountRef.current = counts;
  }, []);

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
      // Clear all pattern mode transient state
      setTempState('off');
      tempStateRef.current = 'off';
      setHomeSnapshot(null);
      homeSnapshotRef.current = null;
      setPendingPattern(null);
      pendingPatternRef.current = null;

      audioEngine.stop();
      midiEngine.stop();
      setIsPlaying(false);
      stepRef.current = -1;
      totalStepsRef.current = 0;
      triggeredTracksRef.current = new Set();
      initCycleCounts();
    } else {
      totalStepsRef.current = 0;
      initCycleCounts();
      audioEngine.start(
        config.bpm,
        handleStep,
        getPatternLength(config.tracks)
      );
      setIsPlaying(true);
    }
  }, [isPlaying, config.bpm, config.tracks,
    handleStep, initCycleCounts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
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

  const applyPatternNow = useCallback(
    (pattern: Pattern) => {
      setConfig(prev => ({
        ...prev,
        tracks: pattern.tracks,
      }));
      setSelectedPatternId(pattern.id);
    },
    []
  );

  const setPattern = useCallback(
    (pattern: Pattern) => {
      // When stopped, always apply immediately
      if (!isPlaying) {
        applyPatternNow(pattern);
        return;
      }

      const ts = tempStateRef.current;

      // Temp armed: snapshot home, apply via mode,
      // transition to active
      if (ts === 'armed') {
        const snapshot: HomeSnapshot = {
          tracks: structuredClone(
            configRef.current.tracks
          ),
          selectedPatternId,
        };
        setHomeSnapshot(snapshot);
        homeSnapshotRef.current = snapshot;
        setTempState('active');
        tempStateRef.current = 'active';
      }

      // Temp active: replace temp pattern, keep home
      // (no additional snapshot needed)

      // Apply based on current mode
      switch (patternMode) {
        case 'sequential': {
          setPendingPattern(pattern);
          pendingPatternRef.current = pattern;
          break;
        }
        case 'direct-start': {
          audioEngine.requestReset();
          applyPatternNow(pattern);
          break;
        }
        case 'direct-jump': {
          applyPatternNow(pattern);
          break;
        }
      }
    },
    [isPlaying, patternMode, selectedPatternId,
      applyPatternNow]
  );

  const toggleStep = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const track = prev.tracks[trackId];
        if (stepIndex >= track.steps.length) {
          return prev;
        }
        const cur = track.steps;
        const bit =
          cur[stepIndex] === '1' ? '0' : '1';
        const next =
          cur.substring(0, stepIndex) +
          bit +
          cur.substring(stepIndex + 1);
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: {
              ...track,
              steps: next,
            },
          },
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const setStep = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      value: '0' | '1'
    ) => {
      setConfig(prev => {
        const track = prev.tracks[trackId];
        if (stepIndex >= track.steps.length) {
          return prev;
        }
        const cur = track.steps;
        if (cur[stepIndex] === value) return prev;
        const next =
          cur.substring(0, stepIndex) +
          value +
          cur.substring(stepIndex + 1);
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: {
              ...track,
              steps: next,
            },
          },
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const setTrackSteps = useCallback(
    (trackId: TrackId, newSteps: string) => {
      setConfig(prev => {
        const track = prev.tracks[trackId];
        if (newSteps === track.steps) {
          return prev;
        }
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: {
              ...track,
              steps: newSteps,
            },
          },
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
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            freeRun: !prev.tracks[trackId].freeRun,
          },
        },
      }));
      setSelectedPatternId('custom');
    },
    []
  );

  const setPatternLength = useCallback(
    (length: number) => {
      const clamped =
        Math.max(1, Math.min(MAX_PATTERN_LENGTH, length));
      setConfig(prev => {
        const currentMax =
          getPatternLength(prev.tracks);
        const newTracks = {
          ...prev.tracks,
        } as Record<TrackId, TrackConfig>;
        for (const id of TRACK_IDS) {
          const track = prev.tracks[id];
          const curLen = track.steps.length;
          let newLen: number;
          if (clamped > currentMax) {
            // Grow: ALL tracks extend to N
            newLen = clamped;
          } else {
            // Shrink: only cap tracks > N
            newLen = curLen > clamped
              ? clamped
              : curLen;
          }
          let newSteps = track.steps;
          if (newSteps.length < newLen) {
            newSteps = newSteps.padEnd(newLen, '0');
          } else if (newSteps.length > newLen) {
            newSteps = newSteps.substring(0, newLen);
          }
          newTracks[id] = {
            ...track,
            steps: newSteps,
          };
        }
        return {
          ...prev,
          tracks: newTracks,
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const setTrackLength = useCallback(
    (trackId: TrackId, length: number) => {
      setConfig(prev => {
        const patLen =
          getPatternLength(prev.tracks);
        const clamped = Math.max(
          1,
          Math.min(patLen, length)
        );
        const track = prev.tracks[trackId];
        let newSteps: string;
        if (track.steps.length < clamped) {
          newSteps =
            track.steps.padEnd(clamped, '0');
        } else {
          newSteps =
            track.steps.substring(0, clamped);
        }
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: {
              ...track,
              steps: newSteps,
            },
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
      cycleCountRef.current[trackId] = 0;
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
      cycleCountRef.current[trackId] = 0;
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

  const setPan = useCallback(
    (trackId: TrackId, value: number) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            pan: value,
          },
        },
      }));
    },
    []
  );

  const clearAll = useCallback(() => {
    setConfig(prev => {
      const newTracks = {} as Record<
        TrackId, TrackConfig
      >;
      for (const id of TRACK_IDS) {
        newTracks[id] = { steps: '0'.repeat(16) };
      }
      return {
        ...prev,
        tracks: newTracks,
        swing: 0,
      };
    });
    setIsLatched(false);
    setIsHeld(false);
    fillActiveRef.current = false;
    setSelectedPatternId('custom');
    setTempState('off');
    tempStateRef.current = 'off';
    setHomeSnapshot(null);
    homeSnapshotRef.current = null;
    setPendingPattern(null);
    pendingPatternRef.current = null;
  }, []);

  const clearTrack = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: { steps: '0'.repeat(16) },
        },
      }));
      setSelectedPatternId('custom');
    },
    []
  );

  const setSwing = useCallback(
    (value: number) => {
      setConfig(prev => ({
        ...prev,
        swing: Math.max(0, Math.min(100, value)),
      }));
    },
    []
  );

  const toggleFillLatch = useCallback(() => {
    setIsLatched(prev => {
      const next = !prev;
      fillActiveRef.current = next || isHeld;
      return next;
    });
  }, [isHeld]);

  const setFillHeld = useCallback(
    (held: boolean) => {
      setIsHeld(held);
      if (!held) {
        setIsLatched(false);
        fillActiveRef.current = false;
      } else {
        fillActiveRef.current = true;
      }
    },
    []
  );

  // ─── Fill keyboard shortcut (f key) ─────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat) return;
      const tag =
        (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        toggleFillLatch();
      } else {
        setFillHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF') return;
      setFillHeld(false);
    };

    document.addEventListener(
      'keydown', handleKeyDown
    );
    document.addEventListener(
      'keyup', handleKeyUp
    );
    return () => {
      document.removeEventListener(
        'keydown', handleKeyDown
      );
      document.removeEventListener(
        'keyup', handleKeyUp
      );
    };
  }, [toggleFillLatch, setFillHeld]);

  const setTrigCondition = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      conditions: StepConditions
    ) => {
      setConfig(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            trigConditions: {
              ...prev.tracks[trackId].trigConditions,
              [stepIndex]: conditions,
            },
          },
        },
      }));
      setSelectedPatternId('custom');
    },
    []
  );

  const clearTrigCondition = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const track = prev.tracks[trackId];
        const trackConds = {
          ...track.trigConditions,
        };
        delete trackConds[stepIndex];
        const newTrack = Object.keys(
          trackConds
        ).length === 0
          ? {
              ...track,
              trigConditions: undefined,
            }
          : {
              ...track,
              trigConditions: trackConds,
            };
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: newTrack,
          },
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  const setParameterLock = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      locks: StepLocks
    ) => {
      setConfig(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            parameterLocks: {
              ...prev.tracks[trackId].parameterLocks,
              [stepIndex]: {
                ...prev.tracks[trackId]
                  .parameterLocks?.[stepIndex],
                ...locks,
              },
            },
          },
        },
      }));
      setSelectedPatternId('custom');
    },
    []
  );

  const clearParameterLock = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const track = prev.tracks[trackId];
        const trackLocks = {
          ...track.parameterLocks,
        };
        delete trackLocks[stepIndex];
        const newTrack = Object.keys(
          trackLocks
        ).length === 0
          ? {
              ...track,
              parameterLocks: undefined,
            }
          : {
              ...track,
              parameterLocks: trackLocks,
            };
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: newTrack,
          },
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );

  // ─── Pattern mode actions ────────────────────────

  const toggleTemp = useCallback(() => {
    if (!isPlaying) return;
    setTempState(prev => {
      const next = prev === 'off' ? 'armed' : 'off';
      tempStateRef.current = next;
      if (next === 'off') {
        // Disarming cancels any pending queue
        setPendingPattern(null);
        pendingPatternRef.current = null;
        setHomeSnapshot(null);
        homeSnapshotRef.current = null;
      }
      return next;
    });
  }, [isPlaying]);

  // ─── Temp keyboard shortcut (t key) ─────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || e.repeat) return;
      const tag =
        (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) return;
      e.preventDefault();
      toggleTemp();
    };
    document.addEventListener(
      'keydown', handleKeyDown
    );
    return () => {
      document.removeEventListener(
        'keydown', handleKeyDown
      );
    };
  }, [toggleTemp]);

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

  // ─── Context value ────────────────────────────────

  const value: SequencerContextValue = {
    state: {
      isPlaying,
      bpm: config.bpm,
      currentKit,
      trackStates,
      isLoaded,
      loadError,
      swing: config.swing,
      isFillActive,
      fillMode,
      patternMode,
      tempState,
      selectedPatternId,
    },
    actions: {
      togglePlay,
      setBpm,
      setKit,
      setPattern,
      toggleStep,
      setStep,
      setTrackSteps,
      toggleMute,
      toggleSolo,
      setGain,
      setPan,
      toggleFreeRun,
      setPatternLength,
      setTrackLength,
      clearAll,
      clearTrack,
      setSwing,
      toggleFillLatch,
      setFillHeld,
      setTrigCondition,
      clearTrigCondition,
      setParameterLock,
      clearParameterLock,
      setPatternMode,
      toggleTemp,
      playPreview,
      dismissError,
    },
    meta: {
      stepRef, totalStepsRef,
      triggeredTracksRef, config,
    },
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
