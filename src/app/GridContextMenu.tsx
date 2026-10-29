"use client";

import type { RefObject } from 'react';
import ContextMenu from './ContextMenu';
import { MENU_HINT, MENU_ITEM } from './menuStyles';

interface GridContextMenuProps {
  /** Pointer position the menu opens at (viewport px). */
  x: number;
  y: number;
  /** True when some empty track isn't minimized yet. */
  canMinimize: boolean;
  /** True when at least one row is minimized. */
  canRestore: boolean;
  onMinimize: () => void;
  onRestoreAll: () => void;
  /** The "Auto-minimize empty tracks" setting. */
  autoMinimize: boolean;
  onSetAutoMinimize: (value: boolean) => void;
  /** Clears the pattern (the app's Reset). */
  onReset: () => void;
  /** True when at least one track has a custom sample. */
  hasCustomSamples: boolean;
  onResetAllSamples: () => void;
  onClose: () => void;
  /**
   * The key that toggles the menu. A press on it is not
   * an outside press, so the key's own click can close
   * the menu instead of reopening it.
   */
  anchorRef?: RefObject<HTMLElement | null>;
}

/**
 * Grid menu: minimize empty tracks, restore all tracks,
 * the auto-minimize setting, reset samples, reset.
 * Opens at the pointer on a right-click in a blank
 * part of the grid, or under the ⋯ key over the
 * track names; kept inside the viewport. Closes on a
 * choice, Escape, a press outside, scroll or resize,
 * and returns focus to where it was.
 */
export default function GridContextMenu({
  x,
  y,
  canMinimize,
  canRestore,
  onMinimize,
  onRestoreAll,
  autoMinimize,
  onSetAutoMinimize,
  onReset,
  hasCustomSamples,
  onResetAllSamples,
  onClose,
  anchorRef,
}: GridContextMenuProps) {
  return (
    <ContextMenu
      x={x}
      y={y}
      aria-label="Grid options"
      onClose={onClose}
      anchorRef={anchorRef}
    >
      <button
        role="menuitem"
        disabled={!canMinimize}
        aria-keyshortcuts="H"
        onClick={() => {
          onMinimize();
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Minimize empty tracks</span>
        <span aria-hidden="true" className={MENU_HINT}>H</span>
      </button>
      <button
        role="menuitem"
        disabled={!canRestore}
        aria-keyshortcuts="Shift+H"
        onClick={() => {
          onRestoreAll();
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Restore all tracks</span>
        <span aria-hidden="true" className={MENU_HINT}>⇧H</span>
      </button>
      <button
        role="menuitemcheckbox"
        aria-checked={autoMinimize}
        onClick={() => {
          onSetAutoMinimize(!autoMinimize);
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Auto-minimize empty tracks</span>
        <span
          aria-hidden="true"
          className={
            'ss-led shrink-0' + (autoMinimize ? ' ss-led-on' : '')
          }
        />
      </button>
      <div role="separator" className="h-px bg-line mx-1.5 my-1" />
      {hasCustomSamples && (
        <button
          role="menuitem"
          onClick={() => {
            onResetAllSamples();
            onClose();
          }}
          className={MENU_ITEM}
        >
          <span>Reset all samples to kit</span>
        </button>
      )}
      <button
        role="menuitem"
        onClick={() => {
          onReset();
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Reset pattern</span>
      </button>
    </ContextMenu>
  );
}
