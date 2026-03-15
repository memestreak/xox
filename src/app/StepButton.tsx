"use client";

import { memo } from 'react';

interface StepButtonProps {
  trackName: string;
  stepIndex: number;
  isActive: boolean;
  isCurrent: boolean;
  isBeat: boolean;
  onToggle: () => void;
}

/**
 * Individual step toggle button. Memoized so it only
 * re-renders when its active/current state changes.
 */
function StepButtonInner({
  trackName,
  stepIndex,
  isActive,
  isCurrent,
  isBeat,
  onToggle,
}: StepButtonProps) {
  let color: string;
  if (isActive) {
    color = isCurrent
      ? 'bg-orange-400 motion-safe:scale-105'
        + ' shadow-[0_0_20px_rgba(251,146,60,0.8)]'
        + ' z-10'
      : 'bg-orange-600';
  } else {
    color = isCurrent
      ? 'bg-neutral-700'
      : 'bg-neutral-800/40 hover:bg-neutral-800';
  }

  return (
    <button
      onClick={onToggle}
      aria-label={`${trackName} step ${stepIndex + 1}`}
      aria-pressed={isActive}
      style={{ touchAction: 'manipulation' }}
      className={
        'h-8 lg:h-12 rounded-sm'
        + ' transition-colors duration-100'
        + ' motion-safe:transition-transform'
        + ' focus-visible:outline-none'
        + ' focus-visible:ring-2'
        + ' focus-visible:ring-orange-500 '
        + color
        + (isBeat ? ' border-l-2 border-neutral-700' : '')
      }
    />
  );
}

const StepButton = memo(StepButtonInner);
export default StepButton;
