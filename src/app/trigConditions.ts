import type { TrigCondition } from './types';

/**
 * Context needed to evaluate a trig condition.
 */
export interface ConditionContext {
  /** Current cycle count for this track (0-indexed). */
  cycleCount: number;
}

/**
 * Evaluate whether a step should fire given its
 * condition and the current context.
 *
 * Returns true if:
 * - No condition (undefined) -- always fire
 * - Probability: Math.random() < value/100
 * - Cycle A:B: (cycleCount % b) === (a - 1)
 *
 * Args:
 *   condition: The trig condition, or undefined
 *     for unconditional steps.
 *   ctx: Current evaluation context.
 *
 * Returns:
 *   Whether the step should fire.
 */
export function evaluateCondition(
  condition: TrigCondition | undefined,
  ctx: ConditionContext
): boolean {
  if (condition === undefined) return true;

  switch (condition.type) {
    case 'probability':
      return Math.random() < condition.value / 100;
    case 'cycle':
      return ctx.cycleCount % condition.b === condition.a - 1;
  }
}
