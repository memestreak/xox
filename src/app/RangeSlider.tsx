"use client";

import { useRef, useCallback, useEffect } from 'react';

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
}

/**
 * Horizontal range slider with pointer-capture drag
 * and keyboard controls.
 *
 * Args:
 *   value: Current value
 *   min: Minimum value (inclusive)
 *   max: Maximum value (inclusive)
 *   onChange: Callback with new value
 *   label: Accessible label (default "Value")
 */
export default function RangeSlider({
  value,
  min,
  max,
  onChange,
  label = 'Value',
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startValue: number;
  } | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const range = max - min;

  const clamp = useCallback(
    (v: number) =>
      Math.max(min, Math.min(max, Math.round(v))),
    [min, max]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(
        e.pointerId
      );
      dragRef.current = {
        startX: e.clientX,
        startValue: valueRef.current,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !trackRef.current) {
        return;
      }
      const width = trackRef.current.offsetWidth;
      if (width === 0) return;
      const delta =
        ((e.clientX - dragRef.current.startX)
          / width) * range;
      onChange(
        clamp(dragRef.current.startValue + delta)
      );
    },
    [onChange, range, clamp]
  );

  const release = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const v = valueRef.current;
      let next = v;
      const step = e.shiftKey ? 10 : 1;
      if (
        e.key === 'ArrowRight'
        || e.key === 'ArrowUp'
      ) {
        next = clamp(v + step);
      } else if (
        e.key === 'ArrowLeft'
        || e.key === 'ArrowDown'
      ) {
        next = clamp(v - step);
      } else if (e.key === 'Home') {
        next = min;
      } else if (e.key === 'End') {
        next = max;
      } else {
        return;
      }
      e.preventDefault();
      onChange(next);
    },
    [onChange, min, max, clamp]
  );

  const pct = range > 0
    ? ((value - min) / range) * 100
    : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className={
          'relative h-7 flex-1 flex items-center'
          + ' cursor-ew-resize rounded'
          + ' focus-visible:outline-2'
          + ' focus-visible:outline-offset-2'
          + ' focus-visible:outline-accent'
        }
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
      >
        <FaderTrack />
        <div
          className="absolute left-0 h-1 rounded-sm bg-accent pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        <FaderCap pct={pct} />
      </div>
      <span className={
        'text-[13px] font-mono text-ink'
        + ' w-11 text-right tabular-nums'
      }>
        {value}%
      </span>
    </div>
  );
}

/** Recessed groove the fader cap rides in. */
export function FaderTrack() {
  return (
    <div className="absolute inset-x-0 h-1 rounded-sm bg-well shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)] pointer-events-none" />
  );
}

/** Cream fader cap with a center line, at pct (0-100). */
export function FaderCap({ pct }: { pct: number }) {
  return (
    <div
      className="absolute w-3.5 h-[22px] -ml-[7px] rounded-[3px] bg-linear-to-b from-[#efe8da] to-[#bdb5a6] shadow-[0_2px_4px_rgb(0_0_0/0.6)] flex items-center justify-center pointer-events-none"
      style={{ left: `${pct}%` }}
    >
      <div className="w-2 h-0.5 rounded-sm bg-panel" />
    </div>
  );
}
