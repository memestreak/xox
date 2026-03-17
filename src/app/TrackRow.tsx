"use client";

import {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import { TrackId } from './types';
import TrackToggle from './TrackToggle';
import StepButton from './StepButton';
import Knob from './Knob';

interface TrackRowProps {
  trackId: TrackId;
  trackName: string;
  steps: string;
  trackLength: number;
  patternLength: number;
  isMuted: boolean;
  isSolo: boolean;
  isFreeRun: boolean;
  gain: number;
  currentStep: number;
  totalSteps: number;
  onToggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onToggleMute: (trackId: TrackId) => void;
  onToggleSolo: (trackId: TrackId) => void;
  onSetGain: (
    trackId: TrackId, value: number
  ) => void;
  onSetTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  onToggleFreeRun: (trackId: TrackId) => void;
}

/**
 * Single track row: name, mute/solo, knob, and step
 * buttons with a draggable length handle. Steps beyond
 * the track's length are dimmed and non-interactive.
 * Each track computes its own effective running-light
 * position for polyrhythms. Clicking the track name
 * opens a popover with per-track settings.
 */
function TrackRowInner({
  trackId,
  trackName,
  steps,
  trackLength,
  patternLength,
  isMuted,
  isSolo,
  isFreeRun,
  gain,
  currentStep,
  totalSteps,
  onToggleStep,
  onToggleMute,
  onToggleSolo,
  onSetGain,
  onSetTrackLength,
  onToggleFreeRun,
}: TrackRowProps) {
  const handleMute = useCallback(
    () => onToggleMute(trackId),
    [onToggleMute, trackId]
  );
  const handleSolo = useCallback(
    () => onToggleSolo(trackId),
    [onToggleSolo, trackId]
  );
  const handleGain = useCallback(
    (v: number) => onSetGain(trackId, v),
    [onSetGain, trackId]
  );
  const handleFreeRun = useCallback(
    () => onToggleFreeRun(trackId),
    [onToggleFreeRun, trackId]
  );

  const effectiveStep =
    currentStep >= 0
      ? (isFreeRun ? totalSteps : currentStep)
        % trackLength
      : -1;

  // ─── Track name popover ───────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          e.target as Node
        ) &&
        nameRef.current &&
        !nameRef.current.contains(
          e.target as Node
        )
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener(
      'mousedown', handleClick
    );
    return () =>
      document.removeEventListener(
        'mousedown', handleClick
      );
  }, [menuOpen]);

  const trackNameButton = (
    size: 'sm' | 'lg'
  ) => (
    <div className="relative">
      <button
        ref={size === 'lg' ? nameRef : undefined}
        onClick={() => setMenuOpen(v => !v)}
        className={
          (size === 'sm'
            ? 'text-[10px]'
            : 'w-16 truncate text-xs text-left')
          + ' font-bold uppercase tracking-wider'
          + ' rounded px-1 py-0.5 transition-colors'
          + (isFreeRun
            ? ' text-orange-400 bg-orange-400/10'
            : ' text-neutral-400'
              + ' hover:text-neutral-200'
              + ' hover:bg-neutral-800/50')
        }
      >
        {trackName}
      </button>
      {menuOpen && size === 'lg' && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-1 w-36 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <button
            onClick={() => {
              handleFreeRun();
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center justify-between"
          >
            <span>Free-run</span>
            <span
              className={
                'inline-block w-2 h-2 rounded-full '
                + (isFreeRun
                  ? 'bg-orange-400'
                  : 'bg-neutral-600')
              }
            />
          </button>
        </div>
      )}
    </div>
  );

  // ─── Drag handle logic ──────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const lengthFromPointer = useCallback(
    (clientX: number): number => {
      const grid = gridRef.current;
      if (!grid) return trackLength;
      const rect = grid.getBoundingClientRect();
      const x = clientX - rect.left;
      const stepWidth = rect.width / patternLength;
      const raw = Math.round(x / stepWidth);
      return Math.max(
        1, Math.min(patternLength, raw)
      );
    },
    [patternLength, trackLength]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(
        e.pointerId
      );
      setIsDragging(true);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const len = lengthFromPointer(e.clientX);
      if (len !== trackLength) {
        onSetTrackLength(trackId, len);
      }
    },
    [isDragging, lengthFromPointer, trackLength,
      onSetTrackLength, trackId]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePct =
    (trackLength / 16) * 100;

  return (
    <div>
      {/* Mobile: track name + M/S above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        {trackNameButton('sm')}
        <div className="flex gap-1 ml-auto items-center">
          <TrackToggle
            variant="mute"
            active={isMuted}
            trackName={trackName}
            size="lg"
            onToggle={handleMute}
          />
          <TrackToggle
            variant="solo"
            active={isSolo}
            trackName={trackName}
            size="lg"
            onToggle={handleSolo}
          />
          <Knob
            value={gain}
            onChange={handleGain}
            trackName={trackName}
            size={20}
          />
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Desktop: sidebar */}
        <div className="hidden lg:flex w-48 items-center gap-2">
          {trackNameButton('lg')}
          <TrackToggle
            variant="mute"
            active={isMuted}
            trackName={trackName}
            size="md"
            onToggle={handleMute}
          />
          <TrackToggle
            variant="solo"
            active={isSolo}
            trackName={trackName}
            size="md"
            onToggle={handleSolo}
          />
          <Knob
            value={gain}
            onChange={handleGain}
            trackName={trackName}
          />
        </div>

        {/* Step grid with drag handle */}
        <div className="flex-1 relative">
          <div
            ref={gridRef}
            className="grid grid-cols-8 lg:grid-cols-16 gap-[3px] lg:gap-1.5"
          >
            {Array.from(
              { length: 16 },
              (_, i) => {
                const disabled =
                  i >= trackLength || i >= patternLength;
                return (
                  <StepButton
                    key={i}
                    trackName={trackName}
                    stepIndex={i}
                    isActive={
                      !disabled && steps[i] === '1'
                    }
                    isCurrent={
                      !disabled
                      && effectiveStep === i
                    }
                    isBeat={i % 4 === 0}
                    isDisabled={disabled}
                    onToggle={
                      () => onToggleStep(trackId, i)
                    }
                  />
                );
              }
            )}
          </div>

          {/* Draggable length handle */}
          <div
            role="slider"
            aria-label={`${trackName} length`}
            aria-valuemin={1}
            aria-valuemax={patternLength}
            aria-valuenow={trackLength}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              left: `${handlePct}%`,
              touchAction: 'none',
            }}
            className={
              'absolute top-0 h-full w-1.5'
              + ' -translate-x-1/2 cursor-col-resize'
              + ' rounded-full z-20'
              + (isDragging
                ? ' bg-neutral-300'
                : ' bg-neutral-500/60'
                  + ' hover:bg-neutral-300')
              + ' transition-colors'
            }
          />
        </div>
      </div>
    </div>
  );
}

const TrackRow = memo(TrackRowInner);
export default TrackRow;
