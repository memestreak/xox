import {
  useCallback, useEffect, useMemo, useRef, useState,
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

interface UseMinimizedTracksOptions {
  tracks: Record<TrackId, TrackConfig>;
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
  reset: () => void;
}

/**
 * Which grid rows are minimized. A view setting only:
 * it is not part of SequencerConfig, so share links,
 * autosave and Reset's pattern data never see it.
 *
 * Minimizing is a one-off tidy-up. A track that gains
 * steps drops out of the set and stays full until
 * minimize runs again. A track that becomes empty is
 * never minimized on its own. Owns the H / Shift+H
 * shortcuts (listed in helpContent.ts).
 */
export function useMinimizedTracks({
  tracks,
}: UseMinimizedTracksOptions): UseMinimizedTracksReturn {
  const [minimized, setMinimized] =
    useState<ReadonlySet<TrackId>>(EMPTY_SET);

  // Read by the stable minimize callback.
  const tracksRef = useRef(tracks);
  useEffect(() => {
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
    reset: restoreAllTracks,
  };
}
