import { useCallback, useRef } from 'react';
import {
  MAX_PATTERN_LENGTH,
} from '../constants';
import { TRACK_IDS, getPatternLength } from '../types';
import type {
  SequencerConfig,
  StepConditions,
  StepLocks,
  TrackConfig,
  TrackId,
} from '../types';

export interface UseTrackConfigReturn {
  cycleCountRef: React.RefObject<
    Record<TrackId, number>
  >;
  toggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  setStep: (
    trackId: TrackId,
    stepIndex: number,
    value: '0' | '1'
  ) => void;
  setTrackSteps: (
    trackId: TrackId, steps: string
  ) => void;
  toggleFreeRun: (trackId: TrackId) => void;
  setPatternLength: (length: number) => void;
  setTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  toggleMute: (trackId: TrackId) => void;
  toggleSolo: (trackId: TrackId) => void;
  setGain: (
    trackId: TrackId, value: number
  ) => void;
  setPan: (
    trackId: TrackId, value: number
  ) => void;
  clearTrack: (trackId: TrackId) => void;
  setSwing: (value: number) => void;
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
  initCycleCounts: () => void;
  reset: () => void;
}

interface UseTrackConfigArgs {
  setConfig: React.Dispatch<
    React.SetStateAction<SequencerConfig>
  >;
  setSelectedPatternId: React.Dispatch<
    React.SetStateAction<string>
  >;
}

/**
 * All track/mixer configuration actions. Owns
 * cycleCountRef (reset on mute/solo toggle).
 */
export function useTrackConfig({
  setConfig,
  setSelectedPatternId,
}: UseTrackConfigArgs): UseTrackConfigReturn {
  const cycleCountRef = useRef<
    Record<TrackId, number>
  >({} as Record<TrackId, number>);

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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
  );

  const setPatternLength = useCallback(
    (length: number) => {
      const clamped = Math.max(
        1,
        Math.min(MAX_PATTERN_LENGTH, length)
      );
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
            newLen = clamped;
          } else {
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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
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
    [setConfig]
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
    [setConfig]
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
    [setConfig]
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
    [setConfig]
  );

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
    [setConfig, setSelectedPatternId]
  );

  const setSwing = useCallback(
    (value: number) => {
      setConfig(prev => ({
        ...prev,
        swing: Math.max(0, Math.min(100, value)),
      }));
    },
    [setConfig]
  );

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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
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
    [setConfig, setSelectedPatternId]
  );

  const initCycleCounts = useCallback(() => {
    const counts = {} as Record<TrackId, number>;
    for (const id of TRACK_IDS) { counts[id] = 0; }
    cycleCountRef.current = counts;
  }, []);

  const reset = useCallback(() => {
    initCycleCounts();
  }, [initCycleCounts]);

  return {
    cycleCountRef,
    toggleStep,
    setStep,
    setTrackSteps,
    toggleFreeRun,
    setPatternLength,
    setTrackLength,
    toggleMute,
    toggleSolo,
    setGain,
    setPan,
    clearTrack,
    setSwing,
    setTrigCondition,
    clearTrigCondition,
    setParameterLock,
    clearParameterLock,
    initCycleCounts,
    reset,
  };
}
