"use client";

import {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import type { TrackId } from './types';
import Tooltip from './Tooltip';

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
              ? 'text-lg'
              : 'w-12 truncate text-xl text-left')
            + ' font-bold uppercase tracking-wider font-[family-name:var(--font-orbitron)]'
            + ' rounded px-1 py-0.5 transition-colors'
            + (isTriggered
              ? ' text-orange-300 bg-orange-400/25'
              : isFreeRun
                ? ' text-orange-400 bg-orange-400/10'
                : ' text-neutral-400'
                  + ' hover:text-neutral-200'
                  + ' hover:bg-neutral-800/50')
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
          className="absolute left-0 top-full mt-1 w-36 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={() => {
              onToggleFreeRun();
              closeMenu();
            }}
            className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center justify-between"
          >
            <span>Free-run</span>
            <span
              className={
                'inline-block w-2 h-2 rounded-full '
                + (isFreeRun
                  ? 'bg-orange-400'
                  : 'bg-neutral-600')
              }
            />
          </button>
        </div>
      )}
      </div>
    </Tooltip>
  );
}

const TrackNameButton = memo(TrackNameButtonInner);
export default TrackNameButton;
