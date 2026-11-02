import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import GridContextMenu from '../app/GridContextMenu';
import { TRACK_IDS } from '../app/types';
import type { TrackConfig, TrackId } from '../app/types';

/** What the menu reads from useSequencer(). */
const seq = {
  state: {
    minimizableCount: 0,
    minimizedTracks: new Set<TrackId>(),
    autoMinimize: false,
    customSamples: {} as Record<string, { name: string }>,
    selectedPatternId: 'custom',
  },
  actions: {
    minimizeEmptyTracks: vi.fn(),
    restoreAllTracks: vi.fn(),
    setAutoMinimize: vi.fn(),
    clearAll: vi.fn(),
    resetAllSamples: vi.fn(),
    clearAllConditions: vi.fn(),
    clearAllLocks: vi.fn(),
  },
  meta: {
    config: { tracks: {} as Record<TrackId, TrackConfig> },
  },
};

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => seq,
}));

vi.mock('../app/patternExport', () => ({
  buildPatternEntry: () => ({ id: 'test' }),
  formatPatternEntry: () => 'entry',
}));

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  seq.state.customSamples = {};
  seq.state.minimizableCount = 0;
  seq.state.minimizedTracks = new Set();
  seq.state.autoMinimize = false;
  seq.meta.config.tracks = Object.fromEntries(
    TRACK_IDS.map(id => [id, { steps: '1000' }])
  ) as Record<TrackId, TrackConfig>;
  Object.values(seq.actions).forEach(fn => fn.mockClear());
  writeText.mockReset();
  writeText.mockImplementation(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

function renderMenu() {
  const onClose = vi.fn();
  render(
    <GridContextMenu x={10} y={10} onClose={onClose} />
  );
  return { onClose };
}

describe('GridContextMenu track items', () => {
  it('disables Minimize and Restore with nothing to do', () => {
    seq.state.minimizableCount = 0;
    seq.state.minimizedTracks = new Set();
    renderMenu();
    expect(screen.getByRole('menuitem', {
      name: /Minimize empty tracks/,
    })).toBeDisabled();
    expect(screen.getByRole('menuitem', {
      name: /Restore all tracks/,
    })).toBeDisabled();
  });

  it('minimizes, restores and resets through the sequencer', () => {
    seq.state.minimizableCount = 2;
    seq.state.minimizedTracks = new Set<TrackId>(['sd']);
    const { onClose } = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', {
      name: /Minimize empty tracks/,
    }));
    expect(seq.actions.minimizeEmptyTracks)
      .toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('menuitem', {
      name: /Restore all tracks/,
    }));
    expect(seq.actions.restoreAllTracks)
      .toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Reset pattern',
    }));
    expect(seq.actions.clearAll).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('toggles the auto-minimize setting', () => {
    seq.state.autoMinimize = true;
    renderMenu();
    const item = screen.getByRole('menuitemcheckbox', {
      name: 'Auto-minimize empty tracks',
    });
    expect(item).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(item);
    expect(seq.actions.setAutoMinimize)
      .toHaveBeenCalledWith(false);
  });
});

describe('GridContextMenu samples item', () => {
  it('is absent when no track is custom', () => {
    renderMenu();
    expect(screen.queryByRole('menuitem', {
      name: 'Reset all samples to kit',
    })).toBeNull();
  });

  it('resets every sample and closes', () => {
    seq.state.customSamples = { bd: { name: 'kick.wav' } };
    const props = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Reset all samples to kit',
    }));
    expect(seq.actions.resetAllSamples).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('GridContextMenu Copy pattern', () => {
  it('copies, shows Copied, then closes', async () => {
    vi.useFakeTimers();
    try {
      const props = renderMenu();
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', {
          name: /Copy pattern/,
        }));
      });
      expect(writeText).toHaveBeenCalledWith('entry');
      expect(screen.getByRole('status'))
        .toHaveTextContent('Copied');
      expect(props.onClose).not.toHaveBeenCalled();
      act(() => {
        vi.runAllTimers();
      });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows Failed when the clipboard refuses', async () => {
    writeText.mockImplementation(
      () => Promise.reject(new Error())
    );
    renderMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', {
        name: /Copy pattern/,
      }));
    });
    expect(screen.getByRole('status'))
      .toHaveTextContent('Failed');
  });
});

describe('GridContextMenu conditions and locks', () => {
  it('disables both when there is nothing to clear', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', {
      name: 'Reset trig conditions',
    })).toBeDisabled();
    expect(screen.getByRole('menuitem', {
      name: 'Clear parameter locks',
    })).toBeDisabled();
  });

  it('resets trig conditions and closes', () => {
    seq.meta.config.tracks.sd = {
      steps: '1000', trigConditions: { 0: { fill: 'fill' } },
    };
    const props = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Reset trig conditions',
    }));
    expect(seq.actions.clearAllConditions).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('clears parameter locks and closes', () => {
    seq.meta.config.tracks.sd = {
      steps: '1000', parameterLocks: { 0: { gain: 0.5 } },
    };
    const props = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Clear parameter locks',
    }));
    expect(seq.actions.clearAllLocks).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
