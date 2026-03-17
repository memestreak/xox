"use client";

import { useRef, useCallback, useEffect } from 'react';

interface ProbabilitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Horizontal probability slider (1-100) with
 * pointer-capture drag and keyboard controls.
 *
 * Args:
 *   value: Current probability (1-100)
 *   onChange: Callback with new value
 */
export default function ProbabilitySlider({
  value,
  onChange,
}: ProbabilitySliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startValue: number;
  } | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const clamp = (v: number) =>
    Math.max(1, Math.min(100, Math.round(v)));

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
          / width) * 99;
      onChange(
        clamp(dragRef.current.startValue + delta)
      );
    },
    [onChange]
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
        next = 1;
      } else if (e.key === 'End') {
        next = 100;
      } else {
        return;
      }
      e.preventDefault();
      onChange(next);
    },
    [onChange]
  );

  const pct = ((value - 1) / 99) * 100;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Probability"
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
