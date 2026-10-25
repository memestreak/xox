"use client";

import {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import type { TrackId } from './types';
import Tooltip from './Tooltip';
import {
  MENU_HINT, MENU_ITEM, MENU_ITEM_BASE,
} from './menuStyles';

interface TrackNameButtonProps {
  size: 'sm' | 'lg';
  trackId: TrackId;
  trackName: string;
  isFreeRun: boolean;
  isTriggered: boolean;
  onToggleFreeRun: () => void;
  onClearTrack: () => void;
  onPlayPreview: () => void;
}

/**
 * Track name button with optional popover menu.
 * The popover (with free-run toggle) only renders
 * at 'lg' size. Owns its own menu state and refs.
 */
function TrackNameButtonInner({
  size,
  trackId,
  trackName,
  isFreeRun,
  isTriggered,
  onToggleFreeRun,
  onClearTrack,
  onPlayPreview,
}: TrackNameButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    nameRef.current?.focus();
  }, []);

  // Click-outside dismiss
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current
        && !menuRef.current.contains(
          e.target as Node
        )
        && nameRef.current
        && !nameRef.current.contains(
          e.target as Node
        )
      ) {
        closeMenu();
      }
    };
    document.addEventListener(
      'mousedown', handleClick
    );
    return () =>
      document.removeEventListener(
        'mousedown', handleClick
      );
  }, [menuOpen, closeMenu]);

  // Escape key dismiss + auto-focus first item
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeMenu();
      }
    };
    document.addEventListener(
      'keydown', handleKeyDown
    );
    // Auto-focus first menu item
    const firstItem =
      menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]'
      );
    firstItem?.focus();
    return () =>
      document.removeEventListener(
        'keydown', handleKeyDown
      );
  }, [menuOpen, closeMenu]);

  // Arrow-key navigation between menu items
  // (WAI-ARIA menu pattern). Focus wraps at both ends.
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>(
          '[role="menuitem"]'
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
    <Tooltip tooltipKey={`track-${trackId}`}>
      <div className="relative">
        <button
          ref={size === 'lg' ? nameRef : undefined}
          aria-haspopup={
            size === 'lg' ? 'menu' : undefined
          }
          aria-expanded={
            size === 'lg' ? menuOpen : undefined
          }
          onMouseDown={(e: React.MouseEvent) => {
            if (e.button !== 0) return;
            if (e.shiftKey) {
              onClearTrack();
              return;
            }
            if (e.metaKey || e.ctrlKey) {
              setMenuOpen(v => !v);
              return;
            }
            onPlayPreview();
          }}
          onTouchStart={() => onPlayPreview()}
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            setMenuOpen(v => !v);
          }}
          className={
            (size === 'sm'
              ? 'text-xl'
              : 'w-14 truncate text-[22px] text-left')
            + ' font-display font-bold uppercase'
            + ' tracking-[0.08em] leading-none'
            + ' rounded px-1 py-1 transition-colors'
            + ' focus-visible:outline-2'
            + ' focus-visible:outline-accent'
            + (isTriggered
              ? ' text-lcd bg-accent/20'
              : ' text-ink hover:bg-raised')
          }
        >
          {trackName}
        </button>
      {menuOpen && size === 'lg' && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${trackName} options`}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className="ss-menu absolute left-0 top-full mt-1 w-56 p-1.5 z-30 flex flex-col"
        >
          <button
            role="menuitem"
            onClick={() => {
              onToggleFreeRun();
              closeMenu();
            }}
            className={MENU_ITEM}
          >
            <span>Free-run</span>
            <span
              aria-hidden="true"
              className={
                'relative w-[30px] h-4 rounded-full'
                + ' transition-colors '
                + (isFreeRun ? 'bg-accent' : 'bg-edge')
              }
            >
              <span
                className={
                  'absolute top-0.5 w-3 h-3 rounded-full'
                  + ' bg-ink transition-[left] '
                  + (isFreeRun ? 'left-4' : 'left-0.5')
                }
              />
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onPlayPreview();
              closeMenu();
            }}
            className={MENU_ITEM}
          >
            <span>Preview sound</span>
            <span className={MENU_HINT}>Click</span>
          </button>
          <div className="h-px bg-line mx-1.5 my-1" />
          <button
            role="menuitem"
            onClick={() => {
              onClearTrack();
              closeMenu();
            }}
            className={MENU_ITEM_BASE + ' text-[#ff8a62]'}
          >
            <span>Clear track</span>
            <span className={MENU_HINT}>Shift-click</span>
          </button>
        </div>
      )}
      </div>
    </Tooltip>
  );
}

const TrackNameButton = memo(TrackNameButtonInner);
export default TrackNameButton;
