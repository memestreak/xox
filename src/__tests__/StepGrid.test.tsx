import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import StepGrid from '../app/StepGrid';
import { TestWrapper } from './helpers/sequencer-wrapper';
import React from 'react';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    requestReset: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getOutputTime: vi.fn().mockReturnValue(0),
    onStep: vi.fn(),
  },
}));

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    sendNote: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    init: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({
      enabled: false,
    }),
    getOutputs: vi.fn().mockReturnValue([]),
    setOnDeviceChange: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

beforeEach(() => {
  Element.prototype.setPointerCapture =
    vi.fn() as never;
  Element.prototype.releasePointerCapture =
    vi.fn() as never;
  // jsdom lacks elementFromPoint
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
});

function renderGrid(pageOffset = 0) {
  const scrollRef = React.createRef<HTMLDivElement>();
  const setPage = vi.fn();
  return render(
    <TestWrapper>
      <div ref={scrollRef}>
        <StepGrid
          scrollContainerRef={scrollRef}
          pageOffset={pageOffset}
          autoFollow={true}
          setPage={setPage}
        />
      </div>
    </TestWrapper>
  );
}

describe('StepGrid', () => {
  it('lets vertical swipes scroll the page', () => {
    renderGrid();
    const container = document.querySelector<HTMLElement>(
      '[data-track="bd"]'
    )!.closest<HTMLElement>('.select-none')!;
    expect(container.style.touchAction).toBe('pan-y');
    // No long-press: the swipe is left to the browser.
    const ev = new Event('touchmove', {
      bubbles: true, cancelable: true,
    });
    container.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('renders 11 track rows (excludes accent)', () => {
    renderGrid();
    // Each track row has a data-track attribute
    // 11 tracks: bd, sd, ch, oh, cy, ht, mt, lt,
    // rs, cp, cb
    const trackDivs = document.querySelectorAll(
      '[data-track]'
    );
    // 11 tracks + 1 accent = 12 data-track elements
    expect(trackDivs.length).toBe(12);
  });

  it('renders step buttons', () => {
    renderGrid();
    // Each track has 16 steps, there are 12 tracks
    // (11 + accent). Look for some step buttons.
    const steps = screen.getAllByRole('button', {
      name: /step \d+/i,
    });
    expect(steps.length).toBeGreaterThan(0);
  });

  it('renders accent row', () => {
    renderGrid();
    const accentTrack = document.querySelector(
      '[data-track="ac"]'
    );
    expect(accentTrack).toBeInTheDocument();
  });

  it('renders with page offset 0', () => {
    renderGrid(0);
    // Should render normally without errors
    const trackDivs = document.querySelectorAll(
      '[data-track]'
    );
    expect(trackDivs.length).toBe(12);
  });

  describe('outside press clears the selection', () => {
    function pressOn(target: Element) {
      // jsdom has no PointerEvent constructor
      act(() => {
        target.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true, button: 0,
        }));
      });
    }

    function selectFirstKick() {
      const step = screen.getByRole('button', {
        name: 'BD step 1',
      });
      fireEvent.click(step, { ctrlKey: true });
      return step;
    }

    it('clears on a press outside the grid', () => {
      renderGrid();
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      const step = selectFirstKick();
      expect(step.className).toContain('ring-2');
      pressOn(outside);
      expect(step.className).not.toContain('ring-2');
      outside.remove();
    });

    it('keeps it on a press inside the grid', () => {
      renderGrid();
      const step = selectFirstKick();
      pressOn(screen.getByRole('button', {
        name: 'SD step 5',
      }));
      expect(step.className).toContain('ring-2');
    });
  });

  describe('minimize empty tracks', () => {
    // The default pattern (House 01) has steps on BD, OH
    // and CP only.
    function openGridMenu() {
      const gap = document.querySelector<HTMLElement>(
        '[data-track="bd"]'
      )!.closest<HTMLElement>('.select-none')!;
      fireEvent.contextMenu(gap, { clientX: 50, clientY: 50 });
    }

    function minimize() {
      openGridMenu();
      fireEvent.click(screen.getByRole('menuitem', {
        name: /minimize empty tracks/i,
      }));
    }

    const minimizedNames = () => [
      ...document.querySelectorAll<HTMLElement>(
        '[data-minimized]'
      ),
    ].map(el => el.dataset.minimized);

    it('right-click on a gap opens the grid menu', () => {
      renderGrid();
      openGridMenu();
      expect(screen.getByRole('menu', {
        name: 'Grid options',
      })).toBeInTheDocument();
      // Each item shows its shortcut, not a count
      const minimize = screen.getByRole('menuitem', {
        name: 'Minimize empty tracks',
      });
      expect(minimize).toHaveTextContent(/^Minimize empty tracksH$/);
      expect(minimize).toHaveAttribute('aria-keyshortcuts', 'H');
      const restore = screen.getByRole('menuitem', {
        name: 'Restore all tracks',
      });
      expect(restore).toHaveTextContent(/^Restore all tracks⇧H$/);
      expect(restore)
        .toHaveAttribute('aria-keyshortcuts', 'Shift+H');
      expect(restore).toBeDisabled();
    });

    it('the menu toggles auto-minimize', () => {
      renderGrid();
      openGridMenu();
      const item = screen.getByRole('menuitemcheckbox', {
        name: 'Auto-minimize empty tracks',
      });
      expect(item).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(item);
      // Turning it on minimizes the empty tracks now
      expect(minimizedNames()).toEqual(
        ['SD', 'CH', 'CY', 'HT', 'MT', 'LT', 'RS', 'CB']
      );
      openGridMenu();
      expect(screen.getByRole('menuitemcheckbox', {
        name: 'Auto-minimize empty tracks',
      })).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(screen.getByRole('menuitemcheckbox', {
        name: 'Auto-minimize empty tracks',
      }));
    });

    it('right-click on a step or knob does not', () => {
      renderGrid();
      fireEvent.contextMenu(screen.getByRole('button', {
        name: 'BD step 1',
      }));
      fireEvent.contextMenu(
        screen.getAllByRole('slider')[0]
      );
      expect(screen.queryByRole('menu', {
        name: 'Grid options',
      })).not.toBeInTheDocument();
    });

    it('Escape closes the menu', () => {
      renderGrid();
      openGridMenu();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu', {
        name: 'Grid options',
      })).not.toBeInTheDocument();
    });

    it('choosing Minimize renders minimized rows', () => {
      renderGrid();
      minimize();
      expect(screen.queryByRole('menu', {
        name: 'Grid options',
      })).not.toBeInTheDocument();
      expect(minimizedNames()).toEqual(
        ['SD', 'CH', 'CY', 'HT', 'MT', 'LT', 'RS', 'CB']
      );
      expect(screen.queryByRole('button', {
        name: 'SD step 1',
      })).not.toBeInTheDocument();
      // Full rows and the accent row are unchanged
      expect(screen.getByRole('button', {
        name: 'BD step 1',
      })).toBeInTheDocument();
      expect(
        document.querySelector('[data-track="ac"]')
      ).not.toBeNull();
    });

    it('the caret restores one track', () => {
      renderGrid();
      minimize();
      fireEvent.click(screen.getByRole('button', {
        name: 'Restore SD',
      }));
      expect(minimizedNames()).not.toContain('SD');
      expect(screen.getByRole('button', {
        name: 'SD step 1',
      })).toBeInTheDocument();
      // No caret on the restored row
      expect(screen.queryByRole('button', {
        name: 'Restore SD',
      })).not.toBeInTheDocument();
    });

    it('the ⋯ key opens and closes the grid menu', () => {
      renderGrid();
      const key = screen.getByRole('button', {
        name: 'Grid options',
      });
      expect(key).toHaveAttribute('aria-haspopup', 'menu');
      expect(key).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(key);
      expect(screen.getByRole('menu', {
        name: 'Grid options',
      })).toBeInTheDocument();
      expect(key).toHaveAttribute('aria-expanded', 'true');
      // A press on the key is not an outside press, so
      // its click closes the menu rather than reopening it.
      act(() => {
        key.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true, button: 0,
        }));
      });
      fireEvent.click(key);
      expect(screen.queryByRole('menu', {
        name: 'Grid options',
      })).not.toBeInTheDocument();
    });

    it('Reset pattern clears every step', () => {
      renderGrid();
      expect(screen.getByRole('button', { name: 'BD step 1' }))
        .toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', {
        name: 'Grid options',
      }));
      fireEvent.click(screen.getByRole('menuitem', {
        name: 'Reset pattern',
      }));
      expect(screen.queryByRole('menu', {
        name: 'Grid options',
      })).not.toBeInTheDocument();
      const on = screen.getAllByRole('button', {
        name: /step \d+/i,
      }).filter(
        b => b.getAttribute('aria-pressed') === 'true'
      );
      expect(on).toEqual([]);
    });

    it('Restore all tracks brings every row back', () => {
      renderGrid();
      minimize();
      openGridMenu();
      fireEvent.click(screen.getByRole('menuitem', {
        name: /restore all tracks/i,
      }));
      expect(minimizedNames()).toEqual([]);
    });

    it('minimizing clears the selection', () => {
      renderGrid();
      const step = screen.getByRole('button', {
        name: 'BD step 1',
      });
      fireEvent.click(step, { ctrlKey: true });
      expect(step.className).toContain('ring-2');
      minimize();
      expect(screen.getByRole('button', {
        name: 'BD step 1',
      }).className).not.toContain('ring-2');
    });

    it('a drag across a minimized row leaves it untouched',
      () => {
        renderGrid();
        minimize();
        const container = document.querySelector<HTMLElement>(
          '[data-track="bd"]'
        )!.closest<HTMLElement>('.select-none')!;
        // y=0 → BD row, y=100 → OH row; SD and CH sit
        // minimized between them.
        const cellAt = (track: string, step: number) =>
          document.querySelector(
            `[data-track="${track}"] [data-step="${step}"]`
          );
        const original = document.elementFromPoint;
        document.elementFromPoint = ((_x: number, y: number) =>
          y < 50 ? cellAt('bd', 1) : cellAt('oh', 1)
        ) as typeof document.elementFromPoint;
        try {
          const opts = {
            button: 0, pointerId: 1, pointerType: 'mouse',
            clientX: 10,
          };
          fireEvent.pointerDown(container, {
            ...opts, clientY: 0,
          });
          fireEvent.pointerMove(container, {
            ...opts, clientY: 100,
          });
          fireEvent.pointerUp(container, {
            ...opts, clientY: 100,
          });
        } finally {
          document.elementFromPoint = original;
        }
        // Painting SD or CH would have opened them
        expect(minimizedNames()).toContain('SD');
        expect(minimizedNames()).toContain('CH');
        // ...and the drag did reach OH
        expect(screen.getByRole('button', {
          name: 'OH step 2',
        })).toHaveAttribute('aria-pressed', 'true');
      });
  });
});
