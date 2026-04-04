"use client";

import { memo, useCallback } from 'react';
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
}: TrackRowProps) {
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

  return (
    <div>
      {/* Mobile: track name + M/S above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
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
                    isSelected={
                      selectedSteps?.has(globalIdx)
                      ?? false
                    }
                    conditions={
                      trigConditions?.[globalIdx]
                    }
                    gainLock={
                      parameterLocks?.[globalIdx]
                        ?.gain
                    }
                    panLock={
                      parameterLocks?.[globalIdx]
                        ?.pan
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
