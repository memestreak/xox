"use client";

import { useCallback, useRef, useState } from 'react';
import Tooltip from './Tooltip';
import {
  BPM_MIN, BPM_MAX, BPM_DRAG_PX_PER_STEP, BPM_DRAG_STEP,
  BPM_DRAG_FINE_STEP, DRAG_THRESHOLD_PX,
} from './constants';

export const MIN_BPM = BPM_MIN;
export const MAX_BPM = BPM_MAX;

/**
 * Tempo after dragging `dy` px up (negative = down) from
 * `startBpm`: one step per BPM_DRAG_PX_PER_STEP px, 1 BPM
 * per step, or 0.1 BPM when `fine`. Clamped, rounded to
 * one decimal so float error never shows in the field.
 */
export function bpmAfterDrag(
  startBpm: number, dy: number, fine: boolean,
): number {
  const steps = Math.trunc(dy / BPM_DRAG_PX_PER_STEP);
  const step = fine ? BPM_DRAG_FINE_STEP : BPM_DRAG_STEP;
  const raw = startBpm + steps * step;
  const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, raw));
  return Math.round(clamped * 10) / 10;
}

/** An in-progress press on the BPM field. */
interface BpmDrag {
  pointerId: number;
  isMouse: boolean;
  /** Past the threshold: the press is a drag, not a click. */
  dragging: boolean;
  /** Y and tempo to measure from; reset when Shift changes. */
  anchorY: number;
  anchorBpm: number;
  fine: boolean;
  lastBpm: number;
}

interface TempoControllerProps {
  bpm: number;
  setBpm: (bpm: number) => void;
}

export default function TempoController({ bpm, setBpm }: TempoControllerProps) {
  const tapBufferRef = useRef<number[]>([]);
  const tapBtnRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<BpmDrag | null>(null);
  // Text being typed. A value in range applies as you
  // type; anything else waits for blur/Enter, so typing
  // "98" doesn't clamp the "9" to 20 on the way.
  const [draft, setDraft] = useState<string | null>(null);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setDraft(text);
      const n = Number(text);
      if (text !== '' && n >= MIN_BPM && n <= MAX_BPM) setBpm(n);
    },
    [setBpm]
  );

  const commitDraft = useCallback(() => {
    if (draft === null) return;
    const n = Number(draft);
    // Empty or unparseable text reverts to the tempo.
    if (draft !== '' && Number.isFinite(n)) {
      setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, n)));
    }
    setDraft(null);
  }, [draft, setBpm]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
    },
    []
  );
  // A touch drag can still end in a click that focuses
  // the field (and opens the keyboard); drop that focus.
  const ignoreFocusRef = useRef(false);

  // Vertical drag on the field changes the tempo. A
  // press that doesn't move is a click: the field gets
  // focus for typing. While the field is focused, the
  // pointer edits text as usual.
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      ignoreFocusRef.current = false;
      if (e.button !== 0) return;
      if (document.activeElement === e.currentTarget) return;
      const isMouse = e.pointerType === 'mouse';
      // Mouse: hold off focus and text selection until we
      // know this is a click. Touch focuses on its own
      // click, which a drag doesn't produce.
      if (isMouse) e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        isMouse,
        dragging: false,
        anchorY: e.clientY,
        anchorBpm: bpm,
        fine: e.shiftKey,
        lastBpm: bpm,
      };
    },
    [bpm]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      if (!d.dragging) {
        if (Math.abs(d.anchorY - e.clientY) < DRAG_THRESHOLD_PX) {
          return;
        }
        d.dragging = true;
      }
      if (e.shiftKey !== d.fine) {
        // Switching coarse/fine mid-drag: measure from here
        // so the value doesn't jump.
        d.anchorY = e.clientY;
        d.anchorBpm = d.lastBpm;
        d.fine = e.shiftKey;
      }
      const next = bpmAfterDrag(
        d.anchorBpm, d.anchorY - e.clientY, d.fine
      );
      if (next !== d.lastBpm) {
        d.lastBpm = next;
        setBpm(next);
      }
    },
    [setBpm]
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
    },
    []
  );

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (ignoreFocusRef.current) {
        ignoreFocusRef.current = false;
        e.currentTarget.blur();
      }
    },
    []
  );

  const handleTap = useCallback(() => {
    const now = performance.now();
    const buffer = tapBufferRef.current;

    if (buffer.length > 0 && now - buffer[buffer.length - 1] > 2000) {
      tapBufferRef.current = [];
    }

    tapBufferRef.current.push(now);
    if (tapBufferRef.current.length > 4) {
      tapBufferRef.current = tapBufferRef.current.slice(-4);
    }

    const buf = tapBufferRef.current;
    if (buf.length >= 2) {
      let sum = 0;
      for (let i = 1; i < buf.length; i++) {
        sum += buf[i] - buf[i - 1];
      }
      const avgInterval = sum / (buf.length - 1);
      const raw = 60000 / avgInterval;
      const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, raw));
      const rounded = Math.round(clamped * 2) / 2;
      setBpm(rounded);
    }

  }, [setBpm]);

  const flashTap = useCallback(() => {
    const btn = tapBtnRef.current;
    if (!btn) return;
    btn.classList.remove('tap-flash');
    void btn.offsetWidth;
    btn.classList.add('tap-flash');
  }, []);

  return (
    <div className="flex items-center h-10 lg:h-11 rounded-lg bg-well border border-line pl-2.5 lg:pl-3.5 pr-1 shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]">
      <label htmlFor="bpm-input" className="sr-only">BPM</label>
      <Tooltip tooltipKey="bpm" position="bottom">
        <input
          id="bpm-input"
          name="bpm"
          type="number"
          inputMode="numeric"
          aria-label="BPM"
          autoComplete="off"
          value={draft ?? bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          onChange={onChange}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onFocus={onFocus}
          className="w-[5ch] p-0 touch-none cursor-ns-resize focus:cursor-text bg-transparent text-right font-mono font-bold text-lg lg:text-2xl text-lcd [text-shadow:0_0_10px_rgb(245_160_58/0.45)] tabular-nums focus-visible:outline-none focus-visible:underline decoration-accent underline-offset-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </Tooltip>
      {/* Hidden on phones to make room for the split
          Fill key; the field's label still says BPM. */}
      <span className="ss-label text-[10px] mx-1 lg:mx-2 max-sm:hidden" aria-hidden="true">
        BPM
      </span>
      <Tooltip tooltipKey="tap" position="bottom">
        <button
          ref={tapBtnRef}
          type="button"
          aria-label="Tap tempo"
          onMouseDown={() => { handleTap(); flashTap(); }}
          onTouchStart={() => { handleTap(); flashTap(); }}
          onClick={(e) => e.preventDefault()}
          className="ss-key ss-cap h-8 lg:h-[34px] px-2 lg:px-2.5 text-[11px] lg:text-xs text-muted hover:text-ink"
        >
          Tap
        </button>
      </Tooltip>
    </div>
  );
}
