"use client";

import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import ContextMenu from './ContextMenu';
import { MENU_COPIED_CLOSE_MS } from './constants';
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
  /**
   * Copies the pattern as a patterns.json entry.
   * Rejects when the clipboard refuses.
   */
  onCopyPattern: () => Promise<void>;
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
 * the auto-minimize setting, reset samples, copy
 * pattern, reset.
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
  onCopyPattern,
  onClose,
  anchorRef,
}: GridContextMenuProps) {
  const [copyResult, setCopyResult] =
    useState<'copied' | 'failed' | null>(null);

  // After Copy pattern, show the result briefly, then
  // close.
  useEffect(() => {
    if (copyResult === null) return;
    const timer = setTimeout(onClose, MENU_COPIED_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [copyResult, onClose]);

  const handleCopyPattern = useCallback(() => {
    onCopyPattern().then(
      () => setCopyResult('copied'),
      () => setCopyResult('failed')
    );
  }, [onCopyPattern]);

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
        onClick={handleCopyPattern}
        className={MENU_ITEM}
      >
        <span>Copy pattern</span>
        {copyResult && (
          <span role="status" className={MENU_HINT}>
            {copyResult === 'copied' ? 'Copied' : 'Failed'}
          </span>
        )}
      </button>
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
