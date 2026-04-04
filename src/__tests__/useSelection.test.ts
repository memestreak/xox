import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach }
  from 'vitest';
import { useSelection } from '../app/hooks/useSelection';
import type { TrackConfig, TrackId } from '../app/types';
import type { RefObject } from 'react';

function makeTracks(
  len = 16
): Record<TrackId, TrackConfig> {
  const ids: TrackId[] = [
    'bd', 'sd', 'ch', 'oh', 'cy',
    'ht', 'mt', 'lt', 'rs', 'cp', 'cb',
  ];
  const tracks = {} as Record<TrackId, TrackConfig>;
  for (const id of ids) {
    tracks[id] = { steps: '0'.repeat(len) };
  }
  // Add accent track (not in selectable order)
  tracks.ac = { steps: '0'.repeat(len) };
  return tracks;
}

const TRACK_ORDER: TrackId[] = [
  'bd', 'sd', 'ch', 'oh', 'cy',
  'ht', 'mt', 'lt', 'rs', 'cp', 'cb',
];

function setup(overrides?: {
  tracks?: Record<TrackId, TrackConfig>;
  popoverOpen?: boolean;
}) {
  const mockSetStep = vi.fn();
  const mockClearTrig = vi.fn();
  const mockClearLock = vi.fn();
  const popoverOpenRef = {
    current: overrides?.popoverOpen ?? false,
  } as RefObject<boolean>;

  const result = renderHook(() =>
    useSelection({
      trackOrder: TRACK_ORDER,
      tracks: overrides?.tracks ?? makeTracks(),
      popoverOpenRef,
      setStep: mockSetStep,
      clearTrigCondition: mockClearTrig,
      clearParameterLock: mockClearLock,
    })
  );

  return {
    ...result,
    mockSetStep,
    mockClearTrig,
    mockClearLock,
    popoverOpenRef,
  };
}

describe('useSelection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ctrlClickCell', () => {
    it('selects a single cell', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      expect(result.current.selected.has('bd:3'))
        .toBe(true);
      expect(result.current.selected.size).toBe(1);
    });

    it('toggles a cell out of selection', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => result.current.ctrlClickCell('bd', 3));
      expect(result.current.selected.has('bd:3'))
        .toBe(false);
      expect(result.current.selected.size).toBe(0);
    });

    it('adds multiple cells to selection', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => result.current.ctrlClickCell('sd', 5));
      expect(result.current.selected.size).toBe(2);
      expect(result.current.selected.has('bd:3'))
        .toBe(true);
      expect(result.current.selected.has('sd:5'))
        .toBe(true);
    });
  });

  describe('shiftClickCell', () => {
    it('selects single cell when no anchor', () => {
      const { result } = setup();
      act(() =>
        result.current.shiftClickCell('bd', 3)
      );
      expect(result.current.selected.size).toBe(1);
      expect(result.current.selected.has('bd:3'))
        .toBe(true);
    });

    it('fills rectangle from anchor', () => {
      const { result } = setup();
      // Set anchor via ctrlClick
      act(() => result.current.ctrlClickCell('bd', 1));
      // Extend to sd:3 — should create 2 tracks x 3
      // steps = 6 cells
      act(() =>
        result.current.shiftClickCell('sd', 3)
      );
      expect(result.current.selected.size).toBe(6);
      for (const tid of ['bd', 'sd'] as TrackId[]) {
        for (let s = 1; s <= 3; s++) {
          expect(
            result.current.selected.has(`${tid}:${s}`)
          ).toBe(true);
        }
      }
    });

    it('skips disabled steps beyond track length', () => {
      const tracks = makeTracks(16);
      // Make sd only 4 steps long
      tracks.sd = { steps: '0000' };
      const { result } = setup({ tracks });

      act(() => result.current.ctrlClickCell('bd', 0));
      // Extend to sd:7 — bd has 16 steps (all valid),
      // sd has 4 steps (only 0-3 valid)
      act(() =>
        result.current.shiftClickCell('sd', 7)
      );
      // bd: steps 0-7 = 8 cells
      // sd: steps 0-3 = 4 cells (4-7 skipped)
      expect(result.current.selected.size).toBe(12);
      expect(result.current.selected.has('sd:5'))
        .toBe(false);
    });
  });

  describe('rectangle drag', () => {
    it('startRectDrag + updateRectDrag computes rect',
      () => {
        const { result } = setup();
        act(() =>
          result.current.startRectDrag('bd', 2)
        );
        expect(result.current.selected.size).toBe(1);

        act(() =>
          result.current.updateRectDrag('ch', 5)
        );
        // bd, sd, ch x steps 2-5 = 3 tracks * 4 = 12
        expect(result.current.selected.size).toBe(12);
      }
    );

    it('replaces selection on each update', () => {
      const { result } = setup();
      act(() =>
        result.current.startRectDrag('bd', 0)
      );
      act(() =>
        result.current.updateRectDrag('sd', 3)
      );
      const size1 = result.current.selected.size;
      act(() =>
        result.current.updateRectDrag('bd', 1)
      );
      // Shrunk to bd only, steps 0-1 = 2 cells
      expect(result.current.selected.size)
        .toBeLessThan(size1);
      expect(result.current.selected.size).toBe(2);
    });
  });

  describe('clearSelection', () => {
    it('empties selection and anchor', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => result.current.clearSelection());
      expect(result.current.selected.size).toBe(0);
    });
  });

  describe('deleteSelected', () => {
    it('calls setStep, clearTrigCondition, and '
      + 'clearParameterLock for each cell', () => {
      const {
        result, mockSetStep, mockClearTrig,
        mockClearLock,
      } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => result.current.ctrlClickCell('sd', 5));
      act(() => result.current.deleteSelected());

      expect(mockSetStep).toHaveBeenCalledWith(
        'bd', 3, '0'
      );
      expect(mockSetStep).toHaveBeenCalledWith(
        'sd', 5, '0'
      );
      expect(mockClearTrig).toHaveBeenCalledWith(
        'bd', 3
      );
      expect(mockClearTrig).toHaveBeenCalledWith(
        'sd', 5
      );
      expect(mockClearLock).toHaveBeenCalledWith(
        'bd', 3
      );
      expect(mockClearLock).toHaveBeenCalledWith(
        'sd', 5
      );
    });

    it('clears selection after deleting', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => result.current.deleteSelected());
      expect(result.current.selected.size).toBe(0);
    });

    it('is a no-op when selection is empty', () => {
      const { result, mockSetStep } = setup();
      act(() => result.current.deleteSelected());
      expect(mockSetStep).not.toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('Escape clears selection', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
          })
        );
      });
      expect(result.current.selected.size).toBe(0);
    });

    it('Escape does not clear when popover open', () => {
      const { result, popoverOpenRef } = setup({
        popoverOpen: true,
      });
      act(() => result.current.ctrlClickCell('bd', 3));
      popoverOpenRef.current = true;
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
          })
        );
      });
      expect(result.current.selected.size).toBe(1);
    });

    it('Delete triggers deleteSelected', () => {
      const { result, mockSetStep } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Delete',
          })
        );
      });
      expect(mockSetStep).toHaveBeenCalledWith(
        'bd', 3, '0'
      );
      expect(result.current.selected.size).toBe(0);
    });

    it('Backspace triggers deleteSelected', () => {
      const { result, mockSetStep } = setup();
      act(() => result.current.ctrlClickCell('sd', 7));
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Backspace',
          })
        );
      });
      expect(mockSetStep).toHaveBeenCalledWith(
        'sd', 7, '0'
      );
    });

    it('Delete is no-op when selection empty', () => {
      const { mockSetStep } = setup();
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Delete',
          })
        );
      });
      expect(mockSetStep).not.toHaveBeenCalled();
    });

    it('Delete is no-op when target is input', () => {
      const { result, mockSetStep } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      act(() => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Delete',
            bubbles: true,
          })
        );
      });
      expect(mockSetStep).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('selectedByTrack', () => {
    it('groups by track', () => {
      const { result } = setup();
      act(() => result.current.ctrlClickCell('bd', 3));
      act(() => result.current.ctrlClickCell('bd', 7));
      act(() => result.current.ctrlClickCell('sd', 1));

      const byTrack = result.current.selectedByTrack;
      expect(byTrack.get('bd')?.has(3)).toBe(true);
      expect(byTrack.get('bd')?.has(7)).toBe(true);
      expect(byTrack.get('sd')?.has(1)).toBe(true);
      expect(byTrack.has('ch')).toBe(false);
    });
  });
});
