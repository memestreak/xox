/**
 * Step key colors (Silkscreen theme). Steps are lit in
 * TR-808 style groups of four: red, orange, yellow,
 * cream. Pure function returning Tailwind classes.
 *
 * Class names are written out in full so Tailwind's
 * scanner can find them.
 */

/** Key colors per group: [unlit, lit, playhead-unlit]. */
const GROUPS = [
  ['bg-step1-off', 'bg-step1', 'bg-step1/40'],
  ['bg-step2-off', 'bg-step2', 'bg-step2/40'],
  ['bg-step3-off', 'bg-step3', 'bg-step3/40'],
  ['bg-step4-off', 'bg-step4', 'bg-step4/40'],
] as const;

/** Text color for badges drawn on a lit key. */
const BADGE_TEXT = [
  'text-white', 'text-[#1f1206]',
  'text-[#1f1a06]', 'text-[#1f1c16]',
] as const;

/** Running-light outline on the playing step. */
export const PLAYHEAD_CLASS =
  'outline-2 outline-offset-2 outline-ink/80';

const LIT_SHADOW =
  'shadow-[inset_0_-3px_0_rgb(0_0_0/0.22),'
  + 'inset_0_1px_0_rgb(255_255_255/0.35)]';
const UNLIT_SHADOW =
  'shadow-[inset_0_-3px_0_rgb(0_0_0/0.35),'
  + 'inset_0_1px_0_rgb(255_255_255/0.05)]';

/**
 * Returns the group (0-3) of a step: which block of
 * four it sits in within its 16-step page.
 */
export function stepGroup(stepIndex: number): number {
  return Math.floor((stepIndex % 16) / 4);
}

/**
 * Background and effect classes for a step key.
 *
 * Args:
 *   isActive: Step is on.
 *   isCurrent: Step is under the playhead.
 *   mini: Accent-row key (single accent color).
 *   group: Color group 0-3 (see stepGroup).
 */
export function getStepColor(
  isActive: boolean,
  isCurrent: boolean,
  mini?: boolean,
  group = 0,
): string {
  if (mini) {
    if (isActive) {
      return isCurrent ? 'bg-accent-hi' : 'bg-accent';
    }
    return isCurrent ? 'bg-faint' : 'bg-[#2a2824]';
  }
  const [unlit, lit, playUnlit] = GROUPS[group] ?? GROUPS[0];
  if (isActive) {
    return lit + ' ' + LIT_SHADOW
      + ' after:bg-white/85 ' + BADGE_TEXT[group]
      + (isCurrent
        ? ' brightness-125 z-10 ' + PLAYHEAD_CLASS
        : '');
  }
  if (isCurrent) {
    return playUnlit + ' ' + UNLIT_SHADOW
      + ' after:bg-black/35 ' + PLAYHEAD_CLASS;
  }
  return unlit + ' ' + UNLIT_SHADOW
    + ' after:bg-black/35 hover:brightness-125';
}
