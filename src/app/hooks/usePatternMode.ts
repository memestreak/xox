import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { audioEngine } from '../AudioEngine';
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
  setPatternMode: (mode: PatternMode) => void;
  setPattern: (pattern: Pattern) => void;
  toggleTemp: () => void;
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
 * pattern queueing. Owns the T-key keyboard effect.
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

  const applyPatternNow = useCallback(
    (pattern: Pattern) => {
      setConfig(prev => ({
        ...prev,
        tracks: pattern.tracks,
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

  const toggleTemp = useCallback(() => {
    if (!isPlayingRef.current) return;
    setTempState(prev => {
      const next = prev === 'off' ? 'armed' : 'off';
      tempStateRef.current = next;
      if (next === 'off') {
        setPendingPattern(null);
        pendingPatternRef.current = null;
        setHomeSnapshot(null);
        homeSnapshotRef.current = null;
      }
      return next;
    });
  }, [isPlayingRef]);

  const reset = useCallback(() => {
    setTempState('off');
    tempStateRef.current = 'off';
    setHomeSnapshot(null);
    homeSnapshotRef.current = null;
    setPendingPattern(null);
    pendingPatternRef.current = null;
  }, []);

  // T-key keyboard shortcut
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

  return {
    patternMode,
    tempState,
    tempStateRef,
    homeSnapshotRef,
    pendingPatternRef,
    setPatternMode,
    setPattern: setPatternAction,
    toggleTemp,
    reset,
  };
}
