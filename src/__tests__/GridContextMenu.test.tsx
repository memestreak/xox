import { fireEvent, render, screen } from '@testing-library/react';
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
