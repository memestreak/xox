"use client";

import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import { TRACKS, useSequencer } from './SequencerContext';
import TrackRow from './TrackRow';
import AccentRow from './AccentRow';
import StepPopover from './StepPopover';
import { useDragPaint } from './useDragPaint';
import { useSelection } from './useSelection';
import type { TrackId, TrackPattern } from './types';
import { getPatternLength } from './types';
import trackPatternData from './data/trackPatterns.json';

const TRACK_PATTERNS: TrackPattern[] =
  trackPatternData.patterns;

const TRACK_ORDER: TrackId[] = [
  ...TRACKS.map(t => t.id),
  'ac' as TrackId,
];

/** Track order for selection (no accent row). */
const SELECTABLE_TRACKS: TrackId[] =
  TRACKS.map(t => t.id);

interface StepGridProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageOffset: number;
  autoFollow: boolean;
  setPage: (page: number) => void;
}

/**
 * The main sequencer grid section containing all track
 * rows and the running light indicator. Subscribes to
 * stepRef via requestAnimationFrame to update the visual
 * step highlight without causing full-tree re-renders.
 */
export default function StepGrid({
  scrollContainerRef,
  pageOffset,
  autoFollow,
  setPage,
}: StepGridProps) {
  const { state, actions, meta } = useSequencer();
  const { trackStates } = state;
  const {
    toggleStep, setStep, setTrackSteps,
    toggleMute, toggleSolo,
    setGain, setPan, setTrackLength, toggleFreeRun,
    clearTrack, playPreview,
    clearTrigCondition, clearParameterLock,
  } = actions;
  const {
    stepRef, totalStepsRef,
    triggeredTracksRef, config,
  } = meta;
  const patternLength = getPatternLength(config.tracks);

  const longPressActiveRef = useRef<boolean>(false);
  const popoverOpenRef = useRef<boolean>(false);

  const {
    selectedByTrack,
    ctrlClickCell,
    shiftClickCell,
    startRectDrag,
    updateRectDrag,
    clearSelection,
    toggleSelected,
  } = useSelection({
    trackOrder: SELECTABLE_TRACKS,
    tracks: config.tracks,
    popoverOpenRef,
    setStep,
    clearTrigCondition,
    clearParameterLock,
    toggleStep,
  });

  // Clear selection on page change
  const prevPageRef = useRef(pageOffset);
  useEffect(() => {
    if (prevPageRef.current !== pageOffset) {
      prevPageRef.current = pageOffset;
      clearSelection();
    }
  }, [pageOffset, clearSelection]);

  const dragContainerRef = useRef<HTMLDivElement>(null);
  const dragPaint = useDragPaint({
    containerRef: dragContainerRef,
    trackOrder: TRACK_ORDER,
    tracks: config.tracks,
    onSetStep: setStep,
    patterns: TRACK_PATTERNS,
    onSetTrackSteps: setTrackSteps,
    longPressActiveRef,
    popoverOpenRef,
    pageOffset,
    onSelectionStart: startRectDrag,
    onSelectionUpdate: updateRectDrag,
    onClearSelection: clearSelection,
  });

  const [openPopover, setOpenPopover] = useState<{
    trackId: TrackId;
    stepIndex: number;
    anchorRect: { top: number; left: number };
  } | null>(null);

  useEffect(() => {
    popoverOpenRef.current = openPopover !== null;
  }, [openPopover]);

  // Local state driven by rAF, isolated from the
  // context provider so only StepGrid and its children
  // re-render on step ticks.
  const [displayStep, setDisplayStep] = useState(-1);
  const [displayTotal, setDisplayTotal] = useState(0);
  const [triggeredTracks, setTriggeredTracks] =
    useState<Set<TrackId>>(new Set());
  const triggerTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const autoFollowRef = useRef(autoFollow);
  const flashTriggered = useCallback(
    (tracks: Set<TrackId>) => {
      setTriggeredTracks(tracks);
      if (triggerTimerRef.current) {
        clearTimeout(triggerTimerRef.current);
      }
      if (tracks.size > 0) {
        triggerTimerRef.current = setTimeout(
          () => setTriggeredTracks(new Set()),
          150
        );
      }
    },
    []
  );

  const handlePlayPreview = useCallback(
    (trackId: TrackId) => {
      playPreview(trackId);
      flashTriggered(new Set([trackId]));
    },
    [playPreview, flashTriggered]
  );

  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  useEffect(() => {
    let raf: number;
    let prevStep = -1;
    let prevTotal = 0;

    const tick = () => {
      const curStep = stepRef.current;
      const curTotal = totalStepsRef.current;
      if (
        curStep !== prevStep
        || curTotal !== prevTotal
      ) {
        prevStep = curStep;
        prevTotal = curTotal;
        setDisplayStep(curStep);
        setDisplayTotal(
          Math.max(0, curTotal - 1)
        );
        flashTriggered(
          new Set(triggeredTracksRef.current)
        );
        // Auto-follow page
        if (
          autoFollowRef.current
          && curStep >= 0
        ) {
          const stepPage =
            Math.floor(curStep / 16);
          setPage(stepPage);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (triggerTimerRef.current) {
        clearTimeout(triggerTimerRef.current);
      }
    };
  }, [stepRef, totalStepsRef, triggeredTracksRef, flashTriggered, setPage]);

  return (
    <div className="space-y-2 lg:space-y-4 bg-neutral-900/30 p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-neutral-800/50">
      <div
        ref={dragContainerRef}
        style={{ touchAction: 'none' }}
        {...dragPaint}
        className="space-y-2 lg:space-y-4 select-none"
      >
        {TRACKS.map(track => (
          <TrackRow
            key={track.id}
            trackId={track.id}
            trackName={track.name}
            steps={config.tracks[track.id].steps}
            trackLength={config.tracks[track.id].steps.length}
            patternLength={patternLength}
            pageOffset={pageOffset}
            isMuted={trackStates[track.id].isMuted}
            isSolo={trackStates[track.id].isSolo}
            isFreeRun={
              config.tracks[track.id].freeRun ?? false
            }
            gain={trackStates[track.id].gain}
            pan={trackStates[track.id].pan}
            currentStep={displayStep}
            totalSteps={displayTotal}
            onToggleStep={toggleStep}
            onToggleMute={toggleMute}
            onToggleSolo={toggleSolo}
            onSetGain={setGain}
            onSetPan={setPan}
            onSetTrackLength={setTrackLength}
            onToggleFreeRun={toggleFreeRun}
            onClearTrack={clearTrack}
            onPlayPreview={handlePlayPreview}
            isTriggered={
              triggeredTracks.has(track.id)
            }
            longPressActiveRef={longPressActiveRef}
            trigConditions={
              config.tracks[track.id].trigConditions
            }
            parameterLocks={
              config.tracks[track.id].parameterLocks
            }
            onOpenPopover={(
              trackId: TrackId,
              stepIndex: number,
              rect: { top: number; left: number }
            ) => setOpenPopover({
              trackId, stepIndex, anchorRect: rect,
            })}
            selectedSteps={
              selectedByTrack.get(track.id)
            }
            onCtrlClick={ctrlClickCell}
            onShiftClick={shiftClickCell}
            onPlainClick={toggleSelected}
            onClearSelection={clearSelection}
          />
        ))}
        <AccentRow
          steps={config.tracks.ac.steps}
          trackLength={config.tracks.ac.steps.length}
          patternLength={patternLength}
          pageOffset={pageOffset}
          isFreeRun={config.tracks.ac.freeRun ?? false}
          gain={trackStates.ac.gain}
          currentStep={displayStep}
          totalSteps={displayTotal}
          onToggleStep={toggleStep}
          onSetTrackLength={setTrackLength}
          onToggleFreeRun={toggleFreeRun}
          onSetGain={setGain}
          onClearTrack={clearTrack}
        />
      </div>
      {openPopover !== null ? (
        <StepPopover
          trackId={openPopover.trackId}
          stepIndex={openPopover.stepIndex}
          conditions={
            config.tracks[
              openPopover.trackId
            ].trigConditions?.[openPopover.stepIndex]
          }
          locks={
            config.tracks[
              openPopover.trackId
            ].parameterLocks?.[openPopover.stepIndex]
          }
          anchorRect={openPopover.anchorRect}
          onClose={() => setOpenPopover(null)}
          scrollContainerRef={scrollContainerRef}
        />
      ) : null}
    </div>
  );
}
