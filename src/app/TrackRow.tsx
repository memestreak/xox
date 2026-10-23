"use client";

import { memo, useCallback, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
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
  // MOCK ONLY (collapse-empty variants)
  mockLook?: 'full' | 'slim' | 'folded';
  onFold?: () => void;
  nameSlot?: ReactNode;
  spare?: boolean;
  tightBelow?: boolean;
}

/** MOCK: fold chevron for variant B. */
function FoldChevron(
  { folded, onClick, trackName, className = '' }:
  { folded: boolean; onClick: () => void; trackName: string; className?: string }
) {
  return (
    <button
      type="button"
      aria-label={(folded ? 'Unfold ' : 'Fold ') + trackName}
      aria-expanded={!folded}
      onClick={onClick}
      className={'w-5 h-6 shrink-0 flex items-center justify-center rounded text-muted hover:text-ink hover:bg-raised ' + className}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
        className={'transition-transform ' + (folded ? '-rotate-90' : '')}>
        <path d="M1.5 3 L5 7 L8.5 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** MOCK: thin groove showing where a folded track's steps are. */
function StepGroove(
  { steps, pageOffset }: { steps: string; pageOffset: number }
) {
  return (
    <div className="grid grid-cols-16 gap-[3px] lg:gap-1.5 h-2 items-center">
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          className={
            'h-1 rounded-full '
            + (steps[pageOffset + i] === '1' ? 'bg-accent' : 'bg-edge')
          }
        />
      ))}
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
  mockLook = 'full',
  onFold,
  nameSlot,
  spare,
  tightBelow,
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

  // ─── MOCK B: folded row ───────────────────────
  if (mockLook === 'folded') {
    return (
      <div className={'flex gap-2 lg:gap-4 items-center' + (tightBelow ? ' mb-1! lg:mb-0.5!' : '')}>
        <div className="relative flex items-center gap-1 lg:gap-2 w-[76px] lg:w-56 shrink-0">
          <FoldChevron folded trackName={trackName} onClick={onFold!} className="lg:absolute lg:-left-6" />
          <button
            type="button"
            onClick={onFold}
            className="font-display font-bold uppercase tracking-[0.08em] text-[15px] leading-none text-muted hover:text-ink px-1"
          >
            {trackName}
          </button>
        </div>
        <button
          type="button"
          aria-label={'Unfold ' + trackName}
          onClick={onFold}
          className="flex-1 py-1"
        >
          <StepGroove steps={steps} pageOffset={pageOffset} />
        </button>
      </div>
    );
  }

  // ─── MOCK C: slim row (empty track) ───────────
  if (mockLook === 'slim') {
    return (
      <div className="flex gap-2 lg:gap-4 items-center">
        <div className="flex items-center w-14 lg:w-56 shrink-0 opacity-70">
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
        </div>
        <div
          ref={stepGridRef}
          data-track={trackId}
          className="flex-1 grid grid-cols-16 gap-[2px] lg:gap-1.5"
        >
          {Array.from({ length: 16 }, (_, i) => {
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
                isActive={false}
                isCurrent={!disabled && effectiveStep === globalIdx}
                isDisabled={disabled}
                mini
                onToggle={handleToggleStep}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const nameButton = (size: 'sm' | 'lg') => nameSlot ?? (
    <>
      {onFold && (
        <FoldChevron folded={false} trackName={trackName} onClick={onFold} className={size === 'lg' ? 'absolute -left-6' : ''} />
      )}
      <TrackNameButton
        size={size}
        trackId={trackId}
        trackName={trackName}
        isFreeRun={isFreeRun}
        isTriggered={isTriggered}
        onToggleFreeRun={handleFreeRun}
        onClearTrack={handleClearTrack}
        onPlayPreview={handlePlayPreview}
      />
    </>
  );

  return (
    <div className={spare ? 'rounded-lg outline-1 outline-dashed outline-edge -mx-1 lg:-mx-2 px-1 lg:px-2 py-1.5 lg:py-2' : ''}>
      {/* Mobile: track name + M/S above grid */}
      <div className="flex items-center gap-1 mb-1.5 lg:hidden">
        {nameButton('sm')}
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
        <div className="relative hidden lg:flex w-56 items-center gap-2">
          {nameButton('lg')}
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
