/**
 * Step button color logic extracted as a pure function.
 * Returns Tailwind class string for the step's
 * background color and effects.
 */
export function getStepColor(
  isActive: boolean,
  isCurrent: boolean,
  mini?: boolean
): string {
  if (isActive) {
    if (isCurrent && !mini) {
      return 'bg-orange-400 motion-safe:scale-105'
        + ' shadow-[0_0_20px_rgba(251,146,60,0.8)]'
        + ' z-10';
    }
    if (isCurrent && mini) {
      return 'bg-orange-400';
    }
    return 'bg-orange-600';
  }
  if (isCurrent) {
    return 'bg-neutral-700';
  }
  return 'bg-neutral-800/40 hover:bg-neutral-800';
}
