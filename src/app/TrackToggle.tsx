"use client";

import { memo } from 'react';
import Tooltip from './Tooltip';

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
  { active: string; led: string; label: string }
> = {
  // Mute lights amber, solo lights cream.
  mute: {
    active:
      'bg-none bg-mute border-mute text-[#1a1208]',
    led: 'bg-[#fff4d6]',
    label: 'M',
  },
  solo: {
    active:
      'bg-none bg-step4 border-step4 text-[#1a1208]',
    led: 'bg-accent',
    label: 'S',
  },
};

const SIZE_STYLES: Record<Size, string> = {
  sm:
    'w-[26px] h-[22px] text-[11px] rounded',
  md:
    'w-[26px] h-[26px] text-xs rounded-[5px]',
  lg:
    'min-w-[44px] min-h-[44px] text-sm rounded-md',
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
    <Tooltip tooltipKey={variant}>
      <button
        onClick={onToggle}
        className={
          'ss-key ss-cap relative shrink-0 flex'
          + ' items-center justify-center tracking-normal '
          + SIZE_STYLES[size]
          + ' '
          + (active ? v.active : 'text-muted')
        }
        aria-label={`${action} ${trackName}`}
        aria-pressed={active}
      >
        <span
          aria-hidden="true"
          className={
            'absolute top-[3px] right-[3px] w-1 h-1'
            + ' rounded-full '
            + (active ? v.led : 'bg-[#3b3731]')
          }
        />
        {v.label}
      </button>
    </Tooltip>
  );
}

const TrackToggle = memo(TrackToggleInner);
export default TrackToggle;
