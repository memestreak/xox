"use client";

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import type { ReactNode, RefObject } from 'react';

/** Every usable item, for focus and arrow keys. */
const MENU_ITEMS_SELECTOR =
  '[role="menuitem"]:not(:disabled),'
  + ' [role="menuitemcheckbox"]:not(:disabled)';

/** Space kept between the menu and the viewport edge. */
const VIEWPORT_MARGIN_PX = 8;

interface ContextMenuProps {
  /** Pointer position the menu opens at (viewport px). */
  x: number;
  y: number;
  'aria-label': string;
  onClose: () => void;
  /**
   * The key that toggles the menu. A press on it is not
   * an outside press, so the key's own click can close
   * the menu instead of reopening it.
   */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Menu items (role="menuitem" buttons). */
  children: ReactNode;
}

/**
 * Floating menu shell shared by the grid menu and the
 * kit menu. Opens at a point, kept inside the viewport.
 * Focuses its first usable item, moves between items
 * with the arrow keys, Home and End, closes on Escape,
 * a press outside, scroll or resize, and returns focus
 * to where it was.
 */
export default function ContextMenu({
  x,
  y,
  'aria-label': ariaLabel,
  onClose,
  anchorRef,
  children,
}: ContextMenuProps) {
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
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onContextMenu={e => e.preventDefault()}
      style={{ position: 'fixed', ...pos }}
      className="ss-menu w-60 p-1.5 z-40 flex flex-col focus:outline-none"
    >
      {children}
    </div>
  );
}
