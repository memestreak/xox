"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import patternsData from './data/patterns.json';
import { defaultConfig, decodeShareLink } from './configCodec';
import { loadSession, saveSession } from './configStorage';
import { AUTOSAVE_DEBOUNCE_MS } from './constants';
import { CUSTOM_PATTERN_ID } from './patternUtils';
import type { StepEvent } from './stepQueue';
import { TRACK_IDS } from './types';
import { useFillMode } from './hooks/useFillMode';
import { usePatternMode } from './hooks/usePatternMode';
import { useTrackConfig } from './hooks/useTrackConfig';
import { usePlayback } from './hooks/usePlayback';
import { useMinimizedTracks } from './hooks/useMinimizedTracks';
import type { AutoMinimizeHold } from './hooks/useMinimizedTracks';
import {
  setAutoMinimize, useAutoMinimizeSetting,
} from './hooks/useAutoMinimizeSetting';
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

// ─── Share link notices ──────────────────────────────

const SHARE_LINK_NEWER_MESSAGE =
  'This pattern was made with a newer version of XOX.'
  + ' Some settings may not have loaded.';
const SHARE_LINK_OLDER_MESSAGE =
  'This share link is from an older version of XOX and'
  + ' can no longer be opened.';
const SHARE_LINK_INVALID_MESSAGE =
  'This share link is damaged or incomplete and'
  + ' could not be opened.';

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
  /** Latch is on, whether or not Fill is also held. */
  isFillLatched: boolean;
  fillMode: 'off' | 'latched' | 'momentary';
  patternMode: PatternMode;
  tempState: TempState;
  isTempLatched: boolean;
  selectedPatternId: string;
  /**
   * Pattern picked in Sequential mode while playing,
   * waiting for the bar end. Null when nothing is cued.
   */
  pendingPatternId: string | null;
  /** Problem with a share link opened from the URL. */
  importNotice: string | null;
  /**
   * Empty grid tracks drawn as thin rows. A view
   * setting: not saved, not in share links.
   */
  minimizedTracks: ReadonlySet<TrackId>;
  /** Empty tracks that minimizeEmptyTracks would add. */
  minimizableCount: number;
  /**
   * "Auto-minimize empty tracks" setting. Per device
   * (localStorage), not in SequencerConfig.
   */
  autoMinimize: boolean;
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
  setPatternLength: (
    length: number,
    base?: Record<TrackId, TrackConfig>
  ) => void;
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
    trackId: TrackId,
    steps: string,
    base?: TrackConfig
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
  toggleTempLatch: () => void;
  playPreview: (trackId: TrackId) => void;
  dismissError: () => void;
  dismissImportNotice: () => void;
  minimizeEmptyTracks: () => void;
  restoreTrack: (trackId: TrackId) => void;
  restoreAllTracks: () => void;
  setAutoMinimize: (value: boolean) => void;
  /**
   * Where the pointer is on the grid: the hovered
   * track's row, 'all' during a press, or null.
   */
  holdAutoMinimize: (hold: AutoMinimizeHold) => void;
}

interface SequencerMeta {
  stepRef: React.RefObject<number>;
  totalStepsRef: React.RefObject<number>;
  triggeredTracksRef: React.RefObject<Set<TrackId>>;
  stepQueueRef: React.RefObject<StepEvent[]>;
  config: SequencerConfig;
}

interface SequencerContextValue {
  state: SequencerState;
  actions: SequencerActions;
  meta: SequencerMeta;
}

// ─── Contexts ─────────────────────────────────────────

/**
 * Single context behind useSequencer(). The value and
 * its state/actions/meta parts are memoized, so
 * consumers re-render only when something they get
 * actually changed.
 */
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

  // Counts whole-pattern loads, for auto-minimize. Every
  // load sets the selected pattern id, so loads go
  // through this setter; step edits use the plain one.
  const [loadSeq, setLoadSeq] = useState(0);
  const setSelectedPatternIdOnLoad = useCallback<
    React.Dispatch<React.SetStateAction<string>>
  >(value => {
    setSelectedPatternId(value);
    setLoadSeq(n => n + 1);
  }, []);

  // Shared refs owned by orchestrator (breaks
  // circular deps between hooks)
  const configRef = useRef(config);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // ─── Restore on mount, then autosave ─────────
  // Autosave starts only after the initial restore, so
  // the default config never overwrites a saved session.
  const [restored, setRestored] = useState(false);
  const [importNotice, setImportNotice] =
    useState<string | null>(null);
  const dismissImportNotice = useCallback(() => {
    setImportNotice(null);
  }, []);
  const selectedPatternIdRef = useRef(selectedPatternId);
  useEffect(() => {
    selectedPatternIdRef.current = selectedPatternId;
  }, [selectedPatternId]);

  useEffect(() => {
    let cancelled = false;

    /**
     * Import a share link from the URL hash. Returns true
     * if a config was applied. The hash is removed
     * afterwards so a later refresh restores the
     * autosaved session (with any newer edits) instead
     * of the original link. A link that can't be loaded
     * leaves the current session alone and shows a
     * notice instead.
     */
    const importFromHash = async (): Promise<boolean> => {
      const hash = window.location.hash.slice(1);
      if (!hash) return false;
      const clearHash = () => window.history.replaceState(
        null, '',
        window.location.pathname + window.location.search
      );
      let result: Awaited<ReturnType<typeof decodeShareLink>>;
      try {
        result = await decodeShareLink(hash);
      } catch {
        if (cancelled) return false;
        setImportNotice(SHARE_LINK_INVALID_MESSAGE);
        clearHash();
        return false;
      }
      if (cancelled) return false;
      clearHash();
      if (result.versionStatus === 'older') {
        setImportNotice(SHARE_LINK_OLDER_MESSAGE);
        return false;
      }
      setImportNotice(
        result.versionStatus === 'newer'
          ? SHARE_LINK_NEWER_MESSAGE
          : null
      );
      setConfig(result.config);
      setSelectedPatternIdOnLoad(CUSTOM_PATTERN_ID);
      return true;
    };

    const restore = async () => {
      const imported = await importFromHash();
      if (cancelled) return;
      if (!imported) {
        const saved = loadSession();
        if (saved) {
          setConfig(saved.config);
          setSelectedPatternIdOnLoad(
            saved.selectedPatternId
          );
        }
      }
      setRestored(true);
    };
    restore();

    // A share link pasted into an open tab only changes
    // the hash, which doesn't reload the page.
    const onHashChange = () => {
      importFromHash();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener(
        'hashchange', onHashChange
      );
    };
  }, [setSelectedPatternIdOnLoad]);

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => {
      saveSession({ config, selectedPatternId });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [config, selectedPatternId, restored]);

  // Flush immediately when the page is hidden or closed,
  // so an edit inside the debounce window isn't lost.
  useEffect(() => {
    if (!restored) return;
    const flush = () => {
      saveSession({
        config: configRef.current,
        selectedPatternId: selectedPatternIdRef.current,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener(
      'visibilitychange', onVisibility
    );
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener(
        'visibilitychange', onVisibility
      );
    };
  }, [restored]);

  // ─── Compose hooks ───────────────────────────
  const fill = useFillMode();

  const trackConfig = useTrackConfig({
    setConfig,
    setSelectedPatternId,
    fillActiveRef: fill.fillActiveRef,
  });

  const pm = usePatternMode({
    configRef,
    isPlayingRef,
    selectedPatternId,
    setConfig,
    setSelectedPatternId: setSelectedPatternIdOnLoad,
  });

  const playback = usePlayback({
    config,
    configRef,
    isPlayingRef,
    setConfig,
    setSelectedPatternId: setSelectedPatternIdOnLoad,
    fillActiveRef: fill.fillActiveRef,
    pendingPatternRef: pm.pendingPatternRef,
    tempStateRef: pm.tempStateRef,
    homeSnapshotRef: pm.homeSnapshotRef,
    cycleCountRef: trackConfig.cycleCountRef,
    initCycleCounts: trackConfig.initCycleCounts,
    onPendingApplied: pm.onPendingApplied,
    onTempReverted: pm.onTempReverted,
    onPlaybackStart: pm.onPlaybackStart,
    onPlaybackStop: pm.onPlaybackStop,
  });

  const autoMinimize = useAutoMinimizeSetting();
  const minimize = useMinimizedTracks({
    tracks: config.tracks,
    autoMinimize,
    loadSeq,
  });

  // ─── clearAll composes all hook resets ────────
  // Depend on the (stable) reset callbacks, not the
  // hook return objects, which are new every render.
  const fillReset = fill.reset;
  const pmReset = pm.reset;
  const trackConfigReset = trackConfig.reset;
  const minimizeReset = minimize.reset;
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
    setSelectedPatternId(CUSTOM_PATTERN_ID);
    fillReset();
    pmReset();
    trackConfigReset();
    minimizeReset();
  }, [fillReset, pmReset, trackConfigReset, minimizeReset]);

  // ─── Context value ────────────────────────────
  // Every action is a stable callback (useCallback or
  // a state setter), so `actions` is built once.
  const {
    isPlaying, isLoaded, loadError, currentKit,
    trackStates, stepRef, totalStepsRef,
    triggeredTracksRef, stepQueueRef,
  } = playback;
  const { isFillActive, isFillLatched, fillMode } = fill;
  const {
    patternMode, tempState, isTempLatched, pendingPatternId,
  } = pm;
  const { minimizedTracks, minimizableCount } = minimize;

  const state = useMemo<SequencerState>(() => ({
    isPlaying,
    bpm: config.bpm,
    currentKit,
    trackStates,
    isLoaded,
    loadError,
    swing: config.swing,
    isFillActive,
    isFillLatched,
    fillMode,
    patternMode,
    tempState,
    isTempLatched,
    selectedPatternId,
    pendingPatternId,
    importNotice,
    minimizedTracks,
    minimizableCount,
    autoMinimize,
  }), [
    isPlaying, config.bpm, currentKit, trackStates,
    isLoaded, loadError, config.swing, isFillActive,
    isFillLatched, fillMode, patternMode, tempState,
    isTempLatched, selectedPatternId, pendingPatternId,
    importNotice, minimizedTracks, minimizableCount,
    autoMinimize,
  ]);

  const {
    togglePlay, setBpm, setKit, playPreview, dismissError,
  } = playback;
  const {
    setPattern, setPatternMode, toggleTemp, toggleTempLatch,
  } = pm;
  const { toggleFillLatch, setFillHeld } = fill;
  const {
    minimizeEmptyTracks, restoreTrack, restoreAllTracks,
    holdAutoMinimize,
  } = minimize;
  const {
    toggleStep, setStep, setTrackSteps, toggleMute,
    toggleSolo, setGain, setPan, toggleFreeRun,
    setPatternLength, setTrackLength, clearTrack,
    setSwing, setTrigCondition, clearTrigCondition,
    setParameterLock, clearParameterLock,
  } = trackConfig;

  const actions = useMemo<SequencerActions>(() => ({
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
    toggleTempLatch,
    playPreview,
    dismissError,
    dismissImportNotice,
    minimizeEmptyTracks,
    restoreTrack,
    restoreAllTracks,
    setAutoMinimize,
    holdAutoMinimize,
  }), [
    togglePlay, setBpm, setKit, setPattern, toggleStep,
    setStep, setTrackSteps, toggleMute, toggleSolo,
    setGain, setPan, toggleFreeRun, setPatternLength,
    setTrackLength, clearAll, clearTrack, setSwing,
    toggleFillLatch, setFillHeld, setTrigCondition,
    clearTrigCondition, setParameterLock,
    clearParameterLock, setPatternMode, toggleTemp,
    toggleTempLatch, playPreview, dismissError, dismissImportNotice,
    minimizeEmptyTracks, restoreTrack, restoreAllTracks,
    holdAutoMinimize,
  ]);

  const meta = useMemo<SequencerMeta>(() => ({
    stepRef,
    totalStepsRef,
    triggeredTracksRef,
    stepQueueRef,
    config,
  }), [
    stepRef, totalStepsRef, triggeredTracksRef,
    stepQueueRef, config,
  ]);

  const value = useMemo<SequencerContextValue>(
    () => ({ state, actions, meta }),
    [state, actions, meta]
  );
  return (
    <SequencerContext value={value}>
      {children}
    </SequencerContext>
  );
}
