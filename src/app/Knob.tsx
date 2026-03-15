"use client";

import { useRef, useCallback, useEffect, memo } from 'react';

interface KnobProps {
  value: number;
  onChange: (v: number) => void;
  trackName?: string;
  size?: number;
}

function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number
): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc =
    endAngle - startAngle > 180 ? 1 : 0;
  return (
    `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1`
    + ` ${x2} ${y2}`
  );
}

// Pre-computed background arc for the default size (24).
const DEFAULT_SIZE = 24;
const BG_CX = DEFAULT_SIZE / 2;
const BG_CY = DEFAULT_SIZE / 2;
const BG_R = (DEFAULT_SIZE - 4) / 2;
const BG_ARC = describeArc(BG_CX, BG_CY, BG_R, 135, 405);

/**
 * Rotary knob control rendered as an SVG arc.
 *
 * Args:
 *   value: Current value (0-1).
 *   onChange: Callback when value changes.
 *   trackName: Track name for accessible label.
 *   size: SVG dimensions in pixels.
 */
function KnobInner({
  value,
  onChange,
  trackName,
  size = DEFAULT_SIZE,
}: KnobProps) {
  const dragRef = useRef<{
    startY: number;
    startValue: number;
  } | null>(null);

  // Ref-based value access to stabilize callbacks.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 4) / 2;
  const startAngle = 135;
  const endAngle = 405;
  const valueAngle =
    startAngle + value * (endAngle - startAngle);

  const valueRad = (valueAngle * Math.PI) / 180;
  const dotX = cx + r * Math.cos(valueRad);
  const dotY = cy + r * Math.sin(valueRad);

  const bgArc =
    size === DEFAULT_SIZE
      ? BG_ARC
      : describeArc(cx, cy, r, startAngle, endAngle);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(
        e.pointerId
      );
      dragRef.current = {
        startY: e.clientY,
        startValue: valueRef.current,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const delta =
        (dragRef.current.startY - e.clientY) / 200;
      const next = Math.max(
        0,
        Math.min(1, dragRef.current.startValue + delta)
      );
      onChange(next);
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
      if (
        e.key === 'ArrowUp'
        || e.key === 'ArrowRight'
      ) {
        next = Math.min(
          1,
          v + (e.shiftKey ? 0.1 : 0.01)
        );
      } else if (
        e.key === 'ArrowDown'
        || e.key === 'ArrowLeft'
      ) {
        next = Math.max(
          0,
          v - (e.shiftKey ? 0.1 : 0.01)
        );
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = 1;
      } else {
        return;
      }
      e.preventDefault();
      onChange(next);
    },
    [onChange]
  );

  const label = trackName
    ? `Volume ${trackName}`
    : 'Volume';

  return (
    <div className="group relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-label={label}
        className="cursor-ns-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-full"
        style={{ touchAction: 'manipulation' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
      >
        <path
          d={bgArc}
          fill="none"
          stroke="#404040"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {value >= 0.005 && (
          <path
            d={describeArc(
              cx, cy, r, startAngle, valueAngle
            )}
            fill="none"
            stroke="#f97316"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        <circle
          cx={dotX}
          cy={dotY}
          r={2}
          fill="#f97316"
        />
      </svg>
      <div className="absolute bottom-full mb-1 hidden group-hover:block px-1.5 py-0.5 text-[10px] font-bold bg-neutral-800 text-neutral-200 rounded whitespace-nowrap">
        {Math.round(value * 100)}%
      </div>
    </div>
  );
}

const Knob = memo(KnobInner);
export default Knob;
