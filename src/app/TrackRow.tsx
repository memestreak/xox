"use client";

import { memo, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';
import { computeEffectiveStep } from './trackUtils';
import TrackNameButton from './TrackNameButton';
import TrackMixer from './TrackMixer';
import TrackEndBar from './TrackEndBar';
import StepButton from './StepButton';

export interface TrackRowProps {
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
  selectedSteps?: Set<number>;
  onCtrlClick?: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onShiftClick?: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onPlainClick?: () => boolean;
  onClearSelection?: () => void;
  /** Draw as a thin row: caret, name, step line. */
  isMinimized?: boolean;
  /** Restores a minimized row (caret or line click). */
  onRestore?: (trackId: TrackId) => void;
  /**
   * The next row is minimized too: pull it closer
   * (a margin, not a border, so nothing reflows).
   */
  tightBelow?: boolean;
}

interface MinimizedTrackRowProps {
  trackName: string;
  trackLength: number;
  patternLength: number;
  pageOffset: number;
  isTriggered: boolean;
  tightBelow: boolean;
  onRestore: () => void;
  onPlayPreview: () => void;
}

/**
 * A minimized (empty) track: a caret and the name, then
 * a thin line under the step columns. The caret or the
 * line restores the row; the name plays the sound.
 */
function MinimizedTrackRow({
  trackName,
  trackLength,
  patternLength,
  pageOffset,
  isTriggered,
  tightBelow,
  onRestore,
  onPlayPreview,
}: MinimizedTrackRowProps) {
  return (
    <div
      data-minimized={trackName}
      className={
        'flex gap-2 lg:gap-4 items-center'
        + (tightBelow ? ' mb-1 lg:mb-0.5' : '')
      }
    >
      <div className="relative flex items-center gap-1 lg:gap-2 w-[76px] lg:w-56 shrink-0">
        <button
          type="button"
          aria-label={`Restore ${trackName}`}
          aria-expanded={false}
          onClick={onRestore}
          className="w-5 h-6 lg:h-4 shrink-0 flex items-center justify-center rounded text-muted hover:text-ink hover:bg-raised lg:absolute lg:-left-6 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
          >
            <path
              d="M3 1.5 L7 5 L3 8.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onPointerDown={e => {
            if (e.button === 0) onPlayPreview();
          }}
          onClick={e => {
            // Keyboard activation (no pointer press)
            if (e.detail === 0) onPlayPreview();
          }}
          className={
            'lg:w-14 px-1 text-left font-display font-bold'
            + ' uppercase tracking-[0.08em]'
            // Same size as a full row's name
            + ' text-xl lg:text-[22px]'
            + ' leading-none rounded transition-colors'
            + ' focus-visible:outline-2'
            + ' focus-visible:outline-accent'
            + (isTriggered
              ? ' text-lcd'
              : ' text-ink hover:bg-raised')
          }
        >
          {trackName}
        </button>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onRestore}
        className="flex-1 py-1 cursor-pointer"
      >
        <span className="grid grid-cols-16 gap-[3px] lg:gap-1.5 h-2 items-center">
          {Array.from({ length: 16 }, (_, i) => {
            const globalIdx = pageOffset + i;
            const inTrack =
              globalIdx < trackLength
              && globalIdx < patternLength;
            return (
              <span
                key={i}
                className={
                  'h-1 rounded-full '
                  + (inTrack ? 'bg-edge' : 'bg-well')
                }
              />
            );
          })}
        </span>
      </button>
    </div>
  );
}

/**
 * Single track row: name, mute/solo, knobs, and step
 * buttons with a draggable length handle.
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
  selectedSteps,
  onCtrlClick,
  onShiftClick,
  onPlainClick,
  onClearSelection,
  isMinimized = false,
  onRestore,
  tightBelow = false,
}: TrackRowProps) {
  const stepGridRef = useRef<HTMLDivElement>(null);
  // ─── Bound callbacks ──────────────────────────
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
  const handleSetLength = useCallback(
    (len: number) => onSetTrackLength(trackId, len),
    [onSetTrackLength, trackId]
  );

  const effectiveStep = computeEffectiveStep(
    currentStep, totalSteps, isFreeRun, trackLength
  );

  // ─── Page-offset wrappers ─────────────────────
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

  const handleCtrlClick = useCallback(
    (tid: TrackId, localStep: number) =>
      onCtrlClick?.(tid, localStep + pageOffset),
    [onCtrlClick, pageOffset]
  );

  const handleShiftClick = useCallback(
    (tid: TrackId, localStep: number) =>
      onShiftClick?.(tid, localStep + pageOffset),
    [onShiftClick, pageOffset]
  );

  const handleRestore = useCallback(
    () => onRestore?.(trackId),
    [onRestore, trackId]
  );

  if (isMinimized) {
    return (
      <MinimizedTrackRow
        trackName={trackName}
        trackLength={trackLength}
        patternLength={patternLength}
        pageOffset={pageOffset}
        isTriggered={isTriggered}
        tightBelow={tightBelow}
        onRestore={handleRestore}
        onPlayPreview={handlePlayPreview}
      />
    );
  }

  return (
    <div data-row-track={trackId}>
      {/* Mobile: track name + M/S above grid */}
      <div className="flex items-center gap-2 mb-1.5 lg:hidden">
        <TrackNameButton
          size="sm"
          trackId={trackId}
          trackName={trackName}
          isFreeRun={isFreeRun}
          isTriggered={isTriggered}
          onToggleFreeRun={handleFreeRun}
          onClearTrack={handleClearTrack}
          onPlayPreview={handlePlayPreview}
        />
        <div className="flex gap-1 ml-auto items-center">
          <TrackMixer
            trackName={trackName}
            isMuted={isMuted}
            isSolo={isSolo}
            gain={gain}
            pan={pan}
            size="sm"
            onToggleMute={handleMute}
            onToggleSolo={handleSolo}
            onSetGain={handleGain}
            onSetPan={handlePan}
          />
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Desktop: sidebar */}
        <div className="hidden lg:flex w-56 items-center gap-2">
          <TrackNameButton
            size="lg"
            trackId={trackId}
            trackName={trackName}
            isFreeRun={isFreeRun}
            isTriggered={isTriggered}
            onToggleFreeRun={handleFreeRun}
            onClearTrack={handleClearTrack}
            onPlayPreview={handlePlayPreview}
          />
          <TrackMixer
            trackName={trackName}
            isMuted={isMuted}
            isSolo={isSolo}
            gain={gain}
            pan={pan}
            size="lg"
            onToggleMute={handleMute}
            onToggleSolo={handleSolo}
            onSetGain={handleGain}
            onSetPan={handlePan}
          />
        </div>

        {/* Step grid with drag handle */}
        <div className="flex-1 relative">
          <div
            ref={stepGridRef}
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
                    isDisabled={disabled}
                    onToggle={handleToggleStep}
                    isSelected={
                      selectedSteps?.has(globalIdx)
                      ?? false
                    }
                    conditions={
                      trigConditions?.[globalIdx]
                    }
                    locks={
                      parameterLocks?.[globalIdx]
                    }
                    onOpenPopover={handleOpenPopover}
                    onCtrlClick={handleCtrlClick}
                    onShiftClick={handleShiftClick}
                    onPlainClick={onPlainClick}
                    onClearSelection={
                      onClearSelection
                    }
                    longPressActiveRef={
                      longPressActiveRef
                    }
                  />
                );
              }
            )}
          </div>

          <TrackEndBar
            trackName={trackName}
            trackLength={trackLength}
            patternLength={patternLength}
            pageOffset={pageOffset}
            isFreeRun={isFreeRun}
            gridRef={stepGridRef}
            onSetTrackLength={handleSetLength}
            onToggleFreeRun={handleFreeRun}
          />
        </div>
      </div>
    </div>
  );
}

const TrackRow = memo(TrackRowInner);
export default TrackRow;
