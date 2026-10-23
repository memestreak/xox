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
import { useMockVariant } from './mockVariant';

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
  const { trackStates } = state;
  const {
    toggleStep, setStep, setTrackSteps,
    toggleMute, toggleSolo,
    setGain, setPan, setTrackLength, toggleFreeRun,
    clearTrack, playPreview,
    clearTrigCondition, clearParameterLock,
    setTrigCondition,
  } = actions;
  const { stepRef, stepQueueRef, config } = meta;
  const patternLength = getPatternLength(config.tracks);

  // ─── MOCK: collapse empty tracks ─────────────
  const mock = useMockVariant();
  const isEmpty = (id: TrackId) =>
    !config.tracks[id].steps.includes('1');
  const emptyIds = TRACKS.filter(t => isEmpty(t.id)).map(t => t.id);
  // A: hide-empty toggle + tracks shown again by hand
  const [hideEmpty, setHideEmpty] = useState(true);
  const [revealed, setRevealed] = useState<Set<TrackId>>(new Set());
  // B: per-track fold (starts with empty tracks folded)
  const [folded, setFolded] = useState<Set<TrackId> | null>(null);
  const foldedSet = folded ?? new Set(emptyIds);
  const toggleFold = (id: TrackId) => {
    const next = new Set(foldedSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFolded(next);
  };
  // D: which empty track the spare row edits
  const [spareId, setSpareId] = useState<TrackId | null>(null);
  const spare = spareId && isEmpty(spareId) ? spareId : emptyIds[0];
  // E: right-click a blank spot to minimize empty tracks;
  // a minimized row's caret restores it.
  const [minimized, setMinimized] = useState<Set<TrackId>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.target instanceof Element && e.target.closest('[role="menu"]')) return;
      setCtxMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [ctxMenu]);
  const hiddenA = mock === 'A' && hideEmpty
    ? emptyIds.filter(id => !revealed.has(id)) : [];

  const longPressActiveRef = useRef<boolean>(false);
  const popoverOpenRef = useRef<boolean>(false);

  const [openPopover, setOpenPopover] = useState<{
    trackId: TrackId;
    stepIndex: number;
    anchorRect: { top: number; left: number };
    focusSection?: 'probability' | 'cycle';
  } | null>(null);

  useEffect(() => {
    popoverOpenRef.current = openPopover !== null;
  }, [openPopover]);

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
    trackOrder: SELECTABLE_TRACKS,
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
    <div
      className="ss-panel rounded-xl lg:rounded-2xl p-1 lg:p-2"
      onContextMenu={mock === 'E' ? (e) => {
        // Steps and track names handle their own right-click.
        if (e.defaultPrevented) return;
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      } : undefined}
    >
      {mock === 'E' && ctxMenu && (
        <div
          role="menu"
          aria-label="Grid options"
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y }}
          className="ss-menu w-60 p-1.5 z-30 flex flex-col"
        >
          <button
            role="menuitem"
            disabled={emptyIds.length === 0}
            onClick={() => { setMinimized(new Set(emptyIds)); setCtxMenu(null); }}
            className="w-full text-left px-2.5 py-2 rounded-[5px] text-sm hover:bg-[#2f2c27] flex items-center justify-between gap-3 text-ink disabled:text-faint"
          >
            <span>Minimize empty tracks</span>
            <span className="font-mono text-[10px] text-muted border border-edge rounded px-1.5 py-px">{emptyIds.length}</span>
          </button>
          <button
            role="menuitem"
            disabled={minimized.size === 0}
            onClick={() => { setMinimized(new Set()); setCtxMenu(null); }}
            className="w-full text-left px-2.5 py-2 rounded-[5px] text-sm hover:bg-[#2f2c27] flex items-center justify-between gap-3 text-ink disabled:text-faint"
          >
            <span>Restore all tracks</span>
          </button>
        </div>
      )}
      {mock === 'A' && (
        <div className="flex items-center gap-2 px-2 lg:px-4 pt-2 lg:pt-2 pb-1 flex-wrap">
          <button
            aria-pressed={hideEmpty}
            onClick={() => { setHideEmpty(!hideEmpty); setRevealed(new Set()); }}
            className={
              'ss-key ss-cap h-8 px-2.5 text-xs inline-flex items-center gap-1.5 whitespace-nowrap'
              + (hideEmpty ? ' text-ink' : ' text-muted')
            }
          >
            <span className={'ss-led' + (hideEmpty ? ' ss-led-on' : '')} />
            Hide empty
          </button>
          {hiddenA.length > 0 && (
            <>
              <span className="ss-label ml-1 lg:ml-2">{hiddenA.length} hidden</span>
              <div className="flex flex-wrap gap-1">
                {hiddenA.map(id => (
                  <button
                    key={id}
                    aria-label={'Show ' + id}
                    onClick={() => setRevealed(new Set([...revealed, id]))}
                    className="ss-key font-display font-bold uppercase tracking-[0.08em] text-[13px] text-muted hover:text-ink h-7 px-2"
                  >
                    {TRACKS.find(t => t.id === id)!.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
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
        {TRACKS.filter(track => {
          if (mock === 'A') return !hiddenA.includes(track.id);
          if (mock === 'D') return !isEmpty(track.id);
          return true;
        }).concat(
          mock === 'D' && spare
            ? TRACKS.filter(t => t.id === spare) : []
        ).map(track => (
          <TrackRow
            key={track.id}
            mockLook={
              mock === 'B' && foldedSet.has(track.id) ? 'folded'
              : mock === 'E' && minimized.has(track.id) ? 'folded'
              : mock === 'C' && isEmpty(track.id) ? 'slim'
              : 'full'
            }
            onFold={
              mock === 'B' ? () => toggleFold(track.id)
              : mock === 'E' && minimized.has(track.id)
                ? () => setMinimized(prev => {
                  const next = new Set(prev);
                  next.delete(track.id);
                  return next;
                })
                : undefined
            }
            spare={mock === 'D' && isEmpty(track.id)}
            nameSlot={mock === 'D' && isEmpty(track.id) ? (
              <select
                aria-label="Spare row track"
                value={track.id}
                onChange={e => setSpareId(e.target.value as TrackId)}
                className="ss-key ss-select h-8 w-[76px] pl-2.5 font-display font-bold text-[17px] tracking-[0.08em]"
              >
                {emptyIds.map(id => (
                  <option key={id} value={id}>
                    {TRACKS.find(t => t.id === id)!.name}
                  </option>
                ))}
              </select>
            ) : undefined}
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
    </div>
  );
}
