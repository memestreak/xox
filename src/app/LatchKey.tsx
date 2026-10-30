"use client";

import Tooltip from './Tooltip';

/**
 * What the key's body shows right now: off, held
 * (momentary, amber), armed (blinking orange outline),
 * or active (lit orange).
 */
export type LatchKeyBody = 'off' | 'held' | 'armed' | 'active';

interface LatchKeyProps {
  /** Caption on the body, e.g. "FILL". */
  label: string;
  /** Name for the group and the latch button. */
  name: string;
  /** Accessible name of the body; defaults to `name`. */
  bodyAriaLabel?: string;
  /** header = Fill in row 1; strip = Temp in the strip. */
  size: 'header' | 'strip';
  body: LatchKeyBody;
  latched: boolean;
  /** Disables the body only; the latch stays live. */
  bodyDisabled?: boolean;
  bodyTooltipKey: string;
  latchTooltipKey: string;
  onBodyPointerDown?: (e: React.PointerEvent) => void;
  onBodyPointerUp?: (e: React.PointerEvent) => void;
  onBodyClick?: (e: React.MouseEvent) => void;
  onLatch: () => void;
}

const SIZES = {
  header: {
    height: 'h-10 lg:h-11',
    radius: 'rounded-lg',
    bodyRadius: 'rounded-l-lg',
    latchRadius: 'rounded-r-lg',
    text: 'text-sm lg:text-[17px]',
    padding: 'px-2.5 sm:px-3 lg:px-[18px]',
    latchWidth: 'w-6 sm:w-7 lg:w-8',
  },
  strip: {
    height: 'h-9',
    radius: 'rounded-md',
    bodyRadius: 'rounded-l-md',
    latchRadius: 'rounded-r-md',
    text: 'text-xs',
    padding: 'px-2.5',
    latchWidth: 'w-6',
  },
};

// The outer border follows the body so the whole key
// reads as one state. Always a border; only its color
// changes (see CLAUDE.md on conditional borders).
const BORDER: Record<LatchKeyBody, string> = {
  off: '',
  held: ' border-amber',
  armed: ' border-accent',
  active: ' border-accent-hi',
};

const BODY_LOOK: Record<LatchKeyBody, string> = {
  off: ' text-ink',
  held: ' bg-amber text-[#1a1208]'
    + ' shadow-[0_0_18px_rgb(242_178_58/0.45)]',
  armed: ' text-accent-hi',
  active: ' bg-accent text-[#1a0d05]'
    + ' shadow-[0_0_18px_rgb(240_102_42/0.4)]',
};

/**
 * Split key shared by Fill and Temp. The body does the
 * key's normal action; the right section toggles the
 * latch and its LED means "latched" and nothing else.
 */
export default function LatchKey({
  label,
  name,
  bodyAriaLabel,
  size,
  body,
  latched,
  bodyDisabled = false,
  bodyTooltipKey,
  latchTooltipKey,
  onBodyPointerDown,
  onBodyPointerUp,
  onBodyClick,
  onLatch,
}: LatchKeyProps) {
  const s = SIZES[size];
  const blink = body === 'armed' ? ' animate-temp-blink' : '';

  return (
    <div
      role="group"
      aria-label={name}
      className={
        'ss-key relative inline-flex items-stretch p-0 '
        + s.height + ' ' + s.radius + BORDER[body]
      }
    >
      {/* The span carries the tooltip so it isn't
          dimmed with a disabled body. */}
      <Tooltip tooltipKey={bodyTooltipKey} position="bottom">
        <span className="inline-flex">
          <button
            type="button"
            disabled={bodyDisabled}
            aria-label={bodyAriaLabel ?? name}
            aria-pressed={body !== 'off'}
            onPointerDown={onBodyPointerDown}
            onPointerUp={onBodyPointerUp}
            onPointerCancel={onBodyPointerUp}
            onClick={onBodyClick}
            style={{ touchAction: 'manipulation' }}
            className={
              'ss-cap flex items-center'
              + ' disabled:opacity-40 disabled:cursor-not-allowed'
              + ' focus-visible:outline-2 focus-visible:outline-offset-2'
              + ' focus-visible:outline-accent '
              + s.padding + ' ' + s.text + ' ' + s.bodyRadius
              + BODY_LOOK[body] + blink
            }
          >
            {label}
          </button>
        </span>
      </Tooltip>
      <span aria-hidden="true" className="w-px bg-edge" />
      <Tooltip
        tooltipKey={latchTooltipKey}
        position="bottom"
        align="right"
      >
        <button
          type="button"
          aria-label={'Latch ' + name.toLowerCase()}
          aria-pressed={latched}
          onClick={onLatch}
          className={
            'relative flex items-center justify-center'
            + ' bg-[#1c1a17] ' + s.latchRadius
            // Invisible pad: 6 px more touch area past
            // the right edge (fills the header gap).
            + ' after:absolute after:inset-y-0 after:-right-1.5'
            + ' after:w-1.5 after:content-[""]'
            + ' focus-visible:outline-2 focus-visible:outline-offset-2'
            + ' focus-visible:outline-accent '
            + s.latchWidth
          }
        >
          <span
            aria-hidden="true"
            className={'ss-led' + (latched ? ' ss-led-on' : '')}
          />
        </button>
      </Tooltip>
    </div>
  );
}
