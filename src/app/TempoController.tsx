"use client";

import { useCallback, useEffect, useRef } from 'react';

export const MIN_BPM = 20;
export const MAX_BPM = 300;

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
    <div className="relative flex items-center">
      <label htmlFor="bpm-input" className="sr-only">BPM</label>
      <input
        id="bpm-input"
        name="bpm"
        type="number"
        inputMode="numeric"
        autoComplete="off"
        value={bpm}
        min={MIN_BPM}
        max={MAX_BPM}
        onChange={(e) => setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, Number(e.target.value) || MIN_BPM)))}
        className="bg-neutral-900 border border-neutral-800 rounded pl-2 pr-10 py-1 w-28 text-orange-500 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:border-orange-500 transition-colors"
      />
      <button
        ref={tapBtnRef}
        type="button"
        aria-label="Tap tempo"
        onMouseDown={() => { handleTap(); flashTap(); }}
        onTouchStart={() => { handleTap(); flashTap(); }}
        onClick={(e) => e.preventDefault()}
        className="group/tap absolute inset-y-0 right-0 px-2 flex items-center text-[10px] uppercase tracking-widest font-bold cursor-pointer transition-colors"
      >
        <span className="text-neutral-500 group-hover/tap:hidden">BPM</span>
        <span className="text-neutral-400 hidden group-hover/tap:inline">TAP</span>
      </button>
    </div>
  );
}
