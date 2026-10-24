"use client";

import { useRef, useCallback, useEffect, useId, memo } from 'react';

interface KnobProps {
  value: number;
  onChange: (v: number) => void;
  trackName?: string;
  size?: number;
  centerLabel?: string;
  defaultValue?: number;
  formatValue?: (v: number) => string;
  ariaPrefix?: string;
  /**
   * Show the value in a popup while hovering. Turn it
   * off when the value is already shown next to the knob.
   */
  showHoverValue?: boolean;
  /** Extra description ids (e.g. from a wrapping Tooltip). */
  'aria-describedby'?: string;
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

// Pre-computed background arc for the default size.
const DEFAULT_SIZE = 28;
const BG_CX = DEFAULT_SIZE / 2;
const BG_CY = DEFAULT_SIZE / 2;
const BG_R = (DEFAULT_SIZE - 4) / 2;
const BG_ARC = describeArc(BG_CX, BG_CY, BG_R, 135, 405);

const KEYBOARD_HINT =
  'Use arrow keys to adjust, Shift plus arrow for'
  + ' larger steps, Home and End for minimum and maximum.';
const RESET_HINT = 'Double-click to reset.';

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
  centerLabel,
  defaultValue,
  formatValue = (v: number) => `${Math.round(v * 100)}%`,
  ariaPrefix = 'Volume',
  showHoverValue = true,
  'aria-describedby': extraDescribedBy,
}: KnobProps) {
  const descriptionId = useId();
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

  // Knob cap with a pointer line, inside the arc ring.
  const capR = r - 4;
  const valueRad = (valueAngle * Math.PI) / 180;
  const tipX = cx + (capR - 1) * Math.cos(valueRad);
  const tipY = cy + (capR - 1) * Math.sin(valueRad);

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

  const resetToDefault = useCallback(
    (e: React.MouseEvent) => {
      if (
        defaultValue !== undefined
        && (e.detail >= 2 || e.metaKey)
      ) {
        e.preventDefault();
        onChange(defaultValue);
      }
    },
    [defaultValue, onChange]
  );

  const label = trackName
    ? `${ariaPrefix} ${trackName}`
    : ariaPrefix;

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
        aria-valuetext={formatValue(value)}
        aria-label={label}
        aria-describedby={
          extraDescribedBy
            ? `${descriptionId} ${extraDescribedBy}`
            : descriptionId
        }
        className="cursor-ns-resize outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
        style={{ touchAction: 'manipulation' }}
        onClick={resetToDefault}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
      >
        <path
          d={bgArc}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {value >= 0.005 && (
          <path
            d={describeArc(
              cx, cy, r, startAngle, valueAngle
            )}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={capR}
          fill="#2a2723"
          stroke="var(--color-edge)"
        />
        {!centerLabel && (
          <line
            x1={cx}
            y1={cy}
            x2={tipX}
            y2={tipY}
            stroke="var(--color-ink)"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        )}
        {centerLabel && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-muted)"
            fontSize={size * 0.26}
            fontWeight="bold"
            className="pointer-events-none select-none"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <span id={descriptionId} className="sr-only">
        {KEYBOARD_HINT}
        {defaultValue !== undefined && ` ${RESET_HINT}`}
      </span>
      {showHoverValue && (
        <div className="absolute bottom-full mb-1 hidden group-hover:block px-1.5 py-0.5 text-[10px] font-bold font-mono bg-raised text-ink border border-edge rounded whitespace-nowrap z-40">
          {formatValue(value)}
        </div>
      )}
    </div>
  );
}

const Knob = memo(KnobInner);
export default Knob;
