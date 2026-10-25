import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMinimizedTracks } from '../../app/hooks/useMinimizedTracks';
import { TRACK_IDS } from '../../app/types';
import type { TrackConfig, TrackId } from '../../app/types';

/** Every track empty except the ones given steps. */
function makeTracks(
  withSteps: TrackId[] = []
): Record<TrackId, TrackConfig> {
  const tracks = {} as Record<TrackId, TrackConfig>;
  for (const id of TRACK_IDS) {
    tracks[id] = {
      steps: withSteps.includes(id)
        ? '1000100010001000' : '0'.repeat(16),
    };
  }
  return tracks;
}

function setup(initial = makeTracks(['bd', 'oh'])) {
  return renderHook(
    ({ tracks }) => useMinimizedTracks({ tracks }),
    { initialProps: { tracks: initial } }
  );
}

function pressH(init: KeyboardEventInit = {}, target: EventTarget = document) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyH', key: init.shiftKey ? 'H' : 'h',
      bubbles: true, ...init,
    }));
  });
}

const sorted = (s: ReadonlySet<TrackId>) => [...s].sort();

describe('useMinimizedTracks', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts with nothing minimized', () => {
    const { result } = setup();
    expect(result.current.minimizedTracks.size).toBe(0);
    expect(result.current.minimizableCount).toBe(9);
  });

  it('minimize takes only empty tracks, never AC', () => {
    const { result } = setup();
    act(() => result.current.minimizeEmptyTracks());
    expect(sorted(result.current.minimizedTracks)).toEqual(
      ['cb', 'ch', 'cp', 'cy', 'ht', 'lt', 'mt', 'rs', 'sd']
    );
    expect(result.current.minimizedTracks.has('ac'))
      .toBe(false);
    expect(result.current.minimizableCount).toBe(0);
  });

  it('restores one track', () => {
    const { result } = setup();
    act(() => result.current.minimizeEmptyTracks());
    act(() => result.current.restoreTrack('sd'));
    expect(result.current.minimizedTracks.has('sd'))
      .toBe(false);
    expect(result.current.minimizedTracks.size).toBe(8);
    expect(result.current.minimizableCount).toBe(1);
  });

  it('restores all tracks', () => {
    const { result } = setup();
    act(() => result.current.minimizeEmptyTracks());
    act(() => result.current.restoreAllTracks());
    expect(result.current.minimizedTracks.size).toBe(0);
  });

  it('reset() empties the set', () => {
    const { result } = setup();
    act(() => result.current.minimizeEmptyTracks());
    act(() => result.current.reset());
    expect(result.current.minimizedTracks.size).toBe(0);
  });

  it('a track that gains steps leaves the set for good',
    () => {
      const { result, rerender } = setup();
      act(() => result.current.minimizeEmptyTracks());

      rerender({ tracks: makeTracks(['bd', 'oh', 'sd']) });
      expect(result.current.minimizedTracks.has('sd'))
        .toBe(false);

      // Emptied again: stays full until minimize runs.
      rerender({ tracks: makeTracks(['bd', 'oh']) });
      expect(result.current.minimizedTracks.has('sd'))
        .toBe(false);
      expect(result.current.minimizableCount).toBe(1);
    });

  it('a pattern load keeps still-empty tracks minimized',
    () => {
      const { result, rerender } = setup();
      act(() => result.current.minimizeEmptyTracks());
      // New pattern: SD gains steps, BD becomes empty.
      rerender({ tracks: makeTracks(['sd', 'oh']) });
      const shown = result.current.minimizedTracks;
      expect(shown.has('sd')).toBe(false);
      expect(shown.has('ch')).toBe(true);
      expect(shown.has('cb')).toBe(true);
      // Newly empty BD stays full.
      expect(shown.has('bd')).toBe(false);
      expect(result.current.minimizableCount).toBe(1);
    });

  it('a full track that becomes empty is not minimized',
    () => {
      const { result, rerender } = setup();
      act(() => result.current.minimizeEmptyTracks());
      rerender({ tracks: makeTracks(['oh']) });
      expect(result.current.minimizedTracks.has('bd'))
        .toBe(false);
    });

  it('keeps stable action identities', () => {
    const { result, rerender } = setup();
    const first = result.current;
    act(() => result.current.minimizeEmptyTracks());
    rerender({ tracks: makeTracks(['bd']) });
    expect(result.current.minimizeEmptyTracks)
      .toBe(first.minimizeEmptyTracks);
    expect(result.current.restoreTrack)
      .toBe(first.restoreTrack);
    expect(result.current.restoreAllTracks)
      .toBe(first.restoreAllTracks);
  });

  describe('H / Shift+H', () => {
    it('H minimizes and Shift+H restores all', () => {
      const { result } = setup();
      pressH();
      expect(result.current.minimizedTracks.size).toBe(9);
      pressH({ shiftKey: true });
      expect(result.current.minimizedTracks.size).toBe(0);
    });

    it('ignores ⌘, Ctrl and Alt', () => {
      const { result } = setup();
      pressH({ metaKey: true });
      pressH({ ctrlKey: true });
      pressH({ altKey: true });
      expect(result.current.minimizedTracks.size).toBe(0);
    });

    it('ignores key repeat', () => {
      const { result } = setup();
      pressH({ repeat: true });
      expect(result.current.minimizedTracks.size).toBe(0);
    });

    it('ignores typing in a text field', () => {
      const { result } = setup();
      const input = document.createElement('input');
      document.body.appendChild(input);
      pressH({}, input);
      expect(result.current.minimizedTracks.size).toBe(0);
    });

    it('ignores the key while a dialog is open', () => {
      const { result } = setup();
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      document.body.appendChild(dialog);
      pressH();
      expect(result.current.minimizedTracks.size).toBe(0);
    });
  });
  describe('auto-minimize', () => {
    interface Props {
      tracks: Record<TrackId, TrackConfig>;
      autoMinimize: boolean;
      loadSeq: number;
    }

    function setupAuto(initial: Partial<Props> = {}) {
      return renderHook(
        (props: Props) => useMinimizedTracks(props),
        {
          initialProps: {
            tracks: makeTracks(['bd', 'oh']),
            autoMinimize: true,
            loadSeq: 0,
            ...initial,
          },
        }
      );
    }

    it('does nothing while the setting is off', () => {
      const { result, rerender } = setupAuto({
        autoMinimize: false,
      });
      expect(result.current.minimizedTracks.size).toBe(0);
      rerender({
        tracks: makeTracks(['oh']),
        autoMinimize: false, loadSeq: 0,
      });
      expect(result.current.minimizedTracks.size).toBe(0);
    });

    it('minimizes every empty track when turned on', () => {
      const tracks = makeTracks(['bd', 'oh']);
      const { result, rerender } = setupAuto({
        tracks, autoMinimize: false,
      });
      rerender({ tracks, autoMinimize: true, loadSeq: 0 });
      expect(result.current.minimizedTracks.size).toBe(9);
    });

    it('minimizes a track that loses its last step', () => {
      const tracks = makeTracks(['bd', 'oh']);
      const { result, rerender } = setupAuto({ tracks });
      act(() => result.current.restoreAllTracks());
      rerender({
        tracks: { ...tracks, bd: { steps: '0'.repeat(16) } },
        autoMinimize: true, loadSeq: 0,
      });
      expect(sorted(result.current.minimizedTracks))
        .toEqual(['bd']);
    });

    it('leaves a restored empty track alone after edits', () => {
      const tracks = makeTracks(['bd', 'oh']);
      const { result, rerender } = setupAuto({ tracks });
      act(() => result.current.restoreTrack('sd'));
      rerender({
        tracks: { ...tracks, oh: { steps: '1'.repeat(16) } },
        autoMinimize: true, loadSeq: 0,
      });
      expect(result.current.minimizedTracks.has('sd'))
        .toBe(false);
      expect(result.current.minimizedTracks.size).toBe(8);
    });

    it('minimizes every empty track on a pattern load', () => {
      const tracks = makeTracks(['bd', 'oh']);
      const { result, rerender } = setupAuto({ tracks });
      act(() => result.current.restoreAllTracks());
      // Same tracks object: reloading the same preset.
      rerender({ tracks, autoMinimize: true, loadSeq: 1 });
      expect(result.current.minimizedTracks.size).toBe(9);
    });

    it('reset opens every row, even when tracks empty', () => {
      const { result, rerender } = setupAuto();
      expect(result.current.minimizedTracks.size).toBe(9);
      // clearAll empties the tracks and resets in one
      // batch.
      act(() => {
        result.current.reset();
        rerender({
          tracks: makeTracks([]),
          autoMinimize: true, loadSeq: 0,
        });
      });
      expect(result.current.minimizedTracks.size).toBe(0);
    });
  });
});
