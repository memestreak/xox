import type { StepConditions } from './types';

/**
 * Context needed to evaluate a trig condition.
 */
export interface ConditionContext {
  /** Current cycle count for this track (0-indexed). */
  cycleCount: number;
  /** Whether the global fill button is active. */
  fillActive: boolean;
}

/**
 * Evaluate whether a step should fire given its
 * conditions and the current context. Both probability
 * and cycle are checked with AND semantics.
 *
 * Returns true if:
 * - No conditions (undefined) -- always fire
 * - Probability passes AND cycle matches
 *
 * Args:
 *   conditions: The step conditions, or undefined
 *     for unconditional steps.
 *   ctx: Current evaluation context.
 *
 * Returns:
 *   Whether the step should fire.
 */
export function evaluateCondition(
  conditions: StepConditions | undefined,
  ctx: ConditionContext
): boolean {
  if (!conditions) return true;
  if (conditions.probability !== undefined) {
    if (
      Math.random() >= conditions.probability / 100
    ) {
      return false;
    }
  }
  if (conditions.cycle) {
    const { a, b } = conditions.cycle;
    if ((ctx.cycleCount % b) + 1 !== a) {
      return false;
    }
  }
  if (conditions.fill === 'fill' && !ctx.fillActive) {
    return false;
  }
  if (conditions.fill === '!fill' && ctx.fillActive) {
    return false;
  }
  return true;
}

/**
 * A cycle option for the UI dropdown.
 */
export interface CycleOption {
  label: string;
  a: number;
  b: number;
}

/**
 * All valid cycle options for the dropdown.
 * 1:1 means "every cycle" (no filtering).
 */
export const CYCLE_OPTIONS: CycleOption[] = (() => {
  const opts: CycleOption[] = [
    { label: '1:1', a: 1, b: 1 },
  ];
  for (let b = 2; b <= 8; b++) {
    for (let a = 1; a <= b; a++) {
      opts.push({ label: `${a}:${b}`, a, b });
    }
  }
  return opts;
})();
