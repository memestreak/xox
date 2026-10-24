"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import { useSequencer } from './SequencerContext';
import TrackRow from './TrackRow';
import AccentRow from './AccentRow';
import StepPopover from './StepPopover';
import ErrorBoundary from './ErrorBoundary';
import GridContextMenu from './GridContextMenu';
import { useDragPaint } from './hooks/useDragPaint';
import { useSelection } from './hooks/useSelection';
import type { TrackId, TrackPattern } from './types';
import {
  TRACKS, cellKey, getPatternLength, parseCellKey,
} from './types';
import { TRIGGER_FLASH_MS } from './constants';
import { audioEngine } from './AudioEngine';
import { drainDueSteps } from './stepQueue';
import trackPatternData from './data/trackPatterns.json';

const TRACK_PATTERNS: TrackPattern[] =
  trackPatternData.patterns;

/**
 * Right-clicks on these keep their own behavior (or the
 * browser's); anywhere else in the panel opens the grid
 * menu.
 */
const OWN_CONTEXT_MENU =
  'button, input, select, [role="slider"], [data-step]';

interface StepGridProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageOffset: number;
  autoFollow: boolean;
  setPage: (page: number) => void;
}

/**
 * The main sequencer grid section containing all track
 * rows and the running light indicator. A
 * requestAnimationFrame loop drains the scheduled-step
 * queue against the audio clock, so the highlight
 * follows what is heard without full-tree re-renders.
 */
export default function StepGrid({
  scrollContainerRef,
  pageOffset,
  autoFollow,
  setPage,
}: StepGridProps) {
  const { state, actions, meta } = useSequencer();
  const { trackStates, minimizedTracks, minimizableCount } =
    state;
  const {
    toggleStep, setStep, setTrackSteps,
    toggleMute, toggleSolo,
    setGain, setPan, setTrackLength, toggleFreeRun,
    clearTrack, playPreview,
    clearTrigCondition, clearParameterLock,
    setTrigCondition,
    minimizeEmptyTracks, restoreTrack, restoreAllTracks,
  } = actions;
  const { stepRef, stepQueueRef, config } = meta;
  const patternLength = getPatternLength(config.tracks);

  // Rows that drags and selection boxes can reach:
  // minimized rows are skipped, so a drag from BD to OH
  // doesn't paint a minimized SD in between.
  const selectableTracks = useMemo<TrackId[]>(
    () => TRACKS
      .map(t => t.id)
      .filter(id => !minimizedTracks.has(id)),
    [minimizedTracks]
  );
  const paintableTracks = useMemo<TrackId[]>(
    () => [...selectableTracks, 'ac'],
    [selectableTracks]
  );

  const longPressActiveRef = useRef<boolean>(false);
  // True while the step editor or the grid menu is open,
  // so Escape and outside presses close it before they
  // clear the selection.
  const popoverOpenRef = useRef<boolean>(false);

  const [gridMenu, setGridMenu] = useState<{
    x: number; y: number;
  } | null>(null);
  const closeGridMenu = useCallback(
    () => setGridMenu(null), []
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented) return;
      if (
        e.target instanceof Element
        && e.target.closest(OWN_CONTEXT_MENU)
      ) {
        return;
      }
      e.preventDefault();
      setGridMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const [openPopover, setOpenPopover] = useState<{
    trackId: TrackId;
    stepIndex: number;
    anchorRect: { top: number; left: number };
    focusSection?: 'probability' | 'cycle';
  } | null>(null);

  useEffect(() => {
    popoverOpenRef.current =
      openPopover !== null || gridMenu !== null;
  }, [openPopover, gridMenu]);

  // Stable so it doesn't defeat TrackRow's memo
  const openStepPopover = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      rect: { top: number; left: number }
    ) => setOpenPopover({
      trackId, stepIndex, anchorRect: rect,
    }),
    []
  );

  // Stable ref for openBulkPopover to read selection
  const selectionRef = useRef<Set<string>>(new Set());

  const openBulkPopover = useCallback(
    (focusSection?: 'probability' | 'cycle') => {
      const sel = selectionRef.current;
      if (sel.size === 0) return;
      const first = parseCellKey(
        sel.values().next().value!
      );
      // Find the step button inside its track row
      const el = document.querySelector<HTMLElement>(
        `[data-track="${first.trackId}"]`
        + ` [data-step="${first.step}"]`
      );
      const r = el?.getBoundingClientRect();
      setOpenPopover({
        trackId: first.trackId,
        stepIndex: first.step,
        anchorRect: {
          top: (r?.bottom ?? 200) + 4,
          left: r?.left ?? 100,
        },
        focusSection,
      });
    },
    []
  );

  // The cell region: drag gestures and the outside-press
  // boundary for clearing the selection.
  const dragContainerRef = useRef<HTMLDivElement>(null);

  const {
    selected,
    selectedByTrack,
    ctrlClickCell,
    shiftClickCell,
    startRectDrag,
    updateRectDrag,
    clearSelection,
    toggleSelected,
  } = useSelection({
    trackOrder: selectableTracks,
    tracks: config.tracks,
    popoverOpenRef,
    regionRef: dragContainerRef,
    setStep,
    clearTrigCondition,
    clearParameterLock,
    toggleStep,
    setTrigCondition,
    openBulkPopover,
  });

  useEffect(() => {
    selectionRef.current = selected;
  }, [selected]);

  // Clear selection on page change
  const prevPageRef = useRef(pageOffset);
  useEffect(() => {
    if (prevPageRef.current !== pageOffset) {
      prevPageRef.current = pageOffset;
      clearSelection();
    }
  }, [pageOffset, clearSelection]);

  const dragPaint = useDragPaint({
    containerRef: dragContainerRef,
    trackOrder: paintableTracks,
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

  // Minimizing drops the selection and closes the step
  // editor, which may point at a row that just shrank.
  const prevMinimizedRef = useRef(minimizedTracks);
  useEffect(() => {
    const prev = prevMinimizedRef.current;
    prevMinimizedRef.current = minimizedTracks;
    const grew = [...minimizedTracks].some(
      id => !prev.has(id)
    );
    if (grew) {
      clearSelection();
      setOpenPopover(null);
    }
  }, [minimizedTracks, clearSelection]);

  // When the popover's anchor cell is in the selection,
  // apply edits to all selected cells.
  const bulkTargets = useMemo(() => {
    if (!openPopover) return undefined;
    const key = cellKey(
      openPopover.trackId, openPopover.stepIndex
    );
    if (!selected.has(key)) return undefined;
    return [...selected].map(k => {
      const { trackId, step } = parseCellKey(k);
      return { trackId, stepIndex: step };
    });
  }, [openPopover, selected]);

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
          TRIGGER_FLASH_MS
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
    let shownStep = -1;

    const tick = () => {
      // Show each scheduled step when its sound reaches
      // the speakers, not when it was scheduled.
      const due = drainDueSteps(
        stepQueueRef.current,
        audioEngine.getOutputTime()
      );
      if (due) {
        const { step, totalSteps } = due.latest;
        shownStep = step;
        setDisplayStep(step);
        setDisplayTotal(Math.max(0, totalSteps - 1));
        flashTriggered(due.triggered);
        if (autoFollowRef.current) {
          setPage(Math.floor(step / 16));
        }
      } else if (stepRef.current === -1 && shownStep !== -1) {
        // Playback stopped.
        shownStep = -1;
        setDisplayStep(-1);
        setDisplayTotal(0);
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
  }, [stepRef, stepQueueRef, flashTriggered, setPage]);

  return (
    // Right-click on a blank spot opens the grid menu.
    // Keyboard users get the same items from H / Shift+H
    // and the gear menu.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="ss-panel rounded-xl lg:rounded-2xl p-1 lg:p-2"
      onContextMenu={handleContextMenu}
    >
      {/* Column header: labels + step numbers */}
      <div
        aria-hidden="true"
        className="hidden lg:flex gap-4 items-end px-4 pt-2"
      >
        <div className="w-56 flex items-center gap-2">
          <span className="ss-label text-[10px] w-14 px-1">
            Track
          </span>
          <span className="ss-label text-[10px] w-14">
            M · S
          </span>
          <span className="ss-label text-[10px] w-7 ml-2 text-center">
            Vol
          </span>
          <span className="ss-label text-[10px] w-7 text-center">
            Pan
          </span>
        </div>
        <div className="flex-1 grid grid-cols-16 gap-1.5">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className={
                'font-mono text-[10px] text-center '
                + (i % 4 === 0 ? 'text-muted' : 'text-faint/60')
              }
            >
              {pageOffset + i + 1}
            </span>
          ))}
        </div>
      </div>
      <div
        ref={dragContainerRef}
        style={{ touchAction: 'none' }}
        {...dragPaint}
        className="space-y-2.5 lg:space-y-2 select-none p-2 lg:px-4 lg:pt-2 lg:pb-4"
      >
        {TRACKS.map((track, i) => (
          <TrackRow
            key={track.id}
            isMinimized={minimizedTracks.has(track.id)}
            tightBelow={
              minimizedTracks.has(track.id)
              && i + 1 < TRACKS.length
              && minimizedTracks.has(TRACKS[i + 1].id)
            }
            onRestore={restoreTrack}
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
            onOpenPopover={openStepPopover}
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
        <ErrorBoundary
          onError={() => setOpenPopover(null)}
        >
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
          bulkTargets={bulkTargets}
          focusSection={openPopover.focusSection}
        />
        </ErrorBoundary>
      ) : null}
      {gridMenu !== null ? (
        <GridContextMenu
          x={gridMenu.x}
          y={gridMenu.y}
          canMinimize={minimizableCount > 0}
          canRestore={minimizedTracks.size > 0}
          onMinimize={minimizeEmptyTracks}
          onRestoreAll={restoreAllTracks}
          onClose={closeGridMenu}
        />
      ) : null}
    </div>
  );
}
