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
import patternsData from './data/patterns.json';
import { defaultConfig, decodeConfig } from './configCodec';
import { TRACK_IDS } from './types';
import { useFillMode } from './hooks/useFillMode';
import { usePatternMode } from './hooks/usePatternMode';
import { useTrackConfig } from './hooks/useTrackConfig';
import { usePlayback } from './hooks/usePlayback';
import type {
  Kit,
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
 * Track definitions for the sequencer grid
 * (excludes accent).
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
  setPattern: (
    pattern: import('./types').Pattern
  ) => void;
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

/** Config context: serializable state. */
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

/** Combined context for public useSequencer() hook. */
const SequencerContext = createContext<
  SequencerContextValue | null
>(null);

/**
 * Hook to access sequencer context. Throws if used
 * outside SequencerProvider.
 */
export function useSequencer(): SequencerContextValue {
  const ctx = useContext(SequencerContext);
  if (!ctx) {
    throw new Error(
      'useSequencer must be used within'
        + ' SequencerProvider'
    );
  }
  return ctx;
}

interface SequencerProviderProps {
  children: ReactNode;
}

/**
 * Orchestrator: composes focused hooks and provides
 * the unified sequencer context. The public
 * useSequencer() API (state, actions, meta) is
 * unchanged.
 */
export function SequencerProvider({
  children,
}: SequencerProviderProps) {
  // ─── Shared config state ─────────────────────
  const [config, setConfig] = useState<SequencerConfig>(
    defaultConfig
  );
  const [selectedPatternId, setSelectedPatternId] =
    useState(patternsData.patterns[0].id);

  // Shared refs owned by orchestrator (breaks
  // circular deps between hooks)
  const configRef = useRef(config);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // ─── URL hash import on mount ────────────────
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

  // ─── Compose hooks ───────────────────────────
  const fill = useFillMode();

  const trackConfig = useTrackConfig({
    setConfig,
    setSelectedPatternId,
  });

  const pm = usePatternMode({
    configRef,
    isPlayingRef,
    selectedPatternId,
    setConfig,
    setSelectedPatternId,
  });

  const playback = usePlayback({
    config,
    configRef,
    isPlayingRef,
    setConfig,
    setSelectedPatternId,
    fillActiveRef: fill.fillActiveRef,
    pendingPatternRef: pm.pendingPatternRef,
    tempStateRef: pm.tempStateRef,
    homeSnapshotRef: pm.homeSnapshotRef,
    cycleCountRef: trackConfig.cycleCountRef,
    initCycleCounts: trackConfig.initCycleCounts,
    patternModeReset: pm.reset,
  });

  // ─── clearAll composes all hook resets ────────
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
    setSelectedPatternId('custom');
    fill.reset();
    pm.reset();
    trackConfig.reset();
  }, [fill, pm, trackConfig]);

  // ─── Context value ────────────────────────────
  const value: SequencerContextValue = {
    state: {
      isPlaying: playback.isPlaying,
      bpm: config.bpm,
      currentKit: playback.currentKit,
      trackStates: playback.trackStates,
      isLoaded: playback.isLoaded,
      loadError: playback.loadError,
      swing: config.swing,
      isFillActive: fill.isFillActive,
      fillMode: fill.fillMode,
      patternMode: pm.patternMode,
      tempState: pm.tempState,
      selectedPatternId,
    },
    actions: {
      togglePlay: playback.togglePlay,
      setBpm: playback.setBpm,
      setKit: playback.setKit,
      setPattern: pm.setPattern,
      toggleStep: trackConfig.toggleStep,
      setStep: trackConfig.setStep,
      setTrackSteps: trackConfig.setTrackSteps,
      toggleMute: trackConfig.toggleMute,
      toggleSolo: trackConfig.toggleSolo,
      setGain: trackConfig.setGain,
      setPan: trackConfig.setPan,
      toggleFreeRun: trackConfig.toggleFreeRun,
      setPatternLength: trackConfig.setPatternLength,
      setTrackLength: trackConfig.setTrackLength,
      clearAll,
      clearTrack: trackConfig.clearTrack,
      setSwing: trackConfig.setSwing,
      toggleFillLatch: fill.toggleFillLatch,
      setFillHeld: fill.setFillHeld,
      setTrigCondition: trackConfig.setTrigCondition,
      clearTrigCondition:
        trackConfig.clearTrigCondition,
      setParameterLock: trackConfig.setParameterLock,
      clearParameterLock:
        trackConfig.clearParameterLock,
      setPatternMode: pm.setPatternMode,
      toggleTemp: pm.toggleTemp,
      playPreview: playback.playPreview,
      dismissError: playback.dismissError,
    },
    meta: {
      stepRef: playback.stepRef,
      totalStepsRef: playback.totalStepsRef,
      triggeredTracksRef:
        playback.triggeredTracksRef,
      config,
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
          isPlaying: playback.isPlaying,
          setIsPlaying: () => {},
          isLoaded: playback.isLoaded,
          setIsLoaded: () => {},
          stepRef: playback.stepRef,
        }}
      >
        <SequencerContext value={value}>
          {children}
        </SequencerContext>
      </TransientContext>
    </ConfigContext>
  );
}
