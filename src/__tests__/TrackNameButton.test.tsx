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
    onLoadSample: vi.fn(),
    onResetSample: vi.fn(),
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

  it('arrow keys move focus between menu items', () => {
    renderButton();
    const menu = openMenu();
    const [freeRun, load, clear] =
      screen.getAllByRole('menuitem');
    expect(freeRun).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(load).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(clear).toHaveFocus();
    // Focus wraps at both ends.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(freeRun).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(clear).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(freeRun).toHaveFocus();
  });

  it('menu has no preview item', () => {
    renderButton();
    openMenu();
    expect(
      screen.queryByRole('menuitem', { name: /preview/i })
    ).toBeNull();
  });

  it('menu clears the track pattern', () => {
    const props = renderButton();
    openMenu();
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: /clear track pattern/i,
      })
    );
    expect(props.onClearTrack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('free-run item explains itself on hover', () => {
    renderButton();
    openMenu();
    const item = screen.getByRole('menuitem', {
      name: 'Free-run',
    });
    expect(item).toHaveAccessibleDescription(
      'Enable to loop track pattern independent'
      + ' of global pattern length'
    );
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

  it('offers Load sample from file', () => {
    renderButton();
    openMenu();
    expect(screen.getByRole('menuitem', {
      name: /load sample from file/i,
    })).toBeInTheDocument();
  });

  it('offers Reset only for a custom track', () => {
    renderButton();
    openMenu();
    expect(screen.queryByRole('menuitem', {
      name: /reset to kit sample/i,
    })).toBeNull();
  });

  it('Reset to kit sample calls onResetSample', () => {
    const props = renderButton({
      customSampleName: 'kick.wav',
    });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', {
      name: /reset to kit sample/i,
    }));
    expect(props.onResetSample).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Load opens the file picker and closes the menu', () => {
    renderButton();
    openMenu();
    const input = screen.getByLabelText(
      'Load sample for SD'
    ) as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('menuitem', {
      name: /load sample from file/i,
    }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    // Still mounted after the menu closed.
    expect(input.isConnected).toBe(true);
  });

  it('a chosen file goes to onLoadSample', () => {
    const props = renderButton();
    const input = screen.getByLabelText(
      'Load sample for SD'
    ) as HTMLInputElement;
    expect(input.accept).toBe(
      '.wav,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave'
    );
    const file = new File(['x'], 'kick.wav');
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onLoadSample).toHaveBeenCalledWith(file);
  });

  it('a cancelled picker loads nothing', () => {
    const props = renderButton();
    const input = screen.getByLabelText('Load sample for SD');
    fireEvent.change(input, { target: { files: [] } });
    expect(props.onLoadSample).not.toHaveBeenCalled();
  });

  it('small size has no file input', () => {
    renderButton({ size: 'sm' });
    expect(screen.queryByLabelText('Load sample for SD'))
      .toBeNull();
  });
});
