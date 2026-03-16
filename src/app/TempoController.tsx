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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyT') return;
      if (event.repeat) return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      handleTap();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-1 lg:flex-col lg:items-stretch">
        <label htmlFor="bpm-input" className="text-[10px] uppercase tracking-widest text-neutral-500 lg:mb-1 font-bold">BPM</label>
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
          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-14 lg:w-20 text-orange-500 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:border-orange-500 transition-colors"
        />
      </div>
      <button
        type="button"
        aria-label="Tap tempo"
        onClick={handleTap}
        className="self-end bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 active:text-orange-500 active:border-orange-500 transition-colors min-w-[32px] min-h-[32px]"
      >
        Tap
      </button>
    </div>
  );
}
