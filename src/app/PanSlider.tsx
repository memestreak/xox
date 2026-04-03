"use client";

import { useRef, useCallback, useEffect } from 'react';

interface PanSliderProps {
  value: number;
  onChange: (v: number) => void;
}

function formatPan(v: number): string {
  const pct = Math.round((v - 50) * 2);
  if (pct === 0) return 'C';
  return pct < 0 ? `L${-pct}` : `R${pct}`;
}

/**
 * Horizontal pan slider with center-fill bar.
 * Range is 0–100 (0 = full left, 50 = center,
 * 100 = full right). Fill bar expands from the
 * midpoint toward the current value.
 */
export default function PanSlider({
  value,
  onChange,
}: PanSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startValue: number;
  } | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const clamp = useCallback(
    (v: number) =>
      Math.max(0, Math.min(100, Math.round(v))),
    []
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
          / width) * 100;
      onChange(
        clamp(dragRef.current.startValue + delta)
      );
    },
    [onChange, clamp]
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
        next = 0;
      } else if (e.key === 'End') {
        next = 100;
      } else {
        return;
      }
      e.preventDefault();
      onChange(next);
    },
    [onChange, clamp]
  );

  // Center-fill: bar expands from 50% toward value.
  const offset = value < 50 ? value : 50;
  const barWidth = Math.abs(value - 50);
  const offsetPct = (offset / 100) * 100;
  const widthPct = (barWidth / 100) * 100;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Pan"
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
        {widthPct > 0 && (
          <div
            className={
              'absolute inset-y-0 rounded'
              + ' bg-orange-600'
            }
            style={{
              left: `${offsetPct}%`,
              width: `${widthPct}%`,
            }}
          />
        )}
      </div>
      <span className={
        'text-xs font-mono text-neutral-300'
        + ' w-10 text-right tabular-nums'
      }>
        {formatPan(value)}
      </span>
    </div>
  );
}
