/**
 * Shared utilities for TrackRow and AccentRow.
 */

/**
 * Compute the effective running-light step position,
 * accounting for free-run mode and per-track length.
 */
export function computeEffectiveStep(
  currentStep: number,
  totalSteps: number,
  isFreeRun: boolean,
  trackLength: number
): number {
  if (currentStep < 0) return -1;
  return (isFreeRun ? totalSteps : currentStep)
    % trackLength;
}

/**
 * Format a pan value (0.0–1.0) as a display string.
 * 0.5 = "C", <0.5 = "L{pct}", >0.5 = "R{pct}".
 */
export function formatPan(v: number): string {
  const pct = Math.round((v - 0.5) * 200);
  if (pct === 0) return 'C';
  return pct < 0 ? `L${-pct}` : `R${pct}`;
}
