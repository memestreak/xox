import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef,
  useState,
} from 'react';
import { shouldIgnoreShortcut } from '../keyboardUtils';
import { TRACKS } from '../types';
import type { TrackConfig, TrackId } from '../types';

/** Grid tracks that can be minimized (never the accent). */
const MINIMIZABLE: TrackId[] = TRACKS.map(t => t.id);

const EMPTY_SET: ReadonlySet<TrackId> = new Set();

function isEmptyTrack(track: TrackConfig): boolean {
  return !track.steps.includes('1');
}

/** Grid tracks with no active steps, in display order. */
export function emptyTrackIds(
  tracks: Record<TrackId, TrackConfig>
): TrackId[] {
  return MINIMIZABLE.filter(id => isEmptyTrack(tracks[id]));
}

/** See holdAutoMinimize. */
export type AutoMinimizeHold = TrackId | 'all' | null;

interface UseMinimizedTracksOptions {
  tracks: Record<TrackId, TrackConfig>;
  /**
   * The "Auto-minimize empty tracks" setting. When on,
   * a track that loses its last step is minimized, and
   * every empty track is minimized when a pattern loads
   * or the setting is turned on.
   */
  autoMinimize?: boolean;
  /**
   * Goes up by one each time a whole pattern is loaded
   * (preset, pattern change while playing, Temp
   * return, share link, saved session).
   */
  loadSeq?: number;
}

export interface UseMinimizedTracksReturn {
  /**
   * Tracks drawn as thin rows. Only tracks that are
   * still empty, so a minimized row never hides a step.
   */
  minimizedTracks: ReadonlySet<TrackId>;
  /** Empty tracks that "Minimize" would add. */
  minimizableCount: number;
  minimizeEmptyTracks: () => void;
  restoreTrack: (trackId: TrackId) => void;
  restoreAllTracks: () => void;
  /**
   * Where the pointer is, so auto-minimize can wait:
   * a track that loses its last step stays full while
   * the pointer is on its row (or anywhere, with 'all',
   * during a press or drag), and minimizes once it
   * moves off. Null: nothing waits.
   */
  holdAutoMinimize: (hold: AutoMinimizeHold) => void;
  /** Restores every row (Reset). */
  reset: () => void;
}

/**
 * Which grid rows are minimized. A view setting only:
 * it is not part of SequencerConfig, so share links,
 * autosave and Reset's pattern data never see it.
 *
 * A track that gains steps drops out of the set and
 * stays full until it is minimized again. By default
 * minimizing is a one-off tidy-up (H, grid menu). With
 * auto-minimize on, a track is also minimized when it
 * loses its last step (once the pointer is off its
 * row, so sparse tracks stay editable), and every
 * empty track when a pattern loads. A track restored by hand stays
 * restored until it loses its last step again or the
 * next pattern loads. Owns the H / Shift+H shortcuts
 * (listed in helpContent.ts).
 */
export function useMinimizedTracks({
  tracks,
  autoMinimize = false,
  loadSeq = 0,
}: UseMinimizedTracksOptions): UseMinimizedTracksReturn {
  const [minimized, setMinimized] =
    useState<ReadonlySet<TrackId>>(EMPTY_SET);

  // Read by the stable callbacks. A layout effect, so
  // it is current before the auto-minimize one below.
  const tracksRef = useRef(tracks);
  useLayoutEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Forget tracks that gained steps (pattern load, share
  // link, pattern mode, painting a restored row...).
  // Done while rendering, so a track that just gained
  // steps never shows minimized.
  const [prevTracks, setPrevTracks] = useState(tracks);
  let minimizedTracks = minimized;
  if (tracks !== prevTracks) {
    setPrevTracks(tracks);
    const kept = [...minimized].filter(
      id => isEmptyTrack(tracks[id])
    );
    if (kept.length !== minimized.size) {
      minimizedTracks = new Set(kept);
      setMinimized(minimizedTracks);
    }
  }

  const minimizableCount = useMemo(
    () => emptyTrackIds(tracks).filter(
      id => !minimizedTracks.has(id)
    ).length,
    [tracks, minimizedTracks]
  );

  const minimizeEmptyTracks = useCallback(() => {
    const empty = emptyTrackIds(tracksRef.current);
    setMinimized(prev => {
      if (empty.every(id => prev.has(id))) return prev;
      return new Set([...prev, ...empty]);
    });
  }, []);

  const restoreTrack = useCallback((trackId: TrackId) => {
    setMinimized(prev => {
      if (!prev.has(trackId)) return prev;
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  }, []);

  const restoreAllTracks = useCallback(() => {
    setMinimized(EMPTY_SET);
  }, []);

  // ─── Auto-minimize ───────────────────────────
  // Tracks that lost their last step and wait for the
  // pointer to move off their row.
  const pendingRef = useRef<Set<TrackId>>(new Set());
  const holdRef = useRef<AutoMinimizeHold>(null);
  const addToMinimized = useCallback((ids: TrackId[]) => {
    setMinimized(prev => {
      if (ids.every(id => prev.has(id))) return prev;
      return new Set([...prev, ...ids]);
    });
  }, []);

  const applyPending = useCallback(() => {
    const hold = holdRef.current;
    if (hold === 'all') return;
    const ready = [...pendingRef.current].filter(
      id => id !== hold
    );
    if (ready.length === 0) return;
    ready.forEach(id => pendingRef.current.delete(id));
    // A track that got a step back stays full.
    const stillEmpty = ready.filter(
      id => isEmptyTrack(tracksRef.current[id])
    );
    if (stillEmpty.length > 0) addToMinimized(stillEmpty);
  }, [addToMinimized]);

  const holdAutoMinimize = useCallback(
    (hold: AutoMinimizeHold) => {
      holdRef.current = hold;
      applyPending();
    },
    [applyPending]
  );

  // Reset opens every row, even with auto-minimize on.
  // Bumped by reset() so the effect below doesn't take
  // the cleared tracks as "lost their last step".
  const [resetSeq, setResetSeq] = useState(0);
  const reset = useCallback(() => {
    setMinimized(EMPTY_SET);
    setResetSeq(n => n + 1);
  }, []);

  const prevTracksRef = useRef(tracks);
  const seenLoadSeqRef = useRef(loadSeq);
  const seenResetSeqRef = useRef(resetSeq);
  const wasAutoRef = useRef(false);
  // A layout effect, so a row minimized at once is
  // never painted full first.
  useLayoutEffect(() => {
    const prevTracks = prevTracksRef.current;
    prevTracksRef.current = tracks;
    const loaded = loadSeq !== seenLoadSeqRef.current;
    seenLoadSeqRef.current = loadSeq;
    const wasReset = resetSeq !== seenResetSeqRef.current;
    seenResetSeqRef.current = resetSeq;
    const turnedOn = autoMinimize && !wasAutoRef.current;
    wasAutoRef.current = autoMinimize;

    if (!autoMinimize || wasReset) {
      pendingRef.current = new Set();
      return;
    }
    // A new pattern, or the setting just turned on:
    // every row may change anyway, so nothing waits.
    if (loaded || turnedOn) {
      pendingRef.current = new Set();
      addToMinimized(emptyTrackIds(tracks));
      return;
    }
    for (const id of MINIMIZABLE) {
      if (
        prevTracks[id] !== tracks[id]
        && !isEmptyTrack(prevTracks[id])
        && isEmptyTrack(tracks[id])
      ) {
        pendingRef.current.add(id);
      }
    }
    applyPending();
  }, [
    tracks, loadSeq, resetSeq, autoMinimize,
    addToMinimized, applyPending,
  ]);

  // H minimizes, Shift+H restores all. ⌘H / Ctrl+H /
  // Alt+H are left to the browser and OS.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyH' || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shouldIgnoreShortcut(e)) return;
      e.preventDefault();
      if (e.shiftKey) {
        restoreAllTracks();
      } else {
        minimizeEmptyTracks();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () =>
      document.removeEventListener(
        'keydown', handleKeyDown
      );
  }, [minimizeEmptyTracks, restoreAllTracks]);

  return {
    minimizedTracks,
    minimizableCount,
    minimizeEmptyTracks,
    restoreTrack,
    restoreAllTracks,
    holdAutoMinimize,
    reset,
  };
}
