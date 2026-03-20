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
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className={
          'relative h-6 flex-1 rounded'
          + ' bg-neutral-700 cursor-ew-resize'
          + ' focus-visible:outline-none'
          + ' focus-visible:ring-2'
          + ' focus-visible:ring-orange-500'
        }
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
      >
        <div
          className={
            'absolute inset-y-0 left-0 rounded'
            + ' bg-orange-600'
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={
        'text-xs font-mono text-neutral-300'
        + ' w-10 text-right tabular-nums'
      }>
        {value}%
      </span>
    </div>
  );
}
