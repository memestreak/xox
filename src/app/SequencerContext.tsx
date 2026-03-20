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
import { evaluateCondition } from './trigConditions';
import { TRACK_IDS } from './types';
import type {
  Kit,
  Pattern,
  SequencerConfig,
  StepConditions,
  StepLocks,
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
  isFillActive: boolean;
  fillMode: 'off' | 'latched' | 'momentary';
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

  // ─── Fill state ──────────────────────────────────
  const [isLatched, setIsLatched] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const fillActiveRef = useRef(false);
  const isFillActive = isLatched || isHeld;
  const fillMode: 'off' | 'latched' | 'momentary' =
    isHeld ? 'momentary'
      : isLatched ? 'latched'
        : 'off';

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
  const cycleCountRef = useRef<Record<TrackId, number>>(
    {} as Record<TrackId, number>
  );

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
        const len = cfg.trackLengths[id];
        if (total > 0 && total % len === 0) {
          cycleCountRef.current[id] =
            (cycleCountRef.current[id] ?? 0) + 1;
        }
      }

      const trackStep = (
        id: TrackId
      ): number => {
        const len = cfg.trackLengths[id];
        return cfg.mixer[id].freeRun
          ? total % len
          : step % len;
      };

      const accentStep = trackStep('ac');
      const accentActive =
        pattern.steps.ac[accentStep] === '1';
      let isAccented = false;
      if (accentActive) {
        const accentCond =
          cfg.trigConditions?.ac?.[accentStep];
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
          pattern.steps[track.id][effectiveStep]
            === '1'
        ) {
          const cond =
            cfg.trigConditions
              ?.[track.id]?.[effectiveStep];
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
            cfg.parameterLocks?.[track.id]
              ?.[effectiveStep];
          const baseGain = locks?.gain ?? st.gain;
          const cubic = baseGain ** 3;
          const gain =
            isAccented
              ? cubic * (1 + states.ac.gain)
              : cubic;
          audioEngine.playSound(
            track.id, scheduledTime, gain
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

  const initCycleCounts = useCallback(() => {
    const counts = {} as Record<TrackId, number>;
    for (const id of TRACK_IDS) { counts[id] = 0; }
    cycleCountRef.current = counts;
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      stepRef.current = -1;
      totalStepsRef.current = 0;
      initCycleCounts();
    } else {
      totalStepsRef.current = 0;
      initCycleCounts();
      audioEngine.start(
        config.bpm,
        handleStep,
        config.patternLength
      );
      setIsPlaying(true);
    }
  }, [isPlaying, config.bpm, config.patternLength,
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
      return {
        ...prev,
        steps: newSteps,
        trigConditions:
          pattern.trigConditions ?? {},
        parameterLocks:
          pattern.parameterLocks ?? {},
      };
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

  const setStep = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      value: '0' | '1'
    ) => {
      setConfig(prev => {
        if (
          stepIndex >= prev.trackLengths[trackId]
        ) {
          return prev;
        }
        const cur = prev.steps[trackId];
        if (cur[stepIndex] === value) return prev;
        const next =
          cur.substring(0, stepIndex) +
          value +
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

  const setTrackSteps = useCallback(
    (trackId: TrackId, newSteps: string) => {
      setConfig(prev => {
        if (newSteps === prev.steps[trackId]) {
          return prev;
        }
        return {
          ...prev,
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
        Math.max(1, Math.min(64, length));
      setConfig(prev => {
        const newTrackLengths = {
          ...prev.trackLengths,
        };
        const newSteps = { ...prev.steps };
        const newTrigConds = {
          ...prev.trigConditions,
        };
        const newParamLocks = {
          ...prev.parameterLocks,
        };
        for (const id of TRACK_IDS) {
          if (newTrackLengths[id] > clamped) {
            newTrackLengths[id] = clamped;
          } else if (
            newTrackLengths[id] === prev.patternLength
          ) {
            newTrackLengths[id] = clamped;
          }
          const len = newTrackLengths[id];
          const cur = newSteps[id];
          if (cur.length < len) {
            newSteps[id] = cur.padEnd(len, '0');
          } else if (cur.length > len) {
            newSteps[id] = cur.substring(0, len);
          }
          // Prune conditions beyond new length
          const trackConds = newTrigConds[id];
          if (trackConds) {
            const pruned: Record<
              number, StepConditions
            > = {};
            for (const [k, v] of
              Object.entries(trackConds)) {
              if (Number(k) < len) {
                pruned[Number(k)] = v;
              }
            }
            newTrigConds[id] = pruned;
          }
          // Prune locks beyond new length
          const trackLocks = newParamLocks[id];
          if (trackLocks) {
            const pruned: Record<
              number, StepLocks
            > = {};
            for (const [k, v] of
              Object.entries(trackLocks)) {
              if (Number(k) < len) {
                pruned[Number(k)] = v;
              }
            }
            newParamLocks[id] = pruned;
          }
        }
        return {
          ...prev,
          patternLength: clamped,
          trackLengths: newTrackLengths,
          steps: newSteps,
          trigConditions: newTrigConds,
          parameterLocks: newParamLocks,
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
        // Prune conditions beyond new length
        const trackConds =
          prev.trigConditions[trackId];
        let newTrigConditions =
          prev.trigConditions;
        if (trackConds) {
          const pruned: Record<
            number, StepConditions
          > = {};
          for (const [k, v] of
            Object.entries(trackConds)) {
            if (Number(k) < clamped) {
              pruned[Number(k)] = v;
            }
          }
          newTrigConditions = {
            ...prev.trigConditions,
            [trackId]: pruned,
          };
        }
        // Prune locks beyond new length
        const trackLocks =
          prev.parameterLocks[trackId];
        let newParameterLocks =
          prev.parameterLocks;
        if (trackLocks) {
          const pruned: Record<
            number, StepLocks
          > = {};
          for (const [k, v] of
            Object.entries(trackLocks)) {
            if (Number(k) < clamped) {
              pruned[Number(k)] = v;
            }
          }
          newParameterLocks = {
            ...prev.parameterLocks,
            [trackId]: pruned,
          };
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
          trigConditions: newTrigConditions,
          parameterLocks: newParameterLocks,
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

  const clearAll = useCallback(() => {
    setConfig(prev => {
      const newSteps = {} as Record<TrackId, string>;
      const newTrackLengths = {} as Record<
        TrackId, number
      >;
      const newMixer = { ...prev.mixer };
      for (const id of TRACK_IDS) {
        newSteps[id] =
          '0'.repeat(prev.patternLength);
        newTrackLengths[id] = prev.patternLength;
        newMixer[id] = {
          ...newMixer[id],
          freeRun: false,
        };
      }
      return {
        ...prev,
        steps: newSteps,
        trackLengths: newTrackLengths,
        mixer: newMixer,
        swing: 0,
        trigConditions: {},
        parameterLocks: {},
      };
    });
    setIsLatched(false);
    setIsHeld(false);
    fillActiveRef.current = false;
    setSelectedPatternId('custom');
  }, []);

  const clearTrack = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => {
        const newTrigConditions = {
          ...prev.trigConditions,
        };
        delete newTrigConditions[trackId];
        const newParameterLocks = {
          ...prev.parameterLocks,
        };
        delete newParameterLocks[trackId];
        return {
          ...prev,
          steps: {
            ...prev.steps,
            [trackId]: '0'.repeat(prev.patternLength),
          },
          trackLengths: {
            ...prev.trackLengths,
            [trackId]: prev.patternLength,
          },
          mixer: {
            ...prev.mixer,
            [trackId]: {
              ...prev.mixer[trackId],
              freeRun: false,
            },
          },
          trigConditions: newTrigConditions,
          parameterLocks: newParameterLocks,
        };
      });
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
        trigConditions: {
          ...prev.trigConditions,
          [trackId]: {
            ...prev.trigConditions[trackId],
            [stepIndex]: conditions,
          },
        },
      }));
    },
    []
  );

  const clearTrigCondition = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const trackConds = {
          ...prev.trigConditions[trackId],
        };
        delete trackConds[stepIndex];
        const newTrigConditions = {
          ...prev.trigConditions,
        };
        if (Object.keys(trackConds).length === 0) {
          delete newTrigConditions[trackId];
        } else {
          newTrigConditions[trackId] = trackConds;
        }
        return {
          ...prev,
          trigConditions: newTrigConditions,
        };
      });
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
        parameterLocks: {
          ...prev.parameterLocks,
          [trackId]: {
            ...prev.parameterLocks[trackId],
            [stepIndex]: locks,
          },
        },
      }));
    },
    []
  );

  const clearParameterLock = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const trackLocks = {
          ...prev.parameterLocks[trackId],
        };
        delete trackLocks[stepIndex];
        const newParameterLocks = {
          ...prev.parameterLocks,
        };
        if (Object.keys(trackLocks).length === 0) {
          delete newParameterLocks[trackId];
        } else {
          newParameterLocks[trackId] = trackLocks;
        }
        return {
          ...prev,
          parameterLocks: newParameterLocks,
        };
      });
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
      isFillActive,
      fillMode,
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
