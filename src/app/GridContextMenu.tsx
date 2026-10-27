"use client";

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import type { RefObject } from 'react';
import { MENU_HINT, MENU_ITEM } from './menuStyles';

/** Every usable item, for focus and arrow keys. */
const MENU_ITEMS_SELECTOR =
  '[role="menuitem"]:not(:disabled),'
  + ' [role="menuitemcheckbox"]:not(:disabled)';

/** Space kept between the menu and the viewport edge. */
const VIEWPORT_MARGIN_PX = 8;

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
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const maxLeft =
      window.innerWidth - width - VIEWPORT_MARGIN_PX;
    const maxTop =
      window.innerHeight - height - VIEWPORT_MARGIN_PX;
    setPos({
      left: Math.max(
        VIEWPORT_MARGIN_PX, Math.min(x, maxLeft)
      ),
      top: Math.max(
        VIEWPORT_MARGIN_PX, Math.min(y, maxTop)
      ),
    });
  }, [x, y]);

  // Focus the first usable item; give focus back on
  // close.
  useEffect(() => {
    const previous = document.activeElement;
    const first =
      menuRef.current?.querySelector<HTMLElement>(
        MENU_ITEMS_SELECTOR
      ) ?? menuRef.current;
    first?.focus({ preventScroll: true });
    return () => {
      if (
        previous instanceof HTMLElement
        && previous.isConnected
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  // Dismiss on a press outside, Escape, scroll, resize.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef?.current?.contains(target)) return;
      if (
        menuRef.current
        && !menuRef.current.contains(target)
      ) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onScrollOrResize = () => onClose();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener(
      'scroll', onScrollOrResize, true
    );
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener(
        'pointerdown', onPointerDown
      );
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(
        'scroll', onScrollOrResize, true
      );
      window.removeEventListener(
        'resize', onScrollOrResize
      );
    };
  }, [onClose, anchorRef]);

  // Arrow keys, Home and End move between usable items
  // (WAI-ARIA menu pattern). Focus wraps at both ends.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>(
          MENU_ITEMS_SELECTOR
        )
      );
      if (items.length === 0) return;
      const current = items.indexOf(
        document.activeElement as HTMLElement
      );
      let next: number;
      if (e.key === 'ArrowDown') {
        next = (current + 1) % items.length;
      } else if (e.key === 'ArrowUp') {
        next = current <= 0
          ? items.length - 1
          : current - 1;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = items.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      items[next].focus();
    },
    []
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Grid options"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onContextMenu={e => e.preventDefault()}
      style={{ position: 'fixed', ...pos }}
      className="ss-menu w-60 p-1.5 z-40 flex flex-col focus:outline-none"
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
    </div>
  );
}
