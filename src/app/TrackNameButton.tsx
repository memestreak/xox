"use client";

import { memo, useCallback, useRef, useState } from 'react';
import type { TrackId } from './types';
import Tooltip from './Tooltip';
import ContextMenu from './ContextMenu';
import {
  MENU_HINT, MENU_ITEM, MENU_ITEM_BASE,
} from './menuStyles';
import { SAMPLE_ACCEPT } from './sampleFiles';
import CustomSampleDot from './CustomSampleDot';

/** Space between the name and the menu under it. */
const MENU_GAP_PX = 4;

interface TrackNameButtonProps {
  size: 'sm' | 'lg';
  trackId: TrackId;
  trackName: string;
  isFreeRun: boolean;
  isTriggered: boolean;
  onToggleFreeRun: () => void;
  onClearTrack: () => void;
  /** True when some step on the track has a condition. */
  hasConditions?: boolean;
  onResetConditions?: () => void;
  /** True when some step on the track has a lock. */
  hasLocks?: boolean;
  onClearLocks?: () => void;
  onPlayPreview: () => void;
  /** File name when the track plays a custom sample. */
  customSampleName?: string;
  /** False while a custom track plays the kit sample. */
  isCustomSampleOn?: boolean;
  onLoadSample?: (file: File) => void;
  onResetSample?: () => void;
  onToggleSample?: () => void;
}

/**
 * Track name button. A press plays the sound,
 * Shift-click clears the track. At 'lg' size a
 * right-click or Ctrl/Cmd-click opens the track menu
 * (the shared ContextMenu) under the name.
 */
function TrackNameButtonInner({
  size,
  trackId,
  trackName,
  isFreeRun,
  isTriggered,
  onToggleFreeRun,
  onClearTrack,
  hasConditions = false,
  onResetConditions,
  hasLocks = false,
  onClearLocks,
  onPlayPreview,
  customSampleName,
  isCustomSampleOn = true,
  onLoadSample,
  onResetSample,
  onToggleSample,
}: TrackNameButtonProps) {
  // Where the menu opens (viewport px), or null.
  const [menuAt, setMenuAt] = useState<{
    x: number; y: number;
  } | null>(null);
  const menuOpen = menuAt !== null;
  const nameRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opens the menu under the name, or closes it.
  const toggleMenu = useCallback(() => {
    setMenuAt(open => {
      const rect = nameRef.current?.getBoundingClientRect();
      if (open !== null || !rect) return null;
      return { x: rect.left, y: rect.bottom + MENU_GAP_PX };
    });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuAt(null);
    nameRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      {/* The name's tooltip wraps only the name, not the
          menu: hovering a tooltip host shows every
          tooltip inside it. */}
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
                if (size === 'lg') toggleMenu();
                return;
              }
              onPlayPreview();
            }}
            onTouchStart={() => onPlayPreview()}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              if (size === 'lg') toggleMenu();
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
            aria-label={trackName}
          >
            {trackName}
          </button>
          {size === 'lg' && customSampleName !== undefined && (
            // Lays an invisible copy of the name over the
            // button so the dot lands just after the text.
            // The dot is its own button (it toggles the
            // sample); the rest of the overlay lets clicks
            // through to the name.
            <span className="absolute inset-0 px-1 py-1 pointer-events-none font-display font-bold uppercase tracking-[0.08em] leading-none text-[22px] whitespace-nowrap">
              <span className="relative">
                <span aria-hidden="true" className="invisible">
                  {trackName}
                </span>
                <CustomSampleDot
                  fileName={customSampleName}
                  isOn={isCustomSampleOn}
                  onToggle={onToggleSample}
                  className="absolute left-full top-0 pointer-events-auto"
                />
              </span>
            </span>
          )}
        </div>
      </Tooltip>
      {size === 'lg' && (
        <input
          ref={fileInputRef}
          type="file"
          accept={SAMPLE_ACCEPT}
          aria-label={`Load sample for ${trackName}`}
          tabIndex={-1}
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            // Clear so the same file can be picked again.
            e.target.value = '';
            if (file) onLoadSample?.(file);
          }}
        />
      )}
      {menuAt !== null && size === 'lg' && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          aria-label={`${trackName} options`}
          onClose={closeMenu}
          anchorRef={nameRef}
          widthClass="w-64"
        >
          <Tooltip tooltipKey="freeRun">
            <button
              role="menuitem"
              aria-label="Free-run"
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
          </Tooltip>
          <button
            role="menuitem"
            onClick={() => {
              // Opens the picker inside the click (a user
              // gesture), then closes the menu.
              fileInputRef.current?.click();
              closeMenu();
            }}
            className={MENU_ITEM}
          >
            <span>Load sample from file...</span>
          </button>
          {customSampleName !== undefined && (
            <button
              role="menuitem"
              onClick={() => {
                onResetSample?.();
                closeMenu();
              }}
              className={MENU_ITEM}
            >
              <span>Reset to kit sample</span>
            </button>
          )}
          <div role="separator" className="h-px bg-line mx-1.5 my-1" />
          <button
            role="menuitem"
            disabled={!hasConditions}
            onClick={() => {
              onResetConditions?.();
              closeMenu();
            }}
            className={MENU_ITEM}
          >
            <span>Reset trig conditions</span>
          </button>
          <button
            role="menuitem"
            disabled={!hasLocks}
            onClick={() => {
              onClearLocks?.();
              closeMenu();
            }}
            className={MENU_ITEM}
          >
            <span>Clear parameter locks</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onClearTrack();
              closeMenu();
            }}
            className={MENU_ITEM_BASE + ' text-[#ff8a62]'}
          >
            <span>Clear track pattern</span>
            <span className={MENU_HINT}>Shift-click</span>
          </button>
        </ContextMenu>
      )}
    </div>
  );
}

const TrackNameButton = memo(TrackNameButtonInner);
export default TrackNameButton;
