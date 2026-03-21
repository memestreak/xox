import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  TooltipProvider,
  useTooltips,
} from '../app/TooltipContext';

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

function TestConsumer() {
  const { tooltipsEnabled, setTooltipsEnabled } =
    useTooltips();
  return (
    <div>
      <span data-testid="status">
        {String(tooltipsEnabled)}
      </span>
      <button
        onClick={() =>
          setTooltipsEnabled(!tooltipsEnabled)
        }
      >
        toggle
      </button>
    </div>
  );
}

describe('TooltipContext', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults to enabled', () => {
    render(
      <TooltipProvider>
        <TestConsumer />
      </TooltipProvider>
    );
    expect(
      screen.getByTestId('status').textContent
    ).toBe('true');
  });

  it('reads false from localStorage', () => {
    store['xox-tooltips'] = 'false';
    render(
      <TooltipProvider>
        <TestConsumer />
      </TooltipProvider>
    );
    expect(
      screen.getByTestId('status').textContent
    ).toBe('false');
  });

  it('writes to localStorage on toggle', () => {
    render(
      <TooltipProvider>
        <TestConsumer />
      </TooltipProvider>
    );
    act(() => {
      screen.getByText('toggle').click();
    });
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'xox-tooltips', 'false'
    );
    expect(
      screen.getByTestId('status').textContent
    ).toBe('false');
  });
});
