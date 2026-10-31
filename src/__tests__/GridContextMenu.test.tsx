import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GridContextMenu from '../app/GridContextMenu';

function renderMenu(overrides = {}) {
  const props = {
    x: 10,
    y: 10,
    canMinimize: false,
    canRestore: false,
    onMinimize: vi.fn(),
    onRestoreAll: vi.fn(),
    autoMinimize: false,
    onSetAutoMinimize: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
    hasCustomSamples: false,
    onResetAllSamples: vi.fn(),
    onCopyPattern: vi.fn(() => Promise.resolve()),
    hasConditions: false,
    onResetConditions: vi.fn(),
    hasLocks: false,
    onClearLocks: vi.fn(),
    ...overrides,
  };
  render(<GridContextMenu {...props} />);
  return props;
}

describe('GridContextMenu samples item', () => {
  it('is absent when no track is custom', () => {
    renderMenu();
    expect(screen.queryByRole('menuitem', {
      name: 'Reset all samples to kit',
    })).toBeNull();
  });

  it('resets every sample and closes', () => {
    const props = renderMenu({ hasCustomSamples: true });
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Reset all samples to kit',
    }));
    expect(props.onResetAllSamples).toHaveBeenCalledTimes(1);
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
      expect(props.onCopyPattern).toHaveBeenCalledTimes(1);
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
    renderMenu({
      onCopyPattern: vi.fn(() => Promise.reject(new Error())),
    });
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
    const props = renderMenu({ hasConditions: true });
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Reset trig conditions',
    }));
    expect(props.onResetConditions).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('clears parameter locks and closes', () => {
    const props = renderMenu({ hasLocks: true });
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Clear parameter locks',
    }));
    expect(props.onClearLocks).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
