"use client";

// MOCK ONLY: Steps number entry variants. ?mock=A|B|C
// picks one; no param keeps today's dropdown. Not for
// merging as is.
import {
  useCallback, useEffect, useRef, useState,
  useSyncExternalStore,
} from 'react';
import {
  BPM_DRAG_PX_PER_STEP, DRAG_THRESHOLD_PX,
} from './constants';

export type StepsVariant = '' | 'A' | 'B' | 'C';

const readVariant = (): StepsVariant => {
  const v = (new URLSearchParams(window.location.search)
    .get('mock') ?? '').toUpperCase();
  return (['A', 'B', 'C'].includes(v) ? v : '') as StepsVariant;
};

export function useStepsVariant(): StepsVariant {
  return useSyncExternalStore(() => () => {}, readVariant, () => '');
}

const MIN = 1;
const MAX = 64;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));

interface Props {
  variant: Exclude<StepsVariant, ''>;
  value: number;
  onChange: (n: number) => void;
}

/** Press-and-hold auto-repeat for the arrow keys. */
function useRepeat(fn: () => void) {
  const timer = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    fn();
    const tick = (delay: number) => {
      timer.current = window.setTimeout(() => {
        fn();
        tick(80);
      }, delay);
    };
    tick(400);
  }, [fn]);
  useEffect(() => stop, [stop]);
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

export default function StepsSpinner({ variant, value, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const drag = useRef<{
    id: number; y: number; start: number; dragging: boolean; mouse: boolean;
  } | null>(null);
  const ignoreFocus = useRef(false);

  const step = useCallback((d: number) => {
    onChange(clamp(valueRef.current + d));
  }, [onChange]);
  const up = useRepeat(useCallback(() => step(1), [step]));
  const down = useRepeat(useCallback(() => step(-1), [step]));

  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) onChange(clamp(n));
    setDraft(null);
  };

  const input = (
    <input
      id="global-steps"
      type="text"
      inputMode="numeric"
      aria-label="Steps"
      autoComplete="off"
      value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setDraft(null);
          step((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 4 : 1));
        }
      }}
      onPointerDown={e => {
        ignoreFocus.current = false;
        if (e.button !== 0) return;
        if (document.activeElement === e.currentTarget) return;
        const mouse = e.pointerType === 'mouse';
        if (mouse) e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { id: e.pointerId, y: e.clientY, start: value, dragging: false, mouse };
      }}
      onPointerMove={e => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dy = d.y - e.clientY;
        if (!d.dragging) {
          if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
          d.dragging = true;
        }
        const next = clamp(d.start + Math.trunc(dy / BPM_DRAG_PX_PER_STEP));
        if (next !== valueRef.current) onChange(next);
      }}
      onPointerUp={e => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        drag.current = null;
        if (d.dragging) ignoreFocus.current = !d.mouse;
        else if (d.mouse) {
          e.currentTarget.focus();
          e.currentTarget.select();
        }
      }}
      onPointerCancel={() => { drag.current = null; }}
      onFocus={e => {
        if (ignoreFocus.current) {
          ignoreFocus.current = false;
          e.currentTarget.blur();
        }
      }}
      className={
        'min-w-0 p-0 touch-none cursor-ns-resize focus:cursor-text bg-transparent '
        + 'text-right tabular-nums focus-visible:outline-none focus-visible:underline '
        + 'decoration-accent underline-offset-4 font-mono font-bold '
        + (variant === 'C'
          ? 'w-[2.4ch] text-base text-ink'
          : 'w-[2.4ch] text-lg text-lcd [text-shadow:0_0_10px_rgb(245_160_58/0.45)]')
      }
    />
  );

  const atMax = value >= MAX;
  const atMin = value <= MIN;
  const tri = (dir: 'up' | 'down', size = 7) => (
    <svg width={size + 3} height={size} viewBox="0 0 10 7" aria-hidden="true"
      className="fill-current">
      {dir === 'up'
        ? <path d="M5 0 L10 7 L0 7 Z" />
        : <path d="M0 0 L10 0 L5 7 Z" />}
    </svg>
  );
  const arrowCls = 'flex items-center justify-center text-muted hover:text-ink '
    + 'disabled:opacity-35 disabled:hover:text-muted touch-none select-none';

  if (variant === 'A') {
    // LCD well + one key split into ▲ over ▼.
    return (
      <div className="flex items-stretch h-9 gap-1">
        <div className="flex flex-1 items-center justify-end min-w-0 rounded-md bg-well border border-line pr-2 shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]">
          {input}
        </div>
        <div className="ss-key flex flex-col w-6 shrink-0 overflow-hidden">
          <button type="button" aria-label="More steps" disabled={atMax}
            {...up} className={`${arrowCls} flex-1`}>{tri('up', 6)}</button>
          <div className="h-px bg-edge" />
          <button type="button" aria-label="Fewer steps" disabled={atMin}
            {...down} className={`${arrowCls} flex-1`}>{tri('down', 6)}</button>
        </div>
      </div>
    );
  }

  if (variant === 'B') {
    // LCD well + two full-height square keys, ▼ then ▲.
    return (
      <div className="flex items-stretch h-9 gap-1">
        <div className="flex flex-1 items-center justify-end min-w-0 rounded-md bg-well border border-line pr-2 shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]">
          {input}
        </div>
        <button type="button" aria-label="Fewer steps" disabled={atMin}
          {...down} className={`ss-key ${arrowCls} w-7 shrink-0`}>{tri('down')}</button>
        <button type="button" aria-label="More steps" disabled={atMax}
          {...up} className={`ss-key ${arrowCls} w-7 shrink-0`}>{tri('up')}</button>
      </div>
    );
  }

  // C: one raised housing. Number on the key face (ink,
  // not LCD) with grip lines, a groove, and a rocker.
  return (
    <div className="ss-key flex items-stretch h-9 overflow-hidden">
      <div className="flex flex-1 items-center justify-end gap-1.5 min-w-0 pl-1.5 pr-2">
        <span aria-hidden="true" className="flex flex-col gap-[3px] mr-auto opacity-60">
          <span className="block w-2 h-px bg-faint" />
          <span className="block w-2 h-px bg-faint" />
          <span className="block w-2 h-px bg-faint" />
        </span>
        {input}
      </div>
      <div className="w-px bg-well shadow-[1px_0_0_rgb(255_255_255/0.05)]" />
      <div className="flex flex-col w-6 shrink-0">
        <button type="button" aria-label="More steps" disabled={atMax}
          {...up} className={`${arrowCls} flex-1`}>{tri('up', 6)}</button>
        <div className="h-px bg-well" />
        <button type="button" aria-label="Fewer steps" disabled={atMin}
          {...down} className={`${arrowCls} flex-1`}>{tri('down', 6)}</button>
      </div>
    </div>
  );
}
