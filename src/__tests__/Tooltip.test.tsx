import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import Tooltip from '../app/Tooltip';
import { TooltipProvider } from '../app/TooltipContext';

const store: Record<string, string> = {};

const mockStorage = {
  getItem: vi.fn(
    (key: string) => store[key] ?? null
  ),
  setItem: vi.fn(
    (key: string, value: string) => {
      store[key] = value;
    }
  ),
  removeItem: vi.fn(
    (key: string) => { delete store[key]; }
  ),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
  length: 0,
  key: vi.fn(() => null),
};

Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true,
});

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <TooltipProvider>{ui}</TooltipProvider>
  );
}

describe('Tooltip', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('renders tooltip text when key exists', () => {
    renderWithProvider(
      <Tooltip tooltipKey="play">
        <button>Play</button>
      </Tooltip>
    );
    expect(
      screen.getByRole('tooltip')
    ).toHaveTextContent('Start / stop playback');
  });

  it('renders no tooltip when key is absent', () => {
    renderWithProvider(
      <Tooltip tooltipKey="nonexistent">
        <button>X</button>
      </Tooltip>
    );
    expect(
      screen.queryByRole('tooltip')
    ).toBeNull();
  });

  it('renders no tooltip when disabled', () => {
    store['xox-tooltips'] = 'false';
    renderWithProvider(
      <Tooltip tooltipKey="play">
        <button>Play</button>
      </Tooltip>
    );
    expect(
      screen.queryByRole('tooltip')
    ).toBeNull();
  });

  it('sets aria-describedby on child', () => {
    renderWithProvider(
      <Tooltip tooltipKey="play">
        <button>Play</button>
      </Tooltip>
    );
    const button = screen.getByRole('button');
    const tooltip = screen.getByRole('tooltip');
    expect(
      button.getAttribute('aria-describedby')
    ).toBe(tooltip.id);
  });

  it('has 500ms delay classes', () => {
    renderWithProvider(
      <Tooltip tooltipKey="play">
        <button>Play</button>
      </Tooltip>
    );
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toContain(
      'group-hover/tooltip:[transition-delay:750ms]'
    );
  });
});
