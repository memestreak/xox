"use client";

import { useRef, useCallback } from 'react';

interface KnobProps {
  value: number;
  onChange: (v: number) => void;
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
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function Knob({ value, onChange, size = 24 }: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 4) / 2;
  const startAngle = 135;
  const endAngle = 405;
  const valueAngle = startAngle + value * (endAngle - startAngle);

  const valueRad = (valueAngle * Math.PI) / 180;
  const dotX = cx + r * Math.cos(valueRad);
  const dotY = cy + r * Math.sin(valueRad);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startValue: value };
  }, [value]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = (dragRef.current.startY - e.clientY) / 200;
    const next = Math.max(0, Math.min(1, dragRef.current.startValue + delta));
    onChange(next);
  }, [onChange]);

  const release = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className="group relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="cursor-ns-resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onLostPointerCapture={release}
      >
        <path
          d={describeArc(cx, cy, r, startAngle, endAngle)}
          fill="none"
          stroke="#404040"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {value >= 0.005 && (
          <path
            d={describeArc(cx, cy, r, startAngle, valueAngle)}
            fill="none"
            stroke="#f97316"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        <circle cx={dotX} cy={dotY} r={2} fill="#f97316" />
      </svg>
      <div className="absolute bottom-full mb-1 hidden group-hover:block px-1.5 py-0.5 text-[10px] font-bold bg-neutral-800 text-neutral-200 rounded whitespace-nowrap">
        {Math.round(value * 100)}%
      </div>
    </div>
  );
}
