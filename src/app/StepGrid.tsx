"use client";

import {
  useEffect, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import { TRACKS, useSequencer } from './SequencerContext';
import TrackRow from './TrackRow';
import AccentRow from './AccentRow';
import TrigConditionPopover
  from './TrigConditionPopover';
import { useDragPaint } from './useDragPaint';
import type { TrackId, TrackPattern } from './types';
import trackPatternData from './data/trackPatterns.json';

const TRACK_PATTERNS: TrackPattern[] =
  trackPatternData.patterns;

const TRACK_ORDER: TrackId[] = [
  ...TRACKS.map(t => t.id),
  'ac' as TrackId,
];

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
  const {
    currentPattern, trackStates,
    patternLength, trackLengths,
  } = state;
  const {
    toggleStep, setStep, setTrackSteps,
    toggleMute, toggleSolo,
    setGain, setTrackLength, toggleFreeRun,
    clearTrack,
  } = actions;
  const { stepRef, totalStepsRef, config } = meta;

  const longPressActiveRef = useRef<boolean>(false);
  const popoverOpenRef = useRef<boolean>(false);

  const dragContainerRef = useRef<HTMLDivElement>(null);
  const dragPaint = useDragPaint({
    containerRef: dragContainerRef,
    trackOrder: TRACK_ORDER,
    trackLengths,
    steps: currentPattern.steps,
    onSetStep: setStep,
    patterns: TRACK_PATTERNS,
    onSetTrackSteps: setTrackSteps,
    longPressActiveRef,
    popoverOpenRef,
    pageOffset,
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

  const autoFollowRef = useRef(autoFollow);
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
    return () => cancelAnimationFrame(raf);
  }, [stepRef, totalStepsRef, setPage]);

  return (
    <div className="space-y-2 lg:space-y-4 bg-neutral-900/30 p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-neutral-800/50">
      <div
        ref={dragContainerRef}
        style={{ touchAction: 'none' }}
        {...dragPaint}
        className="space-y-2 lg:space-y-4"
      >
        {TRACKS.map(track => (
          <TrackRow
            key={track.id}
            trackId={track.id}
            trackName={track.name}
            steps={currentPattern.steps[track.id]}
            trackLength={trackLengths[track.id]}
            patternLength={patternLength}
            pageOffset={pageOffset}
            isMuted={trackStates[track.id].isMuted}
            isSolo={trackStates[track.id].isSolo}
            isFreeRun={
              trackStates[track.id].freeRun
            }
            gain={trackStates[track.id].gain}
            currentStep={displayStep}
            totalSteps={displayTotal}
            onToggleStep={toggleStep}
            onToggleMute={toggleMute}
            onToggleSolo={toggleSolo}
            onSetGain={setGain}
            onSetTrackLength={setTrackLength}
            onToggleFreeRun={toggleFreeRun}
            onClearTrack={clearTrack}
            longPressActiveRef={longPressActiveRef}
            trigConditions={
              config.trigConditions[track.id]
            }
            onOpenPopover={(
              trackId: TrackId,
              stepIndex: number,
              rect: { top: number; left: number }
            ) => setOpenPopover({
              trackId, stepIndex, anchorRect: rect,
            })}
          />
        ))}
        <AccentRow
          steps={currentPattern.steps.ac}
          trackLength={trackLengths.ac}
          patternLength={patternLength}
          pageOffset={pageOffset}
          isFreeRun={trackStates.ac.freeRun}
          gain={trackStates.ac.gain}
          currentStep={displayStep}
          totalSteps={displayTotal}
          onToggleStep={toggleStep}
          onSetTrackLength={setTrackLength}
          onToggleFreeRun={toggleFreeRun}
          onSetGain={setGain}
        />
      </div>
      {openPopover !== null ? (
        <TrigConditionPopover
          trackId={openPopover.trackId}
          stepIndex={openPopover.stepIndex}
          conditions={
            config.trigConditions[
              openPopover.trackId
            ]?.[openPopover.stepIndex]
          }
          anchorRect={openPopover.anchorRect}
          onClose={() => setOpenPopover(null)}
          scrollContainerRef={scrollContainerRef}
        />
      ) : null}
    </div>
  );
}
