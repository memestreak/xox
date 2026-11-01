import { useCallback, useRef } from 'react';
import {
  MAX_PATTERN_LENGTH,
} from '../constants';
import { TRACK_IDS, getPatternLength } from '../types';
import { markPatternModified } from '../patternUtils';
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
    trackId: TrackId,
    steps: string,
    base?: TrackConfig
  ) => void;
  toggleFreeRun: (trackId: TrackId) => void;
  setPatternLength: (
    length: number,
    base?: Record<TrackId, TrackConfig>
  ) => void;
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
  /** Removes every trig condition from one track. */
  clearTrackConditions: (trackId: TrackId) => void;
  /** Removes every parameter lock from one track. */
  clearTrackLocks: (trackId: TrackId) => void;
  /** Removes every trig condition from all tracks. */
  clearAllConditions: () => void;
  /** Removes every parameter lock from all tracks. */
  clearAllLocks: () => void;
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
  /**
   * True while Fill is held or latched. Steps turned
   * on while it is true get the Fill condition.
   */
  fillActiveRef?: React.RefObject<boolean>;
}

/**
 * Returns `conds` without a Fill condition on step
 * `stepIndex`, keeping its probability and cycle. A
 * step left with no conditions is dropped, and an empty
 * map becomes undefined.
 */
function withoutFill(
  conds: Record<number, StepConditions> | undefined,
  stepIndex: number
): Record<number, StepConditions> | undefined {
  if (conds?.[stepIndex]?.fill === undefined) {
    return conds;
  }
  const rest = { ...conds[stepIndex] };
  delete rest.fill;
  const next = { ...conds };
  if (Object.keys(rest).length > 0) {
    next[stepIndex] = rest;
  } else {
    delete next[stepIndex];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Returns `track` with step `stepIndex` set to `bit`.
 * Turning a step on while Fill is active also gives it
 * the Fill condition (plays only during fills), keeping
 * any probability or cycle it already has. Turning a
 * step off clears its Fill condition, so it comes back
 * as a plain step.
 */
function withStepBit(
  track: TrackConfig,
  stepIndex: number,
  bit: '0' | '1',
  fillActive: boolean
): TrackConfig {
  const steps =
    track.steps.substring(0, stepIndex) +
    bit +
    track.steps.substring(stepIndex + 1);
  if (bit === '0') {
    return {
      ...track,
      steps,
      trigConditions: withoutFill(
        track.trigConditions, stepIndex
      ),
    };
  }
  if (!fillActive) {
    return { ...track, steps };
  }
  return {
    ...track,
    steps,
    trigConditions: {
      ...track.trigConditions,
      [stepIndex]: {
        ...track.trigConditions?.[stepIndex],
        fill: 'fill',
      },
    },
  };
}

/**
 * Returns `tracks` with `field` (trig conditions or
 * parameter locks) removed from each track in
 * `trackIds`. Steps and everything else stay.
 */
function withoutStepData(
  tracks: Record<TrackId, TrackConfig>,
  trackIds: readonly TrackId[],
  field: 'trigConditions' | 'parameterLocks'
): Record<TrackId, TrackConfig> {
  const next = { ...tracks };
  for (const id of trackIds) {
    if (next[id][field] !== undefined) {
      next[id] = { ...next[id], [field]: undefined };
    }
  }
  return next;
}

/**
 * All track/mixer configuration actions. Owns
 * cycleCountRef (reset on mute/solo toggle).
 */
export function useTrackConfig({
  setConfig,
  setSelectedPatternId,
  fillActiveRef,
}: UseTrackConfigArgs): UseTrackConfigReturn {
  const cycleCountRef = useRef<
    Record<TrackId, number>
  >({} as Record<TrackId, number>);

  const toggleStep = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      // Read before setConfig: the updater can run later.
      const fillActive = !!fillActiveRef?.current;
      setConfig(prev => {
        const track = prev.tracks[trackId];
        if (stepIndex >= track.steps.length) {
          return prev;
        }
        const bit =
          track.steps[stepIndex] === '1' ? '0' : '1';
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: withStepBit(
              track, stepIndex, bit, fillActive
            ),
          },
        };
      });
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId, fillActiveRef]
  );

  const setStep = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      value: '0' | '1'
    ) => {
      const fillActive = !!fillActiveRef?.current;
      setConfig(prev => {
        const track = prev.tracks[trackId];
        if (stepIndex >= track.steps.length) {
          return prev;
        }
        if (track.steps[stepIndex] === value) return prev;
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: withStepBit(
              track, stepIndex, value, fillActive
            ),
          },
        };
      });
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId, fillActiveRef]
  );

  /**
   * Replaces a track's steps. `base` is the track as it
   * was when a gesture began (shift+drag preset
   * cycling): its conditions are restored on every
   * call, steps that are on now but were off in
   * `base` get the Fill condition while Fill is active,
   * and steps that were on in `base` but are off now
   * lose their Fill condition.
   * Without `base`, the track's current state is the
   * base and its conditions are only ever added to.
   */
  const setTrackSteps = useCallback(
    (
      trackId: TrackId,
      newSteps: string,
      base?: TrackConfig
    ) => {
      const fillActive = !!fillActiveRef?.current;
      setConfig(prev => {
        const track = prev.tracks[trackId];
        const from = base ?? track;
        let trigConditions = from.trigConditions;
        for (let i = 0; i < newSteps.length; i++) {
          const wasOn = from.steps[i] === '1';
          const isOn = newSteps[i] === '1';
          if (wasOn && !isOn) {
            trigConditions = withoutFill(trigConditions, i);
          } else if (fillActive && isOn && !wasOn) {
            trigConditions = {
              ...trigConditions,
              [i]: { ...trigConditions?.[i], fill: 'fill' },
            };
          }
        }
        const condsUnchanged =
          trigConditions === track.trigConditions;
        if (newSteps === track.steps && condsUnchanged) {
          return prev;
        }
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: {
              ...track,
              steps: newSteps,
              trigConditions,
            },
          },
        };
      });
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId, fillActiveRef]
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
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId]
  );

  /**
   * Set the pattern length. Shrinking cuts steps off.
   * With `base` (the tracks when a gesture began), the
   * steps are measured from `base` instead of the
   * current tracks, so a drag that goes down and back
   * up within one gesture loses nothing.
   */
  const setPatternLength = useCallback(
    (
      length: number,
      base?: Record<TrackId, TrackConfig>
    ) => {
      const clamped = Math.max(
        1,
        Math.min(MAX_PATTERN_LENGTH, length)
      );
      setConfig(prev => {
        const from = base ?? prev.tracks;
        const currentMax = getPatternLength(from);
        const newTracks = {
          ...prev.tracks,
        } as Record<TrackId, TrackConfig>;
        for (const id of TRACK_IDS) {
          const track = prev.tracks[id];
          const fromSteps = from[id].steps;
          const curLen = fromSteps.length;
          let newLen: number;
          if (clamped > currentMax) {
            newLen = clamped;
          } else {
            newLen = curLen > clamped
              ? clamped
              : curLen;
          }
          let newSteps = fromSteps;
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
      setSelectedPatternId(markPatternModified);
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
      setSelectedPatternId(markPatternModified);
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
      // Presets set track levels, so a change marks the
      // pattern modified. The accent level isn't preset
      // data.
      if (trackId !== 'ac') {
        setSelectedPatternId(markPatternModified);
      }
    },
    [setConfig, setSelectedPatternId]
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
      // Presets set track levels, so a change marks the
      // pattern modified. The accent level isn't preset
      // data.
      if (trackId !== 'ac') {
        setSelectedPatternId(markPatternModified);
      }
    },
    [setConfig, setSelectedPatternId]
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
      setSelectedPatternId(markPatternModified);
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
      setSelectedPatternId(markPatternModified);
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
      setSelectedPatternId(markPatternModified);
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
      setSelectedPatternId(markPatternModified);
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
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId]
  );

  const clearStepData = useCallback(
    (
      trackIds: readonly TrackId[],
      field: 'trigConditions' | 'parameterLocks'
    ) => {
      setConfig(prev => ({
        ...prev,
        tracks: withoutStepData(
          prev.tracks, trackIds, field
        ),
      }));
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId]
  );

  const clearTrackConditions = useCallback(
    (trackId: TrackId) =>
      clearStepData([trackId], 'trigConditions'),
    [clearStepData]
  );

  const clearTrackLocks = useCallback(
    (trackId: TrackId) =>
      clearStepData([trackId], 'parameterLocks'),
    [clearStepData]
  );

  const clearAllConditions = useCallback(
    () => clearStepData(TRACK_IDS, 'trigConditions'),
    [clearStepData]
  );

  const clearAllLocks = useCallback(
    () => clearStepData(TRACK_IDS, 'parameterLocks'),
    [clearStepData]
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
    clearTrackConditions,
    clearTrackLocks,
    clearAllConditions,
    clearAllLocks,
    initCycleCounts,
    reset,
  };
}
