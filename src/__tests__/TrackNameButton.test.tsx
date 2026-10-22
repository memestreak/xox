import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackNameButton from '../app/TrackNameButton';
import type { TrackId } from '../app/types';

function renderButton(overrides = {}) {
  const props = {
    size: 'lg' as const,
    trackId: 'sd' as TrackId,
    trackName: 'SD',
    isFreeRun: false,
    isTriggered: false,
    onToggleFreeRun: vi.fn(),
    onClearTrack: vi.fn(),
    onPlayPreview: vi.fn(),
    ...overrides,
  };
  render(<TrackNameButton {...props} />);
  return props;
}

function openMenu() {
  fireEvent.contextMenu(
    screen.getByRole('button', { name: 'SD' })
  );
  return screen.getByRole('menu', {
    name: 'SD options',
  });
}

describe('TrackNameButton', () => {
  it('plays a preview on plain mousedown', () => {
    const props = renderButton();
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'SD' }),
      { button: 0 }
    );
    expect(props.onPlayPreview).toHaveBeenCalledTimes(1);
  });

  it('ignores non-primary mouse buttons', () => {
    const props = renderButton();
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'SD' }),
      { button: 2 }
    );
    expect(props.onPlayPreview).not.toHaveBeenCalled();
  });

  it('Shift+click clears the track', () => {
    const props = renderButton();
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'SD' }),
      { button: 0, shiftKey: true }
    );
    expect(props.onClearTrack).toHaveBeenCalledTimes(1);
    expect(props.onPlayPreview).not.toHaveBeenCalled();
  });

  it('exposes menu state via aria attributes', () => {
    renderButton();
    const btn = screen.getByRole('button', { name: 'SD' });
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    openMenu();
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('focuses the first menu item on open', () => {
    renderButton();
    openMenu();
    expect(
      screen.getByRole('menuitem', { name: /free-run/i })
    ).toHaveFocus();
  });

  it('Escape closes the menu and restores focus', () => {
    renderButton();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'SD' })
    ).toHaveFocus();
  });

  it('arrow keys keep focus on menu items', () => {
    renderButton();
    const menu = openMenu();
    const item = screen.getByRole('menuitem', {
      name: /free-run/i,
    });
    // Single item: ArrowDown/ArrowUp/End/Home wrap to it.
    for (const key of [
      'ArrowDown', 'ArrowUp', 'End', 'Home',
    ]) {
      fireEvent.keyDown(menu, { key });
      expect(item).toHaveFocus();
    }
  });

  it('arrow keys do not reach document listeners', () => {
    renderButton();
    const menu = openMenu();
    const spy = vi.fn();
    document.addEventListener('keydown', spy);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    document.removeEventListener('keydown', spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('free-run item toggles and closes the menu', () => {
    const props = renderButton();
    openMenu();
    fireEvent.click(
      screen.getByRole('menuitem', { name: /free-run/i })
    );
    expect(props.onToggleFreeRun).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('clicking outside closes the menu', () => {
    renderButton();
    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('small size never opens a menu', () => {
    renderButton({ size: 'sm' });
    const btn = screen.getByRole('button', { name: 'SD' });
    expect(btn).not.toHaveAttribute('aria-haspopup');
    fireEvent.contextMenu(btn);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
