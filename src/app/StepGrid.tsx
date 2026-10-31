"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import { useSequencer } from './SequencerContext';
import TrackRow from './TrackRow';
import AccentRow from './AccentRow';
import StepPopover from './StepPopover';
import { useMockVariant } from './mockVariant';
import ErrorBoundary from './ErrorBoundary';
import GridContextMenu from './GridContextMenu';
import Tooltip from './Tooltip';
import { useDragPaint } from './hooks/useDragPaint';
import { useSelection } from './hooks/useSelection';
import type { Pattern, TrackId, TrackPattern } from './types';
import {
  TRACKS, cellKey, getPatternLength, parseCellKey,
} from './types';
import { TRIGGER_FLASH_MS } from './constants';
import { audioEngine } from './AudioEngine';
import { drainDueSteps } from './stepQueue';
import trackPatternData from './data/trackPatterns.json';
import patternsData from './data/patterns.json';
import {
  buildPatternEntry, formatPatternEntry,
} from './patternExport';

const TRACK_PATTERNS: TrackPattern[] =
  trackPatternData.patterns;
const PRESETS = patternsData.patterns as Pattern[];

/**
 * Right-clicks on these keep their own behavior (or the
 * browser's); anywhere else in the panel opens the grid
 * menu.
 */
/** Space between the ⋯ key and the menu it opens. */
const GRID_MENU_KEY_GAP_PX = 4;

const OWN_CONTEXT_MENU =
  'button, input, select, [role="slider"], [data-step]';

interface StepGridProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageOffset: number;
  autoFollow: boolean;
  setPage: (page: number) => void;
  /** Reports the playhead's page (-1 when stopped). */
  setPlayingPage: (page: number) => void;
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
  setPlayingPage,
}: StepGridProps) {
  const { state, actions, meta } = useSequencer();
  const {
    trackStates, minimizedTracks, minimizableCount,
    autoMinimize, customSamples, disabledSamples,
    selectedPatternId,
  } = state;
  const {
    toggleStep, setStep, setTrackSteps,
    toggleMute, toggleSolo,
    setGain, setPan, setTrackLength, toggleFreeRun,
    clearTrack, playPreview,
    clearTrigCondition, clearParameterLock,
    setTrigCondition,
    minimizeEmptyTracks, restoreTrack, restoreAllTracks,
    setAutoMinimize, holdAutoMinimize,
    clearAll, loadSample, resetSample, resetAllSamples,
    toggleSample,
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
  const menuKeyRef = useRef<HTMLButtonElement>(null);

  // Grid menu > Copy pattern: the grid as a
  // patterns.json entry (see patternExport.ts).
  const copyPattern = useCallback(
    () => navigator.clipboard.writeText(
      formatPatternEntry(buildPatternEntry(
        config, selectedPatternId, PRESETS
      ))
    ),
    [config, selectedPatternId]
  );

  // The ⋯ key over the track names opens the same menu
  // below itself (the only way in on phones), and
  // closes it when it is already open.
  const toggleGridMenuFromKey = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setGridMenu(open => open !== null ? null : {
        x: rect.left,
        y: rect.bottom + GRID_MENU_KEY_GAP_PX,
      });
    },
    []
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

  // ─── MOCK: seed a few retrigs to show them off ───
  const mock = useMockVariant();
  const seededRef = useRef(false);
  useEffect(() => {
    if (!mock || seededRef.current) return;
    seededRef.current = true;
    const filled = TRACKS.map(t => t.id).filter(
      id => config.tracks[id].steps.slice(0, 16).includes('1')
    );
    // rate, length (steps): a flam, a 3-step roll, a buzz
    const shapes: Array<[number, number]> = [
      [64, 0.5], [16, 3], [64, 4],
    ];
    filled.slice(0, 3).forEach((id, i) => {
      const [rate, length] = shapes[i];
      // First hit from step 9 on, else the last one
      const st = config.tracks[id].steps.slice(0, 16);
      const from9 = st.indexOf('1', 8);
      const last = from9 >= 0 ? from9 : st.lastIndexOf('1');
      actions.setParameterLock(id, last, {
        retrig: {
          enabled: true, rate, length,
        },
      });
    });
  }, [mock]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // The grid lets vertical swipes scroll the page
  // (touch-action: pan-y), so phones can reach every
  // track. Sideways drags still paint along a row. Once
  // a long-press has fired, hold the page still so the
  // finger can keep working the step instead.
  useEffect(() => {
    const el = dragContainerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (longPressActiveRef.current && e.cancelable) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', onTouchMove, {
      passive: false,
    });
    return () => el.removeEventListener(
      'touchmove', onTouchMove
    );
  }, []);

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

  // Auto-minimize waits while the pointer is on the row
  // that lost its last step, so sparse tracks stay
  // editable, and during any press on the grid, so a
  // drag never moves rows under the pointer. A touch
  // "leaves" when lifted, so on phones the row waits
  // for the next touch somewhere else.
  useEffect(() => {
    const el = dragContainerRef.current;
    if (!el) return;
    let hovered: TrackId | null = null;
    let pressed = false;
    const update = () =>
      holdAutoMinimize(pressed ? 'all' : hovered);
    const rowOf = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      if (!el.contains(target)) return null;
      const row = target.closest<HTMLElement>(
        '[data-row-track]'
      );
      return (row?.dataset.rowTrack as TrackId) ?? null;
    };
    const onOver = (e: PointerEvent) => {
      hovered = rowOf(e.target);
      update();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      hovered = null;
      update();
    };
    const onDown = (e: PointerEvent) => {
      hovered = rowOf(e.target);
      pressed = el.contains(e.target as Node);
      update();
    };
    const onUp = () => {
      if (!pressed) return;
      pressed = false;
      update();
    };
    el.addEventListener('pointerover', onOver);
    el.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    return () => {
      el.removeEventListener('pointerover', onOver);
      el.removeEventListener('pointerleave', onLeave);
      document.removeEventListener(
        'pointerdown', onDown, true
      );
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener(
        'pointercancel', onUp, true
      );
      holdAutoMinimize(null);
    };
  }, [holdAutoMinimize]);

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
        const playingPage = Math.floor(step / 16);
        setPlayingPage(playingPage);
        if (autoFollowRef.current) {
          setPage(playingPage);
        }
      } else if (stepRef.current === -1 && shownStep !== -1) {
        // Playback stopped.
        shownStep = -1;
        setDisplayStep(-1);
        setDisplayTotal(0);
        setPlayingPage(-1);
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
  }, [
    stepRef, stepQueueRef, flashTriggered, setPage,
    setPlayingPage,
  ]);

  return (
    // Right-click on a blank spot opens the grid menu,
    // as does the ⋯ key over the track names.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="ss-panel rounded-xl lg:rounded-2xl p-1 lg:p-2"
      onContextMenu={handleContextMenu}
    >
      {/* Column header: the grid menu key over the track
          names, then (desktop only) Vol / Pan labels and
          step numbers. */}
      <div className="flex gap-4 items-end px-2 pt-1.5 -mb-1 lg:mb-0 lg:px-4 lg:pt-2">
        <div className="lg:w-56 flex items-center gap-2">
          {/* Spacer over the name and M/S keys, so Vol and
              Pan stay above their knobs. */}
          <span className="lg:w-30 flex items-center">
            <Tooltip tooltipKey="gridMenu" position="bottom">
              <button
                ref={menuKeyRef}
                type="button"
                aria-label="Grid options"
                aria-haspopup="menu"
                aria-expanded={gridMenu !== null}
                onClick={toggleGridMenuFromKey}
                onContextMenu={e => {
                  // Right-click opens it too, rather than
                  // the browser's menu.
                  e.preventDefault();
                  if (gridMenu === null) {
                    toggleGridMenuFromKey(e);
                  }
                }}
                className="ss-key h-7 px-2 rounded-md text-muted hover:text-ink text-base leading-none tracking-[0.1em]"
              >
                <span aria-hidden="true">⋯</span>
              </button>
            </Tooltip>
          </span>
          <span
            aria-hidden="true"
            className="hidden lg:inline ss-label w-7 ml-2 text-center"
          >
            Vol
          </span>
          <span
            aria-hidden="true"
            className="hidden lg:inline ss-label w-7 text-center"
          >
            Pan
          </span>
        </div>
        <div
          aria-hidden="true"
          className="hidden lg:grid flex-1 grid-cols-16 gap-1.5"
        >
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
        style={{ touchAction: 'pan-y' }}
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
            customSampleName={customSamples[track.id]?.name}
            isCustomSampleOn={!disabledSamples[track.id]}
            onLoadSample={loadSample}
            onResetSample={resetSample}
            onToggleSample={toggleSample}
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
          autoMinimize={autoMinimize}
          onSetAutoMinimize={setAutoMinimize}
          onReset={clearAll}
          hasCustomSamples={
            Object.keys(customSamples).length > 0
          }
          onResetAllSamples={resetAllSamples}
          onCopyPattern={copyPattern}
          onClose={closeGridMenu}
          anchorRef={menuKeyRef}
        />
      ) : null}
    </div>
  );
}
