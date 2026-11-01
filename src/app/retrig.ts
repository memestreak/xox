import type { StepLocks, TrackConfig } from './types';

/**
 * Per-step retrig: a step's hit repeats at a rate for a
 * length, both note values. One step is a 1/16 note.
 */
export type Retrig = NonNullable<StepLocks['retrig']>;

/** Rate options: the note value between hits (1/N). */
export const RETRIG_RATES: readonly number[] = [
  5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80,
];

/**
 * Length options in steps, with their note values.
 * Lengths under a step make flams.
 */
export const RETRIG_LENGTHS: ReadonlyArray<
  readonly [steps: number, label: string]
> = [
  [0.125, '1/128'], [0.25, '1/64'], [0.5, '1/32'],
  [1, '1/16'], [2, '1/8'], [3, '3/16'], [4, '1/4'],
  [8, '1/2'], [16, '1/1'],
];

/** What the editor starts from when retrig is first turned on. */
export const DEFAULT_RETRIG: Retrig = {
  enabled: true, rate: 32, length: 1,
};

export function isRetrigRate(n: number): boolean {
  return RETRIG_RATES.includes(n);
}

export function isRetrigLength(n: number): boolean {
  return RETRIG_LENGTHS.some(([steps]) => steps === n);
}

// Float slack for hit offsets such as 16/12 * 3.
const EPS = 1e-9;

/**
 * When a step's hits play, in steps after the step (0 is
 * the step itself). A roll lasts `length` steps but stops
 * at the track's next lit step and at the pattern end
 * (`stepsLeft` = steps from this one to the end).
 * Without an enabled retrig the step plays once.
 */
export function retrigHits(
  steps: string,
  stepIndex: number,
  retrig: Retrig | undefined,
  stepsLeft: number,
): number[] {
  if (!retrig?.enabled) return [0];
  // A length under one step ends inside the step.
  let span = Math.min(1, retrig.length);
  while (span < retrig.length && span < stepsLeft) {
    if (steps[(stepIndex + span) % steps.length] === '1') break;
    span++;
  }
  const interval = 16 / retrig.rate;
  const hits: number[] = [];
  for (let k = 0; k * interval < span - EPS; k++) {
    hits.push(k * interval);
  }
  return hits;
}

/** The step (0 = the lit one) a hit offset falls on. */
export function hitStep(offset: number): number {
  return Math.floor(offset + EPS);
}

/**
 * For drawing: how many hits land on each step that
 * retrigs on this track cover, by step index (lit steps
 * included). Steps without retrig are left out.
 */
export function retrigCoverage(
  steps: string,
  locks: TrackConfig['parameterLocks'],
  patternLength: number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!locks) return out;
  for (const [key, lock] of Object.entries(locks)) {
    const i = Number(key);
    if (!lock.retrig?.enabled || steps[i] !== '1') continue;
    const hits = retrigHits(
      steps, i, lock.retrig, patternLength - i,
    );
    for (const t of hits) {
      const s = i + hitStep(t);
      out.set(s, (out.get(s) ?? 0) + 1);
    }
  }
  return out;
}
