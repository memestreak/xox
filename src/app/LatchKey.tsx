"use client";

// MOCK ONLY: one key style shared by Fill and Temp that
// shows momentary and latched states. Not for merging.
import { useRef } from 'react';
import type { BodyState, LatchVariant } from './mockLatch';

interface LatchKeyProps {
  variant: Exclude<LatchVariant, ''>;
  label: string;
  size: 'header' | 'strip';
  body: BodyState;
  latched: boolean;
  /** Body disabled (Temp while stopped). Latch stays live. */
  disabled?: boolean;
  onBodyDown?: () => void;
  onBodyUp?: () => void;
  onBodyClick?: () => void;
  onLatch?: () => void;
}

// Shared language: amber = held (momentary), lit orange =
// on, blinking orange outline = armed, LED = latched.
function bodyLook(body: BodyState): string {
  switch (body) {
    case 'held':
      return 'bg-none bg-mute text-[#1a1208]'
        + ' shadow-[0_0_18px_rgb(242_178_58/0.45)]';
    case 'active':
      return 'bg-none bg-accent text-[#1a0d05]'
        + ' shadow-[0_0_18px_rgb(240_102_42/0.4)]';
    case 'armed':
      return 'text-accent-hi';
    default:
      return 'text-ink';
  }
}

const SIZES = {
  header: {
    h: 'h-10 lg:h-11',
    text: 'text-sm lg:text-[17px]',
    pad: 'px-3 lg:px-[18px]',
    latchW: 'w-6 sm:w-7 lg:w-8',
    padA: 'px-2.5 sm:px-3 lg:px-[18px]',
    square: 'w-10 lg:w-11',
    radius: 'rounded-lg',
  },
  strip: {
    h: 'h-9',
    text: 'text-xs',
    pad: 'px-2.5',
    latchW: 'w-6',
    padA: 'px-2.5',
    square: 'w-9',
    radius: 'rounded-md',
  },
};

export default function LatchKey({
  variant, label, size, body, latched, disabled,
  onBodyDown, onBodyUp, onBodyClick, onLatch,
}: LatchKeyProps) {
  const s = SIZES[size];
  const lastTap = useRef(0);
  const led = (
    <span
      aria-hidden="true"
      className={'ss-led' + (latched ? ' ss-led-on' : '')}
    />
  );
  const armedRing = body === 'armed'
    ? ' border-accent animate-temp-blink' : '';
  const bodyBorder = body === 'held'
    ? ' border-mute'
    : body === 'active' ? ' border-accent-hi' : '';
  const handlers = {
    onPointerDown: onBodyDown,
    onPointerUp: onBodyUp,
    onPointerCancel: onBodyUp,
    onClick: onBodyClick,
  };

  if (variant === 'A') {
    // Jeremy's idea: one key, right third is a latch
    // section with its own LED.
    return (
      <div
        role="group"
        aria-label={label}
        className={
          'ss-key inline-flex items-stretch overflow-hidden p-0 '
          + s.h + ' ' + s.radius
          + (body === 'armed' ? ' border-accent' : '')
          + (body === 'held' ? ' border-mute' : '')
          + (body === 'active' ? ' border-accent-hi' : '')
        }
      >
        <button
          {...handlers}
          disabled={disabled}
          aria-pressed={body !== 'off'}
          style={{ touchAction: 'manipulation' }}
          className={
            'ss-cap flex items-center disabled:opacity-40 '
            + s.padA + ' ' + s.text + ' ' + bodyLook(body)
            + (body === 'armed' ? ' animate-temp-blink' : '')
          }
        >
          {label}
        </button>
        <span aria-hidden="true" className="w-px bg-edge" />
        <button
          onClick={onLatch}
          aria-label={'Latch ' + label.toLowerCase()}
          aria-pressed={latched}
          className={
            'flex items-center justify-center bg-[#1c1a17] '
            + s.latchW
          }
        >
          {led}
        </button>
      </div>
    );
  }

  if (variant === 'B') {
    // Two keys: the normal key plus a square latch key.
    return (
      <div role="group" aria-label={label} className="inline-flex gap-1">
        <button
          {...handlers}
          disabled={disabled}
          aria-pressed={body !== 'off'}
          style={{ touchAction: 'manipulation' }}
          className={
            'ss-key ss-cap disabled:opacity-40 '
            + s.h + ' ' + s.pad + ' ' + s.text + ' ' + s.radius
            + ' ' + bodyLook(body) + bodyBorder + armedRing
          }
        >
          {label}
        </button>
        <button
          onClick={onLatch}
          aria-label={'Latch ' + label.toLowerCase()}
          aria-pressed={latched}
          className={
            'ss-key flex flex-col items-center justify-center gap-1 '
            + s.h + ' ' + s.square + ' ' + s.radius
            + (latched ? ' border-accent' : '')
          }
        >
          {led}
          <span className="font-display font-semibold uppercase tracking-[0.08em] text-[9px] leading-none text-muted">
            Latch
          </span>
        </button>
      </div>
    );
  }

  // C: one key with an LED in the corner. Double-tap
  // latches, a single tap unlatches.
  return (
    <button
      onPointerDown={onBodyDown}
      onPointerUp={onBodyUp}
      onPointerCancel={onBodyUp}
      onClick={() => {
        const now = Date.now();
        if (latched || now - lastTap.current < 300) {
          onLatch?.();
          lastTap.current = 0;
        } else {
          lastTap.current = now;
          onBodyClick?.();
        }
      }}
      disabled={disabled}
      aria-pressed={body !== 'off' || latched}
      style={{ touchAction: 'manipulation' }}
      className={
        'ss-key ss-cap relative disabled:opacity-40 '
        + s.h + ' ' + s.pad + ' pr-5 lg:pr-6 ' + s.text + ' ' + s.radius
        + ' ' + bodyLook(body) + bodyBorder + armedRing
      }
    >
      {label}
      <span className="absolute top-1 right-1 flex rounded-full bg-[#141311] p-[3px] [&>.ss-led]:w-[7px] [&>.ss-led]:h-[7px]">
        {led}
      </span>
    </button>
  );
}
