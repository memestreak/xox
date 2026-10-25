import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { shouldIgnoreShortcut } from '../keyboardUtils';
import { audioEngine } from '../AudioEngine';
import { withPresetLevels } from '../mixerUtils';
import type {
  HomeSnapshot,
  Pattern,
  PatternMode,
  SequencerConfig,
  TempState,
} from '../types';

export interface UsePatternModeReturn {
  patternMode: PatternMode;
  tempState: TempState;
  tempStateRef: React.RefObject<TempState>;
  homeSnapshotRef: React.RefObject<
    HomeSnapshot | null
  >;
  pendingPatternRef: React.RefObject<Pattern | null>;
  /** Pattern queued to start at the next bar end. */
  pendingPatternId: string | null;
  /** The scheduler just switched to the pending pattern. */
  onPendingApplied: () => void;
  /** Latched: Temp re-arms after each temp pattern. */
  isTempLatched: boolean;
  setPatternMode: (mode: PatternMode) => void;
  setPattern: (pattern: Pattern) => void;
  toggleTemp: () => void;
  toggleTempLatch: () => void;
  /** A temp pattern just reverted to home. */
  onTempReverted: () => void;
  onPlaybackStart: () => void;
  onPlaybackStop: () => void;
  reset: () => void;
}

interface UsePatternModeArgs {
  configRef: React.RefObject<SequencerConfig>;
  isPlayingRef: React.RefObject<boolean>;
  selectedPatternId: string;
  setConfig: React.Dispatch<
    React.SetStateAction<SequencerConfig>
  >;
  setSelectedPatternId: React.Dispatch<
    React.SetStateAction<string>
  >;
}

/**
 * Manages pattern mode (sequential/direct-start/
 * direct-jump), temp mode state machine, and pending
 * pattern queueing. Owns the T / Shift+T key effect.
 *
 * Temp latch: while latched, Temp re-arms after each
 * temp pattern reverts, so every pattern picked plays
 * once and returns home. The latch survives Stop (Temp
 * rests at off, then re-arms on Play); reset() clears it.
 */
export function usePatternMode({
  configRef,
  isPlayingRef,
  selectedPatternId,
  setConfig,
  setSelectedPatternId,
}: UsePatternModeArgs): UsePatternModeReturn {
  const [patternMode, setPatternMode] =
    useState<PatternMode>('direct-jump');
  const [tempState, setTempState] =
    useState<TempState>('off');
  const [homeSnapshot, setHomeSnapshot] =
    useState<HomeSnapshot | null>(null);
  const [pendingPattern, setPendingPattern] =
    useState<Pattern | null>(null);

  const [isTempLatched, setIsTempLatched] =
    useState(false);

  const tempStateRef = useRef<TempState>('off');
  const tempLatchedRef = useRef(false);
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

  const applyPatternNow = useCallback(
    (pattern: Pattern) => {
      setConfig(prev => ({
        ...prev,
        tracks: pattern.tracks,
        mixer: withPresetLevels(
          prev.mixer, pattern.mixer
        ),
      }));
      setSelectedPatternId(pattern.id);
    },
    [setConfig, setSelectedPatternId]
  );

  const setPatternAction = useCallback(
    (pattern: Pattern) => {
      // When stopped, always apply immediately
      if (!isPlayingRef.current) {
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
          mixer: structuredClone(
            configRef.current.mixer
          ),
          selectedPatternId,
        };
        setHomeSnapshot(snapshot);
        homeSnapshotRef.current = snapshot;
        setTempState('active');
        tempStateRef.current = 'active';
      }

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
    [isPlayingRef, patternMode, selectedPatternId,
      applyPatternNow, configRef]
  );

  // Writes state and ref together so callers in the
  // same tick (the scheduler, key handlers) see it.
  const setTemp = useCallback((next: TempState) => {
    setTempState(next);
    tempStateRef.current = next;
  }, []);

  const setLatched = useCallback((next: boolean) => {
    setIsTempLatched(next);
    tempLatchedRef.current = next;
  }, []);

  // Turn Temp off without reverting: a temp pattern that
  // is playing stays as the new home.
  const clearTemp = useCallback(() => {
    setTemp('off');
    setPendingPattern(null);
    pendingPatternRef.current = null;
    setHomeSnapshot(null);
    homeSnapshotRef.current = null;
  }, [setTemp]);

  const toggleTemp = useCallback(() => {
    // Tapping Temp while latched unlatches and stops,
    // so one press always turns Temp off.
    if (tempLatchedRef.current) {
      setLatched(false);
      clearTemp();
      return;
    }
    if (!isPlayingRef.current) return;
    if (tempStateRef.current === 'off') {
      setTemp('armed');
    } else {
      clearTemp();
    }
  }, [isPlayingRef, setLatched, clearTemp, setTemp]);

  const toggleTempLatch = useCallback(() => {
    if (tempLatchedRef.current) {
      setLatched(false);
      // An active temp pattern finishes its pass and
      // reverts first; onTempReverted then turns it off.
      if (tempStateRef.current === 'armed') setTemp('off');
      return;
    }
    setLatched(true);
    if (isPlayingRef.current
        && tempStateRef.current === 'off') {
      setTemp('armed');
    }
  }, [isPlayingRef, setLatched, setTemp]);

  const onPendingApplied = useCallback(() => {
    setPendingPattern(null);
    pendingPatternRef.current = null;
  }, []);

  const onTempReverted = useCallback(() => {
    clearTemp();
    if (tempLatchedRef.current) setTemp('armed');
  }, [clearTemp, setTemp]);

  const onPlaybackStart = useCallback(() => {
    if (tempLatchedRef.current) setTemp('armed');
  }, [setTemp]);

  // Keeps the latch; Temp rests at off while stopped.
  const onPlaybackStop = useCallback(() => {
    clearTemp();
  }, [clearTemp]);

  const reset = useCallback(() => {
    setLatched(false);
    clearTemp();
  }, [setLatched, clearTemp]);

  // T / Shift+T shortcuts (listed in helpContent.ts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shouldIgnoreShortcut(e)) return;
      e.preventDefault();
      if (e.shiftKey) toggleTempLatch();
      else toggleTemp();
    };
    document.addEventListener(
      'keydown', handleKeyDown
    );
    return () => {
      document.removeEventListener(
        'keydown', handleKeyDown
      );
    };
  }, [toggleTemp, toggleTempLatch]);

  return {
    patternMode,
    tempState,
    tempStateRef,
    homeSnapshotRef,
    pendingPatternRef,
    pendingPatternId: pendingPattern?.id ?? null,
    onPendingApplied,
    isTempLatched,
    setPatternMode,
    setPattern: setPatternAction,
    toggleTemp,
    toggleTempLatch,
    onTempReverted,
    onPlaybackStart,
    onPlaybackStop,
    reset,
  };
}
