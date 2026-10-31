import type { StepLocks } from './types';

/**
 * MOCK: per-step retrig (Elektron style). Rate and length
 * are note values; one step is a 1/16 note.
 */
export type Retrig = NonNullable<StepLocks['retrig']>;

/** Rate options: the note value between hits (1/N). */
export const RETRIG_RATES = [8, 12, 16, 24, 32, 48, 64];

/** Length options in steps (1/16 notes), with labels. */
export const RETRIG_LENGTHS: ReadonlyArray<readonly [number, string]> = [
  [1, '1/16'], [2, '1/8'], [3, '3/16'], [4, '1/4'], [8, '1/2'], [16, '1/1'],
];

export const DEFAULT_RETRIG: Retrig = {
  enabled: true, rate: 32, length: 1,
};

/**
 * Where a step's retrig hits fall, in steps after the
 * step (0 is the step itself). The roll lasts `length`
 * steps but stops early at the track's next lit step
 * and at the end of the pattern.
 */
export function retrigHits(
  steps: string,
  stepIndex: number,
  retrig: Retrig | undefined,
  patternLength: number,
): number[] {
  if (!retrig?.enabled) return [0];
  let span = 1;
  while (span < retrig.length) {
    const next = stepIndex + span;
    if (next >= patternLength) break;
    if (steps[next % steps.length] === '1') break;
    span++;
  }
  const interval = 16 / retrig.rate;
  const hits: number[] = [];
  for (let t = 0; t < span - 1e-9; t += interval) {
    hits.push(t);
  }
  return hits;
}

/** Ramp gain for hit k of n. */
export function rampScale(
  ramp: Retrig['ramp'], k: number, n: number,
): number {
  if (n < 2) return 1;
  if (ramp === 'in') return (k + 1) / n;
  if (ramp === 'out') return 1 - k / n;
  return 1;
}

/**
 * For drawing: how many hits land on each step a roll
 * covers, keyed by step index (the lit step included).
 */
export function retrigCoverage(
  steps: string,
  locks: Record<number, StepLocks> | undefined,
  patternLength: number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!locks) return out;
  for (const [key, l] of Object.entries(locks)) {
    const i = Number(key);
    if (!l.retrig?.enabled || steps[i] !== '1') continue;
    for (const t of retrigHits(steps, i, l.retrig, patternLength)) {
      const s = i + Math.floor(t + 1e-9);
      out.set(s, (out.get(s) ?? 0) + 1);
    }
  }
  return out;
}
