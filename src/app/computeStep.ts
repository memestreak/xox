import { evaluateCondition } from './trigConditions';
import {
  ACCENT_GAIN_MULTIPLIER,
  GAIN_EXPONENT,
} from './constants';
import { TRACK_IDS, getPatternLength } from './types';
import { TRACKS } from './SequencerContext';
import type {
  HomeSnapshot,
  Pattern,
  SequencerConfig,
  TempState,
  TrackId,
  TrackState,
} from './types';

/**
 * Dependencies injected into computeStep from refs
 * and state in the orchestrator.
 */
export interface ComputeStepDeps {
  trackStates: Record<TrackId, TrackState>;
  config: SequencerConfig;
  totalSteps: number;
  cycleCounts: Record<TrackId, number>;
  fillActive: boolean;
  pendingPattern: Pattern | null;
  tempState: TempState;
  homeSnapshot: HomeSnapshot | null;
}

/**
 * Result returned by computeStep. The orchestrator
 * interprets signals to update React state and refs.
 */
export interface ComputeStepResult {
  /** Tracks that fired on this step. */
  triggeredTracks: Set<TrackId>;
  /** Updated cycle counts after this step. */
  cycleCounts: Record<TrackId, number>;
  /** New totalSteps value (incremented). */
  totalSteps: number;
  /** Sounds to play: [trackId, time, gain, pan]. */
  sounds: Array<[TrackId, number, number, number]>;
  /** Pattern mode: apply pending pattern at boundary. */
  applyPending?: {
    config: SequencerConfig;
    patternId: string;
  };
  /** Pattern mode: revert temp at boundary. */
  revertTemp?: {
    config: SequencerConfig;
    selectedPatternId: string;
    patternLength: number;
    needsReset: boolean;
  };
}

/**
 * Pure computation for a single sequencer step.
 *
 * Calculates which tracks fire, applies swing timing,
 * evaluates trig conditions, and returns signals for
 * pattern mode transitions. No side effects — the
 * orchestrator applies the result.
 */
export function computeStep(
  step: number,
  time: number,
  deps: ComputeStepDeps
): ComputeStepResult {
  const {
    trackStates,
    config,
    fillActive,
    pendingPattern,
    tempState,
    homeSnapshot,
  } = deps;

  const totalSteps = deps.totalSteps + 1;
  const cycleCounts = { ...deps.cycleCounts };
  const triggeredTracks = new Set<TrackId>();
  const sounds: ComputeStepResult['sounds'] = [];

  // Swing: offset odd steps forward in time
  const halfStep = (60 / config.bpm) * 0.25 / 2;
  const swingOffset = step % 2 === 1
    ? (config.swing / 100) * 0.7 * halfStep
    : 0;
  const scheduledTime = time + swingOffset;

  const anySolo = Object.values(trackStates).some(
    t => t.isSolo
  );

  // Increment cycle count at cycle boundaries
  for (const id of TRACK_IDS) {
    const len = config.tracks[id].steps.length;
    if (totalSteps > 1 && (totalSteps - 1) % len === 0) {
      cycleCounts[id] = (cycleCounts[id] ?? 0) + 1;
    }
  }

  const trackStep = (id: TrackId): number => {
    const len = config.tracks[id].steps.length;
    return config.tracks[id].freeRun
      ? (totalSteps - 1) % len
      : step % len;
  };

  // Evaluate accent
  const accentStep = trackStep('ac');
  const accentActive =
    config.tracks.ac.steps[accentStep] === '1';
  let isAccented = false;
  if (accentActive) {
    const accentCond =
      config.tracks.ac.trigConditions?.[accentStep];
    isAccented = evaluateCondition(accentCond, {
      cycleCount: cycleCounts.ac ?? 0,
      fillActive,
    });
  }

  // Evaluate each audible track
  TRACKS.forEach(track => {
    const st = trackStates[track.id];
    const audible = anySolo
      ? st.isSolo
      : !st.isMuted;
    if (!audible) return;

    const effectiveStep = trackStep(track.id);
    if (
      config.tracks[track.id]
        .steps[effectiveStep] === '1'
    ) {
      const cond =
        config.tracks[track.id]
          .trigConditions?.[effectiveStep];
      const shouldFire = evaluateCondition(cond, {
        cycleCount: cycleCounts[track.id] ?? 0,
        fillActive,
      });
      if (!shouldFire) return;

      const locks =
        config.tracks[track.id]
          .parameterLocks?.[effectiveStep];
      const baseGain = locks?.gain ?? st.gain;
      const cubic = baseGain ** GAIN_EXPONENT;
      const gain = isAccented
        ? cubic * (1 + trackStates.ac.gain
            * ACCENT_GAIN_MULTIPLIER)
        : cubic;
      const pan = locks?.pan ?? st.pan;

      sounds.push([track.id, scheduledTime, gain, pan]);
      triggeredTracks.add(track.id);
    }
  });

  // ─── Step boundary: pattern mode signals ──────
  const result: ComputeStepResult = {
    triggeredTracks,
    cycleCounts,
    totalSteps,
    sounds,
  };

  const patLen = getPatternLength(config.tracks);
  if (step === patLen - 1) {
    // Sequential: apply pending pattern
    if (pendingPattern) {
      result.applyPending = {
        config: {
          ...config,
          tracks: pendingPattern.tracks,
        },
        patternId: pendingPattern.id,
      };
    }

    // Temp revert (don't revert on same step as
    // applying pending)
    if (
      tempState === 'active'
      && homeSnapshot
      && !pendingPattern
    ) {
      const snapPatLen =
        getPatternLength(homeSnapshot.tracks);
      result.revertTemp = {
        config: {
          ...config,
          tracks: homeSnapshot.tracks,
        },
        selectedPatternId:
          homeSnapshot.selectedPatternId,
        patternLength: snapPatLen,
        needsReset: snapPatLen !== patLen,
      };
    }
  }

  return result;
}
