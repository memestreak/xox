"use client";

import { memo, useCallback, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';
import { computeEffectiveStep, hasStepData } from './trackUtils';
import TrackNameButton from './TrackNameButton';
import TrackMixer from './TrackMixer';
import TrackEndBar from './TrackEndBar';
import StepButton from './StepButton';
import { retrigCoverage } from './retrig';
import CustomSampleDot from './CustomSampleDot';
import { useFileDrop } from './hooks/useFileDrop';
import type { SequencerActions } from './SequencerContext';
import type { FileDropHandlers } from './hooks/useFileDrop';

/** Marks a row a file is being dragged over (no layout shift). */
const DROP_TARGET =
  ' rounded outline-2 outline-dashed outline-accent outline-offset-2';

/** The sequencer actions a track row uses. */
export type TrackRowActions = Pick<
  SequencerActions,
  | 'toggleStep' | 'toggleMute' | 'toggleSolo'
  | 'setGain' | 'setPan' | 'setTrackLength'
  | 'toggleFreeRun' | 'clearTrack'
  | 'clearTrackConditions' | 'clearTrackLocks'
  | 'restoreTrack'
  | 'loadSample' | 'resetSample' | 'toggleSample'
>;

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
  /**
   * The sequencer's actions (useSequencer().actions).
   * The object is stable, so passing it whole keeps
   * the row's memo working.
   */
  actions: TrackRowActions;
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
  /**
   * The next row is minimized too: pull it closer
   * (a margin, not a border, so nothing reflows).
   */
  tightBelow?: boolean;
  /** File name when the track plays a custom sample. */
  customSampleName?: string;
  /** False while a custom track plays the kit sample. */
  isCustomSampleOn?: boolean;
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
  customSampleName?: string;
  isCustomSampleOn: boolean;
  onToggleSample: () => void;
  dropHandlers: FileDropHandlers;
  isDropTarget: boolean;
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
  customSampleName,
  isCustomSampleOn,
  onToggleSample,
  dropHandlers,
  isDropTarget,
}: MinimizedTrackRowProps) {
  return (
    <div
      data-minimized={trackName}
      {...dropHandlers}
      className={
        'flex gap-2 lg:gap-4 items-center'
        + (tightBelow ? ' mb-1 lg:mb-0.5' : '')
        + (isDropTarget ? DROP_TARGET : '')
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
        {customSampleName !== undefined && (
          <CustomSampleDot
            fileName={customSampleName}
            isOn={isCustomSampleOn}
            onToggle={onToggleSample}
          />
        )}
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
  actions,
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
  tightBelow = false,
  customSampleName,
  isCustomSampleOn = true,
}: TrackRowProps) {
  const {
    toggleStep, toggleMute, toggleSolo, setGain, setPan,
    setTrackLength, toggleFreeRun, clearTrack,
    clearTrackConditions, clearTrackLocks, restoreTrack,
    loadSample, resetSample, toggleSample,
  } = actions;
  const stepGridRef = useRef<HTMLDivElement>(null);
  // ─── Bound callbacks ──────────────────────────
  const handleMute = useCallback(
    () => toggleMute(trackId),
    [toggleMute, trackId]
  );
  const handleSolo = useCallback(
    () => toggleSolo(trackId),
    [toggleSolo, trackId]
  );
  const handlePan = useCallback(
    (v: number) => setPan(trackId, v),
    [setPan, trackId]
  );
  const handleGain = useCallback(
    (v: number) => setGain(trackId, v),
    [setGain, trackId]
  );
  const handleFreeRun = useCallback(
    () => toggleFreeRun(trackId),
    [toggleFreeRun, trackId]
  );
  const handleClearTrack = useCallback(
    () => clearTrack(trackId),
    [clearTrack, trackId]
  );
  const handleResetConditions = useCallback(
    () => clearTrackConditions(trackId),
    [clearTrackConditions, trackId]
  );
  const handleClearLocks = useCallback(
    () => clearTrackLocks(trackId),
    [clearTrackLocks, trackId]
  );
  const handlePlayPreview = useCallback(
    () => onPlayPreview(trackId),
    [onPlayPreview, trackId]
  );
  const handleLoadSample = useCallback(
    (file: File) => void loadSample(trackId, file),
    [loadSample, trackId]
  );
  const handleResetSample = useCallback(
    () => resetSample(trackId),
    [resetSample, trackId]
  );
  const handleToggleSample = useCallback(
    () => toggleSample(trackId),
    [toggleSample, trackId]
  );
  const drop = useFileDrop(handleLoadSample);
  const handleSetLength = useCallback(
    (len: number) => setTrackLength(trackId, len),
    [setTrackLength, trackId]
  );

  // Retrig hits per step, for the dots on the keys
  const retrigCover = useMemo(
    () => retrigCoverage(steps, parameterLocks, patternLength),
    [steps, parameterLocks, patternLength],
  );

  const effectiveStep = computeEffectiveStep(
    currentStep, totalSteps, isFreeRun, trackLength
  );

  // ─── Page-offset wrappers ─────────────────────
  const handleToggleStep = useCallback(
    (tid: TrackId, localStep: number) =>
      toggleStep(tid, localStep + pageOffset),
    [toggleStep, pageOffset]
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
    () => restoreTrack(trackId),
    [restoreTrack, trackId]
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
        customSampleName={customSampleName}
        isCustomSampleOn={isCustomSampleOn}
        onToggleSample={handleToggleSample}
        dropHandlers={drop.handlers}
        isDropTarget={drop.isOver}
      />
    );
  }

  return (
    <div
      data-row-track={trackId}
      {...drop.handlers}
      className={drop.isOver ? DROP_TARGET.trim() : undefined}
    >
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
          customSampleName={customSampleName}
          isCustomSampleOn={isCustomSampleOn}
          onLoadSample={handleLoadSample}
          onResetSample={handleResetSample}
          onToggleSample={handleToggleSample}
        />
        {customSampleName !== undefined && (
          <CustomSampleDot
            fileName={customSampleName}
            isOn={isCustomSampleOn}
            onToggle={handleToggleSample}
          />
        )}
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
            hasConditions={hasStepData(trigConditions)}
            onResetConditions={handleResetConditions}
            hasLocks={hasStepData(parameterLocks)}
            onClearLocks={handleClearLocks}
            onPlayPreview={handlePlayPreview}
            customSampleName={customSampleName}
            isCustomSampleOn={isCustomSampleOn}
            onLoadSample={handleLoadSample}
            onResetSample={handleResetSample}
            onToggleSample={handleToggleSample}
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
                    retrigHits={
                      disabled
                        ? undefined
                        : retrigCover.get(globalIdx)
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
