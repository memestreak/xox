"use client";

import { useCallback } from 'react';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';

/**
 * Fill button: momentary by default (hold to
 * activate), Cmd/Ctrl+click to toggle latch.
 */
export default function FillButton() {
  const { state, actions } = useSequencer();
  const { isFillActive, fillMode } = state;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      actions.setFillHeld(true);
    },
    [actions]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      actions.setFillHeld(false);
    },
    [actions]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        actions.toggleFillLatch();
      }
    },
    [actions]
  );

  let bg: string;
  if (fillMode === 'momentary') {
    bg = 'bg-orange-400'
      + ' shadow-[0_0_20px_rgba(251,146,60,0.6)]';
  } else if (fillMode === 'latched') {
    bg = 'bg-orange-600'
      + ' shadow-[0_0_20px_rgba(234,88,12,0.4)]';
  } else {
    bg = 'bg-orange-600/30';
  }

  return (
    <Tooltip tooltipKey="fill" position="bottom">
      <button
        aria-pressed={isFillActive}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      style={{ touchAction: 'manipulation' }}
      className={
        'self-stretch px-2 lg:px-3 rounded-full'
        + ' font-bold text-sm lg:text-base'
        + ' border border-orange-700'
        + ' transition-colors'
        + ' focus-visible:outline-none'
        + ' focus-visible:ring-2'
        + ' focus-visible:ring-orange-500'
        + ' focus-visible:ring-offset-2'
        + ' focus-visible:ring-offset-neutral-950 '
        + bg
      }
    >
        FILL
      </button>
    </Tooltip>
  );
}
