"use client";

import {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import {
  LongPressEventType, useLongPress,
} from 'use-long-press';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';
import TrackToggle from './TrackToggle';
import StepButton from './StepButton';
import Knob from './Knob';
import Tooltip from './Tooltip';

function formatPan(v: number): string {
  const pct = Math.round((v - 0.5) * 200);
  if (pct === 0) return 'C';
  return pct < 0 ? `L${-pct}` : `R${pct}`;
}

interface TrackNameButtonProps {
  size: 'sm' | 'lg';
  trackName: string;
  isFreeRun: boolean;
  isTriggered: boolean;
  onToggleFreeRun: () => void;
  onClearTrack: () => void;
  onPlayPreview: () => void;
}

/**
 * Track name button with optional popover menu.
 * The popover (with free-run toggle) only renders
 * at 'lg' size. Owns its own menu state and refs.
 */
function TrackNameButtonInner({
  size,
  trackName,
  isFreeRun,
  isTriggered,
  onToggleFreeRun,
  onClearTrack,
  onPlayPreview,
}: TrackNameButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current
        && !menuRef.current.contains(
          e.target as Node
        )
        && nameRef.current
        && !nameRef.current.contains(
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

  return (
    <div className="relative">
      <Tooltip tooltipKey="trackName">
        <button
          ref={size === 'lg' ? nameRef : undefined}
          onMouseDown={(e: React.MouseEvent) => {
            if (e.button !== 0) return;
            if (e.shiftKey) {
              onClearTrack();
              return;
            }
            if (e.metaKey || e.ctrlKey) {
              setMenuOpen(v => !v);
              return;
            }
            onPlayPreview();
          }}
          onTouchStart={() => onPlayPreview()}
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            setMenuOpen(v => !v);
          }}
          className={
            (size === 'sm'
              ? 'text-lg'
              : 'w-12 truncate text-xl text-left')
            + ' font-bold uppercase tracking-wider font-[family-name:var(--font-orbitron)]'
            + ' rounded px-1 py-0.5 transition-colors'
            + (isTriggered
              ? ' text-orange-300 bg-orange-400/25'
              : isFreeRun
                ? ' text-orange-400 bg-orange-400/10'
                : ' text-neutral-400'
                  + ' hover:text-neutral-200'
                  + ' hover:bg-neutral-800/50')
          }
        >
          {trackName}
        </button>
      </Tooltip>
      {menuOpen && size === 'lg' && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-1 w-36 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <button
            onClick={() => {
              onToggleFreeRun();
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
}

const TrackNameButton = memo(TrackNameButtonInner);

interface TrackRowProps {
  trackId: TrackId;
  trackName: string;
  steps: string;
  trackLength: number;
  patternLength: number;
  pageOffset: number;
  isMuted: boolean;
  isSolo: boolean;
  isFreeRun: boolean;
  gain: number;
  pan: number;
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
  onSetPan: (
    trackId: TrackId, value: number
  ) => void;
  onSetTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  onToggleFreeRun: (trackId: TrackId) => void;
  onClearTrack: (trackId: TrackId) => void;
  onPlayPreview: (trackId: TrackId) => void;
  isTriggered: boolean;
  trigConditions?: Record<number, StepConditions>;
  parameterLocks?: Record<number, StepLocks>;
  onOpenPopover?: (
    trackId: TrackId,
    stepIndex: number,
    rect: { top: number; left: number }
  ) => void;
  longPressActiveRef?: RefObject<boolean>;
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
  pageOffset,
  isMuted,
  isSolo,
  isFreeRun,
  gain,
  pan,
  currentStep,
  totalSteps,
  onToggleStep,
  onToggleMute,
  onToggleSolo,
  onSetGain,
  onSetPan,
  onSetTrackLength,
  onToggleFreeRun,
  onClearTrack,
  onPlayPreview,
  isTriggered,
  trigConditions,
  parameterLocks,
  onOpenPopover,
  longPressActiveRef,
}: TrackRowProps) {
  const handleMute = useCallback(
    () => onToggleMute(trackId),
    [onToggleMute, trackId]
  );
  const handleSolo = useCallback(
    () => onToggleSolo(trackId),
    [onToggleSolo, trackId]
  );
  const handlePan = useCallback(
    (v: number) => onSetPan(trackId, v),
    [onSetPan, trackId]
  );
  const handleGain = useCallback(
    (v: number) => onSetGain(trackId, v),
    [onSetGain, trackId]
  );
  const handleFreeRun = useCallback(
    () => onToggleFreeRun(trackId),
    [onToggleFreeRun, trackId]
  );
  const handleClearTrack = useCallback(
    () => onClearTrack(trackId),
    [onClearTrack, trackId]
  );
  const handlePlayPreview = useCallback(
    () => onPlayPreview(trackId),
    [onPlayPreview, trackId]
  );

  // ─── Drag handle state ─────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const endBarLongPress = useLongPress(
    () => {
      navigator.vibrate?.(10);
      handleFreeRun();
    },
    {
      detect: LongPressEventType.Touch,
      threshold: 500,
      cancelOnMovement: 1,
    }
  );

  const effectiveStep =
    currentStep >= 0
      ? (isFreeRun ? totalSteps : currentStep)
        % trackLength
      : -1;

  // ─── Drag handle logic ──────────────────────────
  const lengthFromPointer = useCallback(
    (clientX: number): number => {
      const grid = gridRef.current;
      if (!grid) return trackLength;
      const rect = grid.getBoundingClientRect();
      const x = clientX - rect.left;
      const stepWidth = rect.width / 16;
      const raw = Math.round(x / stepWidth);
      return Math.max(
        1,
        Math.min(
          patternLength, raw + pageOffset
        )
      );
    },
    [patternLength, trackLength, pageOffset]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleFreeRun();
        return;
      }
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(
        e.pointerId
      );
      setIsDragging(true);
    },
    [handleFreeRun]
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

  const handleOnPage =
    trackLength > pageOffset
    && trackLength <= pageOffset + 16;
  const handlePct = handleOnPage
    ? ((trackLength - pageOffset) / 16) * 100
    : 0;

  const handleToggleStep = useCallback(
    (tid: TrackId, localStep: number) =>
      onToggleStep(tid, localStep + pageOffset),
    [onToggleStep, pageOffset]
  );

  const handleOpenPopover = useCallback(
    (
      tid: TrackId,
      localStep: number,
      rect: { top: number; left: number }
    ) => onOpenPopover?.(
      tid, localStep + pageOffset, rect
    ),
    [onOpenPopover, pageOffset]
  );

  return (
    <div>
      {/* Mobile: track name + M/S above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <TrackNameButton
          size="sm"
          trackName={trackName}
          isFreeRun={isFreeRun}
          isTriggered={isTriggered}
          onToggleFreeRun={handleFreeRun}
          onClearTrack={handleClearTrack}
          onPlayPreview={handlePlayPreview}
        />
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
          <Tooltip tooltipKey="pan">
            <Knob
              value={pan}
              onChange={handlePan}
              trackName={trackName}
              size={20}
              defaultValue={0.5}
              ariaPrefix="Pan"
              formatValue={formatPan}
            />
          </Tooltip>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Desktop: sidebar */}
        <div className="hidden lg:flex w-56 items-center gap-2">
          <TrackNameButton
            size="lg"
            trackName={trackName}
            isFreeRun={isFreeRun}
            isTriggered={isTriggered}
            onToggleFreeRun={handleFreeRun}
            onClearTrack={handleClearTrack}
            onPlayPreview={handlePlayPreview}
          />
          <div className="flex gap-1">
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
          </div>
          <div className="flex gap-1 ml-1">
            <Knob
              value={gain}
              onChange={handleGain}
              trackName={trackName}
            />
            <Tooltip tooltipKey="pan">
              <Knob
                value={pan}
                onChange={handlePan}
                trackName={trackName}
                defaultValue={0.5}
                ariaPrefix="Pan"
                formatValue={formatPan}
              />
            </Tooltip>
          </div>
        </div>

        {/* Step grid with drag handle */}
        <div className="flex-1 relative">
          <div
            ref={gridRef}
            data-track={trackId}
            className="grid grid-cols-8 lg:grid-cols-16 gap-[3px] lg:gap-1.5"
          >
            {Array.from(
              { length: 16 },
              (_, i) => {
                const globalIdx = pageOffset + i;
                const disabled =
                  globalIdx >= trackLength
                  || globalIdx >= patternLength;
                return (
                  <StepButton
                    key={i}
                    trackId={trackId}
                    trackName={trackName}
                    stepIndex={i}
                    isActive={
                      !disabled
                      && steps[globalIdx] === '1'
                    }
                    isCurrent={
                      !disabled
                      && effectiveStep === globalIdx
                    }
                    isBeat={globalIdx % 4 === 0}
                    isDisabled={disabled}
                    onToggle={handleToggleStep}
                    conditions={
                      trigConditions?.[globalIdx]
                    }
                    gainLock={
                      parameterLocks?.[globalIdx]
                        ?.gain
                    }
                    onOpenPopover={handleOpenPopover}
                    longPressActiveRef={
                      longPressActiveRef
                    }
                  />
                );
              }
            )}
          </div>

          {/* Draggable length handle */}
          {handleOnPage && (
            <Tooltip tooltipKey="lengthHandle" align="right">
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
              {...endBarLongPress()}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!isDragging) handleFreeRun();
              }}
              style={{
                left: `${handlePct}%`,
                touchAction: 'none',
              }}
              className={
                'absolute top-0 h-full w-4'
                + ' -translate-x-1/2 z-20'
                + (isDragging
                  ? ' cursor-col-resize'
                  : ' cursor-default')
                + ' before:absolute before:inset-y-0'
                + ' before:left-1/2'
                + ' before:-translate-x-1/2'
                + ' before:w-1.5 before:rounded-full'
                + ' before:transition-colors'
                + (isDragging
                  ? ' before:bg-neutral-300'
                  : ' before:bg-neutral-500/60'
                    + ' hover:before:bg-neutral-300')
              }
              />
            </Tooltip>
          )}

          {/* Free-run indicator */}
          {isFreeRun && handleOnPage && (
            <span
              aria-label="free run"
              style={{
                left: `${handlePct}%`,
                fontFamily: 'var(--font-orbitron)',
              }}
              className={
                'absolute top-1/2 -translate-x-1/2'
                + ' -translate-y-1/2 z-30'
                + ' pointer-events-none select-none'
                + ' flex items-center'
                + ' justify-center'
                + ' w-3.5 h-3.5 rounded-full'
                + ' bg-orange-500'
                + ' text-[10px] font-bold'
                + ' text-white'
                + ' shadow-[0_0_6px_rgba(251,146,60,0.6)]'
              }
            >
              F
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const TrackRow = memo(TrackRowInner);
export default TrackRow;
