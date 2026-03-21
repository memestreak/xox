"use client";

import { memo } from 'react';

type Variant = 'mute' | 'solo';
type Size = 'sm' | 'md' | 'lg';

interface TrackToggleProps {
  variant: Variant;
  active: boolean;
  trackName: string;
  size: Size;
  onToggle: () => void;
}

const VARIANT_STYLES: Record<
  Variant,
  { active: string; inactive: string; label: string }
> = {
  mute: {
    active:
      'bg-red-600 border-red-500 text-white'
      + ' shadow-[0_0_10px_rgba(220,38,38,0.4)]',
    inactive:
      'bg-neutral-800 border-neutral-700'
      + ' text-neutral-500',
    label: 'M',
  },
  solo: {
    active:
      'bg-green-600 border-green-500 text-white'
      + ' shadow-[0_0_10px_rgba(34,197,94,0.4)]',
    inactive:
      'bg-neutral-800 border-neutral-700'
      + ' text-neutral-500',
    label: 'S',
  },
};

const SIZE_STYLES: Record<Size, string> = {
  sm:
    'w-[26px] h-[22px] text-[9px] rounded',
  md:
    'w-6 h-6 text-[10px] rounded-md'
    + ' hover:border-neutral-600',
  lg:
    'min-w-[44px] min-h-[44px] text-[8px] rounded',
};

/**
 * Reusable Mute/Solo toggle button with size variants for
 * mobile header (lg), desktop sidebar (md), and mobile
 * mixer (sm).
 */
function TrackToggleInner({
  variant,
  active,
  trackName,
  size,
  onToggle,
}: TrackToggleProps) {
  const v = VARIANT_STYLES[variant];
  const action =
    variant === 'mute' ? 'Mute' : 'Solo';

  return (
    <button
      onClick={onToggle}
      className={
        'shrink-0 flex items-center justify-center'
        + ' font-bold border transition-colors'
        + ' focus-visible:outline-none'
        + ' focus-visible:ring-2'
        + ' focus-visible:ring-orange-500 '
        + SIZE_STYLES[size]
        + ' '
        + (active ? v.active : v.inactive)
      }
      aria-label={`${action} ${trackName}`}
      aria-pressed={active}
    >
      {v.label}
    </button>
  );
}

const TrackToggle = memo(TrackToggleInner);
export default TrackToggle;
