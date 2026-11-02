"use client";

import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import ContextMenu from './ContextMenu';
import { MENU_COPIED_CLOSE_MS } from './constants';
import { MENU_HINT, MENU_ITEM } from './menuStyles';
import { useSequencer } from './SequencerContext';
import type { Pattern } from './types';
import { TRACK_IDS } from './types';
import { hasStepData } from './trackUtils';
import patternsData from './data/patterns.json';
import {
  buildPatternEntry, formatPatternEntry,
} from './patternExport';

const PRESETS = patternsData.patterns as Pattern[];

interface GridContextMenuProps {
  /** Pointer position the menu opens at (viewport px). */
  x: number;
  y: number;
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
 * pattern, reset trig conditions, clear parameter
 * locks, reset.
 * Opens at the pointer on a right-click in a blank
 * part of the grid, or under the ⋯ key over the
 * track names; kept inside the viewport. Closes on a
 * choice, Escape, a press outside, scroll or resize,
 * and returns focus to where it was. It is mounted
 * only while open, so it reads the sequencer itself.
 */
export default function GridContextMenu({
  x,
  y,
  onClose,
  anchorRef,
}: GridContextMenuProps) {
  const { state, actions, meta } = useSequencer();
  const {
    minimizableCount, minimizedTracks, autoMinimize,
    customSamples, selectedPatternId,
  } = state;
  const {
    minimizeEmptyTracks, restoreAllTracks,
    setAutoMinimize, clearAll, resetAllSamples,
    clearAllConditions, clearAllLocks,
  } = actions;
  const { config } = meta;
  const canMinimize = minimizableCount > 0;
  const canRestore = minimizedTracks.size > 0;
  const hasCustomSamples =
    Object.keys(customSamples).length > 0;
  const hasConditions = TRACK_IDS.some(id =>
    hasStepData(config.tracks[id].trigConditions)
  );
  const hasLocks = TRACK_IDS.some(id =>
    hasStepData(config.tracks[id].parameterLocks)
  );

  const [copyResult, setCopyResult] =
    useState<'copied' | 'failed' | null>(null);

  // After Copy pattern, show the result briefly, then
  // close.
  useEffect(() => {
    if (copyResult === null) return;
    const timer = setTimeout(onClose, MENU_COPIED_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [copyResult, onClose]);

  // Copy pattern: the grid as a patterns.json entry
  // (see patternExport.ts).
  const handleCopyPattern = useCallback(() => {
    navigator.clipboard.writeText(
      formatPatternEntry(buildPatternEntry(
        config, selectedPatternId, PRESETS
      ))
    ).then(
      () => setCopyResult('copied'),
      () => setCopyResult('failed')
    );
  }, [config, selectedPatternId]);

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
          minimizeEmptyTracks();
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
          restoreAllTracks();
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
          setAutoMinimize(!autoMinimize);
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
            resetAllSamples();
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
        disabled={!hasConditions}
        onClick={() => {
          clearAllConditions();
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Reset trig conditions</span>
      </button>
      <button
        role="menuitem"
        disabled={!hasLocks}
        onClick={() => {
          clearAllLocks();
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Clear parameter locks</span>
      </button>
      <button
        role="menuitem"
        onClick={() => {
          clearAll();
          onClose();
        }}
        className={MENU_ITEM}
      >
        <span>Reset pattern</span>
      </button>
    </ContextMenu>
  );
}
