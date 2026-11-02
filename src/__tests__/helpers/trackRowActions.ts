import { vi } from 'vitest';
import type { TrackRowActions } from '../../app/TrackRow';

/**
 * Every action a TrackRow uses, as a vi.fn() unless
 * `overrides` gives one.
 */
export function fakeTrackRowActions(
  overrides: Partial<TrackRowActions> = {}
): TrackRowActions {
  return {
    toggleStep: vi.fn(),
    toggleMute: vi.fn(),
    toggleSolo: vi.fn(),
    setGain: vi.fn(),
    setPan: vi.fn(),
    setTrackLength: vi.fn(),
    toggleFreeRun: vi.fn(),
    clearTrack: vi.fn(),
    clearTrackConditions: vi.fn(),
    clearTrackLocks: vi.fn(),
    restoreTrack: vi.fn(),
    loadSample: vi.fn(() => Promise.resolve()),
    resetSample: vi.fn(),
    toggleSample: vi.fn(),
    ...overrides,
  };
}
