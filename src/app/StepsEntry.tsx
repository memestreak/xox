"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip';
import {
  DRAG_THRESHOLD_PX, MAX_PATTERN_LENGTH,
  STEPS_DRAG_PX_PER_STEP, STEPS_REPEAT_DELAY_MS,
  STEPS_REPEAT_INTERVAL_MS, STEPS_SHIFT_STEP,
} from './constants';
import { isResizeOf } from './patternUtils';
import type { TrackConfig, TrackId } from './types';

type Tracks = Record<TrackId, TrackConfig>;

const MIN_STEPS = 1;
const clampSteps = (n: number) =>
  Math.max(MIN_STEPS, Math.min(MAX_PATTERN_LENGTH, n));

/**
 * Length after dragging `dy` px up (negative = down)
 * from `start`: one step per STEPS_DRAG_PX_PER_STEP px.
 */
export function stepsAfterDrag(start: number, dy: number): number {
  return clampSteps(start + Math.trunc(dy / STEPS_DRAG_PX_PER_STEP));
}

interface StepsEntryProps {
  value: number;
  tracks: Tracks;
  /** `base`: the tracks when the current gesture began. */
  setPatternLength: (length: number, base?: Tracks) => void;
}

/** An in-progress press on the number field. */
interface FieldDrag {
  pointerId: number;
  isMouse: boolean;
  /** Past the threshold: the press is a drag, not a click. */
  dragging: boolean;
  startY: number;
  startValue: number;
}

/**
 * Pattern length entry: an LCD readout with a split
 * ▲/▼ key. Drag the number up/down, press or hold an
 * arrow, use ↑/↓ while focused (Shift = one beat), or
 * click and type.
 *
 * Shortening cuts steps off, so each gesture (a drag,
 * an arrow hold, or a stay in the field) measures from
 * the tracks as they were when it began: going down
 * and back up within it restores the steps.
 */
export default function StepsEntry({
  value, tracks, setPatternLength,
}: StepsEntryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Text being typed; null shows `value`.
  const [draft, setDraft] = useState<string | null>(null);

  // Latest props, for handlers and timers.
  const valueRef = useRef(value);
  const tracksRef = useRef(tracks);
  useEffect(() => { valueRef.current = value; }, [value]);

  // Tracks when the current gesture began.
  const baseRef = useRef<Tracks | null>(null);
  useEffect(() => {
    tracksRef.current = tracks;
    // Something else changed the steps mid-gesture
    // (a grid edit, a queued pattern): measure from now.
    const base = baseRef.current;
    if (base && !isResizeOf(tracks, base)) baseRef.current = tracks;
  }, [tracks]);

  const isFocused = () => document.activeElement === inputRef.current;

  // A focused field keeps its own gesture (focus to blur).
  const beginGesture = useCallback(() => {
    if (!isFocused()) baseRef.current = tracksRef.current;
  }, []);
  const endGesture = useCallback(() => {
    if (!isFocused()) baseRef.current = null;
  }, []);

  /** Apply a length; false if it was already that. */
  const apply = useCallback((n: number) => {
    const next = clampSteps(n);
    if (next === valueRef.current) return false;
    valueRef.current = next;
    setPatternLength(next, baseRef.current ?? undefined);
    return true;
  }, [setPatternLength]);

  // ── Arrow keys: press steps once, hold repeats ──────
  const repeatRef = useRef<number | null>(null);
  const stopRepeat = useCallback(() => {
    if (repeatRef.current !== null) clearTimeout(repeatRef.current);
    repeatRef.current = null;
    endGesture();
  }, [endGesture]);
  useEffect(() => stopRepeat, [stopRepeat]);

  const startRepeat = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, delta: number) => {
      if (e.button !== 0) return;
      // Keep focus where it is (the field, if typing).
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      stopRepeat();
      beginGesture();
      setDraft(null);
      if (!apply(valueRef.current + delta)) return;
      const tick = (delay: number) => {
        repeatRef.current = window.setTimeout(() => {
          // Stop at the end of the range: a key that
          // turns disabled may never get its pointerup.
          if (apply(valueRef.current + delta)) {
            tick(STEPS_REPEAT_INTERVAL_MS);
          } else {
            stopRepeat();
          }
        }, delay);
      };
      tick(STEPS_REPEAT_DELAY_MS);
    },
    [apply, beginGesture, stopRepeat]
  );

  // ── The number field ────────────────────────────────
  const dragRef = useRef<FieldDrag | null>(null);
  // A touch drag can still end in a click that focuses
  // the field (and opens the keyboard); drop that focus.
  const ignoreFocusRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      ignoreFocusRef.current = false;
      if (e.button !== 0) return;
      // While focused, the pointer edits text as usual.
      if (isFocused()) return;
      const isMouse = e.pointerType === 'mouse';
      // Mouse: hold off focus and text selection until
      // we know this is a click.
      if (isMouse) e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      beginGesture();
      dragRef.current = {
        pointerId: e.pointerId,
        isMouse,
        dragging: false,
        startY: e.clientY,
        startValue: valueRef.current,
      };
    },
    [beginGesture]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dy = d.startY - e.clientY;
      if (!d.dragging) {
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        d.dragging = true;
      }
      apply(stepsAfterDrag(d.startValue, dy));
    },
    [apply]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      if (d.dragging) {
        ignoreFocusRef.current = !d.isMouse;
      } else if (d.isMouse) {
        e.currentTarget.focus();
        e.currentTarget.select();
      }
      endGesture();
    },
    [endGesture]
  );

  const cancelDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    endGesture();
  }, [endGesture]);

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (ignoreFocusRef.current) {
        ignoreFocusRef.current = false;
        e.currentTarget.blur();
        return;
      }
      baseRef.current = tracksRef.current;
    },
    []
  );

  // A length in range applies as you type; anything
  // else waits for Enter/blur. The focus gesture keeps
  // "3" on the way to "32" from losing steps.
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value.replace(/\D/g, '').slice(0, 2);
      setDraft(text);
      const n = Number(text);
      if (text !== '' && n >= MIN_STEPS && n <= MAX_PATTERN_LENGTH) {
        apply(n);
      }
    },
    [apply]
  );

  const onBlur = useCallback(() => {
    if (draft !== null && draft !== '') apply(Number(draft));
    setDraft(null);
    baseRef.current = null;
  }, [apply, draft]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const big = e.shiftKey ? STEPS_SHIFT_STEP : 1;
      let next: number | null = null;
      if (e.key === 'ArrowUp') next = valueRef.current + big;
      else if (e.key === 'ArrowDown') next = valueRef.current - big;
      else if (e.key === 'Home') next = MIN_STEPS;
      else if (e.key === 'End') next = MAX_PATTERN_LENGTH;
      else if (e.key === 'Enter') e.currentTarget.blur();
      if (next === null) return;
      e.preventDefault();
      setDraft(null);
      apply(next);
    },
    [apply]
  );

  const atMax = value >= MAX_PATTERN_LENGTH;
  const atMin = value <= MIN_STEPS;
  const arrowClass =
    'flex flex-1 items-center justify-center text-muted'
    + ' hover:text-ink disabled:opacity-35'
    + ' disabled:hover:text-muted touch-none select-none';

  return (
    <Tooltip tooltipKey="steps" position="bottom">
      <div className="flex items-stretch h-9 gap-1">
        <div className="flex flex-1 items-center justify-end min-w-0 rounded-md bg-well border border-line pr-2 shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]">
          <input
            ref={inputRef}
            id="global-steps"
            type="text"
            inputMode="numeric"
            role="spinbutton"
            aria-label="Steps"
            aria-valuenow={value}
            aria-valuemin={MIN_STEPS}
            aria-valuemax={MAX_PATTERN_LENGTH}
            autoComplete="off"
            value={draft ?? String(value)}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            className="w-[2.4ch] min-w-0 p-0 touch-none cursor-ns-resize focus:cursor-text bg-transparent text-right font-mono font-bold text-lg text-lcd [text-shadow:0_0_10px_rgb(245_160_58/0.45)] tabular-nums focus-visible:outline-none focus-visible:underline decoration-accent underline-offset-4"
          />
        </div>
        {/* One key split in two. Out of the tab order:
            the field takes ↑/↓ itself. */}
        <div className="ss-key flex flex-col w-6 shrink-0 overflow-hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="More steps"
            disabled={atMax}
            onPointerDown={e => startRepeat(e, 1)}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onLostPointerCapture={stopRepeat}
            className={arrowClass}
          >
            <Triangle up />
          </button>
          <div className="h-px bg-edge" aria-hidden="true" />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Fewer steps"
            disabled={atMin}
            onPointerDown={e => startRepeat(e, -1)}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onLostPointerCapture={stopRepeat}
            className={arrowClass}
          >
            <Triangle />
          </button>
        </div>
      </div>
    </Tooltip>
  );
}

function Triangle({ up = false }: { up?: boolean }) {
  return (
    <svg
      width="9" height="6" viewBox="0 0 10 7"
      aria-hidden="true" className="fill-current"
    >
      <path d={up ? 'M5 0 L10 7 L0 7 Z' : 'M0 0 L10 0 L5 7 Z'} />
    </svg>
  );
}
