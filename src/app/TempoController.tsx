"use client";

import { useCallback, useRef } from 'react';
import Tooltip from './Tooltip';
import { BPM_MIN, BPM_MAX } from './constants';

export const MIN_BPM = BPM_MIN;
export const MAX_BPM = BPM_MAX;

interface TempoControllerProps {
  bpm: number;
  setBpm: (bpm: number) => void;
}

export default function TempoController({ bpm, setBpm }: TempoControllerProps) {
  const tapBufferRef = useRef<number[]>([]);
  const tapBtnRef = useRef<HTMLButtonElement>(null);

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
      <input
        id="bpm-input"
        name="bpm"
        type="number"
        inputMode="numeric"
        aria-label="BPM"
        autoComplete="off"
        value={bpm}
        min={MIN_BPM}
        max={MAX_BPM}
        onChange={(e) => setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, Number(e.target.value) || MIN_BPM)))}
        className="w-12 lg:w-16 bg-transparent text-right font-mono font-bold text-lg lg:text-2xl text-lcd [text-shadow:0_0_10px_rgb(245_160_58/0.45)] tabular-nums focus-visible:outline-none focus-visible:underline decoration-accent underline-offset-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="ss-label text-[10px] mx-1.5 lg:mx-2" aria-hidden="true">
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
