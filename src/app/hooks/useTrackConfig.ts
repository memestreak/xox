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

/** Pads `steps` with rests, or cuts it, to `length`. */
function fitSteps(steps: string, length: number): string {
  return steps.length < length
    ? steps.padEnd(length, '0')
    : steps.substring(0, length);
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

/** Step data kept per step: conditions or locks. */
type StepField = 'trigConditions' | 'parameterLocks';

/**
 * Returns `config` with track `trackId` replaced by
 * `fn(track)`. When `fn` returns the track unchanged,
 * `config` itself comes back, so React skips the
 * update.
 */
function updateTrack(
  config: SequencerConfig,
  trackId: TrackId,
  fn: (track: TrackConfig) => TrackConfig
): SequencerConfig {
  const track = config.tracks[trackId];
  const next = fn(track);
  if (next === track) return config;
  return {
    ...config,
    tracks: { ...config.tracks, [trackId]: next },
  };
}

/** Returns `config` with one mixer channel changed. */
function updateMixer(
  config: SequencerConfig,
  trackId: TrackId,
  change: Partial<SequencerConfig['mixer'][TrackId]>
): SequencerConfig {
  return {
    ...config,
    mixer: {
      ...config.mixer,
      [trackId]: { ...config.mixer[trackId], ...change },
    },
  };
}

/**
 * Returns `track` without `field` data on step
 * `stepIndex`. A map left empty becomes undefined.
 */
function withoutStep(
  track: TrackConfig,
  field: StepField,
  stepIndex: number
): TrackConfig {
  const map = track[field];
  if (map?.[stepIndex] === undefined) return track;
  const rest = { ...map };
  delete rest[stepIndex];
  return {
    ...track,
    [field]: Object.keys(rest).length > 0 ? rest : undefined,
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
  field: StepField
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

  /**
   * Changes one track with `fn` and marks the pattern
   * modified. `fn` may run later (it is a state
   * updater), so it must not read refs.
   */
  const editTrack = useCallback(
    (
      trackId: TrackId,
      fn: (track: TrackConfig) => TrackConfig
    ) => {
      setConfig(prev => updateTrack(prev, trackId, fn));
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId]
  );

  /**
   * Changes one mixer channel. Presets set track
   * levels, so a gain or pan change marks the pattern
   * modified; the accent level isn't preset data, and
   * mute and solo aren't either.
   */
  const editMixer = useCallback(
    (
      trackId: TrackId,
      fn: (
        channel: SequencerConfig['mixer'][TrackId]
      ) => Partial<SequencerConfig['mixer'][TrackId]>,
      marksModified: boolean
    ) => {
      setConfig(prev => updateMixer(
        prev, trackId, fn(prev.mixer[trackId])
      ));
      if (marksModified && trackId !== 'ac') {
        setSelectedPatternId(markPatternModified);
      }
    },
    [setConfig, setSelectedPatternId]
  );

  const toggleStep = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      // Read before editTrack: the updater can run later.
      const fillActive = !!fillActiveRef?.current;
      editTrack(trackId, track => {
        if (stepIndex >= track.steps.length) return track;
        const bit =
          track.steps[stepIndex] === '1' ? '0' : '1';
        return withStepBit(
          track, stepIndex, bit, fillActive
        );
      });
    },
    [editTrack, fillActiveRef]
  );

  const setStep = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      value: '0' | '1'
    ) => {
      const fillActive = !!fillActiveRef?.current;
      editTrack(trackId, track => {
        if (stepIndex >= track.steps.length) return track;
        if (track.steps[stepIndex] === value) return track;
        return withStepBit(
          track, stepIndex, value, fillActive
        );
      });
    },
    [editTrack, fillActiveRef]
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
      editTrack(trackId, track => {
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
        if (
          newSteps === track.steps
          && trigConditions === track.trigConditions
        ) {
          return track;
        }
        return { ...track, steps: newSteps, trigConditions };
      });
    },
    [editTrack, fillActiveRef]
  );

  const toggleFreeRun = useCallback(
    (trackId: TrackId) => editTrack(
      trackId,
      track => ({ ...track, freeRun: !track.freeRun })
    ),
    [editTrack]
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
          const fromSteps = from[id].steps;
          const newLen = clamped > currentMax
            ? clamped
            : Math.min(fromSteps.length, clamped);
          newTracks[id] = {
            ...prev.tracks[id],
            steps: fitSteps(fromSteps, newLen),
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
        const patLen = getPatternLength(prev.tracks);
        const clamped = Math.max(
          1,
          Math.min(patLen, length)
        );
        return updateTrack(prev, trackId, track => ({
          ...track,
          steps: fitSteps(track.steps, clamped),
        }));
      });
      setSelectedPatternId(markPatternModified);
    },
    [setConfig, setSelectedPatternId]
  );

  const toggleMute = useCallback(
    (trackId: TrackId) => {
      editMixer(
        trackId, ch => ({ isMuted: !ch.isMuted }), false
      );
      cycleCountRef.current[trackId] = 0;
    },
    [editMixer]
  );

  const toggleSolo = useCallback(
    (trackId: TrackId) => {
      editMixer(
        trackId, ch => ({ isSolo: !ch.isSolo }), false
      );
      cycleCountRef.current[trackId] = 0;
    },
    [editMixer]
  );

  const setGain = useCallback(
    (trackId: TrackId, value: number) =>
      editMixer(trackId, () => ({ gain: value }), true),
    [editMixer]
  );

  const setPan = useCallback(
    (trackId: TrackId, value: number) =>
      editMixer(trackId, () => ({ pan: value }), true),
    [editMixer]
  );

  const clearTrack = useCallback(
    (trackId: TrackId) => editTrack(
      trackId, () => ({ steps: '0'.repeat(16) })
    ),
    [editTrack]
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

  /** Replaces one step's trig conditions. */
  const setTrigCondition = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      conditions: StepConditions
    ) => editTrack(trackId, track => ({
      ...track,
      trigConditions: {
        ...track.trigConditions,
        [stepIndex]: conditions,
      },
    })),
    [editTrack]
  );

  /** Merges `locks` into one step's parameter locks. */
  const setParameterLock = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      locks: StepLocks
    ) => editTrack(trackId, track => ({
      ...track,
      parameterLocks: {
        ...track.parameterLocks,
        [stepIndex]: {
          ...track.parameterLocks?.[stepIndex],
          ...locks,
        },
      },
    })),
    [editTrack]
  );

  /** Removes one step's conditions or locks. */
  const clearStep = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      field: StepField
    ) => editTrack(
      trackId, track => withoutStep(track, field, stepIndex)
    ),
    [editTrack]
  );

  const clearTrigCondition = useCallback(
    (trackId: TrackId, stepIndex: number) =>
      clearStep(trackId, stepIndex, 'trigConditions'),
    [clearStep]
  );

  const clearParameterLock = useCallback(
    (trackId: TrackId, stepIndex: number) =>
      clearStep(trackId, stepIndex, 'parameterLocks'),
    [clearStep]
  );

  /** Removes conditions or locks from whole tracks. */
  const clearStepData = useCallback(
    (
      trackIds: readonly TrackId[],
      field: StepField
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
