import { evaluateCondition } from './trigConditions';
import { hitStep, retrigHits } from './retrig';
import {
  ACCENT_GAIN_MULTIPLIER,
  GAIN_EXPONENT,
} from './constants';
import { TRACKS, TRACK_IDS, getPatternLength } from './types';
import { withPresetLevels, withLevelsFrom } from './mixerUtils';
import type {
  HomeSnapshot,
  Pattern,
  SequencerConfig,
  TempState,
  TrackConfig,
  TrackId,
  TrackState,
} from './types';

/**
 * A retrig roll still playing after its step. Its hits
 * are scheduled one step at a time, so Stop, a pattern
 * change or an edit to the track ends it.
 */
export interface Roll {
  /** The track config the roll started from. */
  track: TrackConfig;
  /** Hit offsets in steps from the roll's step. */
  hits: number[];
  /** Steps played since the roll's step. */
  elapsed: number;
  /** When the roll's step played (swing included). */
  startTime: number;
  gain: number;
  pan: number;
}

export type Rolls = Partial<Record<TrackId, Roll>>;

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
  /** Retrig rolls carried over from earlier steps. */
  rolls?: Rolls;
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
  /** Retrig rolls that go on into the next step. */
  rolls: Rolls;
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
  const rolls: Rolls = {};
  const stepDur = (60 / config.bpm) * 0.25;

  // Swing: offset odd steps forward in time
  const halfStep = (60 / config.bpm) * 0.25 / 2;
  const swingOffset = step % 2 === 1
    ? (config.swing / 100) * 0.7 * halfStep
    : 0;
  const scheduledTime = time + swingOffset;

  const anySolo = Object.values(trackStates).some(
    t => t.isSolo
  );

  const trackStep = (id: TrackId): number => {
    const len = config.tracks[id].steps.length;
    return config.tracks[id].freeRun
      ? (totalSteps - 1) % len
      : step % len;
  };

  // A track starts a new cycle whenever its own step
  // wraps back to 0. A free-running track wraps every
  // `len` global steps; any other track also restarts
  // at each pattern boundary, so a 12-step track in a
  // 16-step pattern loops after 12 steps and again
  // after the remaining 4. The very first step is cycle
  // 0, not a wrap.
  for (const id of TRACK_IDS) {
    if (totalSteps > 1 && trackStep(id) === 0) {
      cycleCounts[id] = (cycleCounts[id] ?? 0) + 1;
    }
  }

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

  const patLen = getPatternLength(config.tracks);

  // Plays a roll's hits that fall on step `elapsed` of
  // it, and keeps the roll if hits remain after that.
  const playRoll = (id: TrackId, roll: Roll) => {
    for (const t of roll.hits) {
      if (hitStep(t) === roll.elapsed) {
        sounds.push([
          id, roll.startTime + t * stepDur, roll.gain, roll.pan,
        ]);
      }
    }
    const last = roll.hits[roll.hits.length - 1];
    if (hitStep(last) > roll.elapsed) rolls[id] = roll;
  };

  // Evaluate each audible track
  TRACKS.forEach(track => {
    const st = trackStates[track.id];
    const audible = anySolo
      ? st.isSolo
      : !st.isMuted;
    if (!audible) return;

    const effectiveStep = trackStep(track.id);
    const trackConfig = config.tracks[track.id];

    // A roll from an earlier step goes on unless the
    // track was edited or another pattern took over.
    // Rolls stop before the next lit step, so they
    // never overlap a new hit.
    const prev = deps.rolls?.[track.id];
    if (prev && prev.track === trackConfig) {
      playRoll(track.id, { ...prev, elapsed: prev.elapsed + 1 });
    }

    if (trackConfig.steps[effectiveStep] === '1') {
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

      // A new hit always ends an older roll.
      delete rolls[track.id];
      playRoll(track.id, {
        track: trackConfig,
        hits: retrigHits(
          trackConfig.steps,
          effectiveStep,
          locks?.retrig,
          patLen - step,
        ),
        elapsed: 0,
        startTime: scheduledTime,
        gain,
        pan,
      });
      triggeredTracks.add(track.id);
    }
  });

  // ─── Step boundary: pattern mode signals ──────
  const result: ComputeStepResult = {
    triggeredTracks,
    cycleCounts,
    totalSteps,
    sounds,
    rolls,
  };

  if (step === patLen - 1) {
    // Sequential: apply pending pattern
    if (pendingPattern) {
      result.applyPending = {
        config: {
          ...config,
          tracks: pendingPattern.tracks,
          mixer: withPresetLevels(
            config.mixer, pendingPattern.mixer
          ),
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
          mixer: withLevelsFrom(
            config.mixer, homeSnapshot.mixer
          ),
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
