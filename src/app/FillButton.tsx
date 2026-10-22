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

  // Held: amber key. Latched: lit orange key.
  let look: string;
  if (fillMode === 'momentary') {
    look = 'bg-none bg-mute border-mute text-[#1a1208]'
      + ' shadow-[0_0_18px_rgb(242_178_58/0.45)]';
  } else if (fillMode === 'latched') {
    look = 'bg-none bg-accent border-accent-hi text-[#1a0d05]'
      + ' shadow-[0_0_18px_rgb(240_102_42/0.4)]';
  } else {
    look = 'text-ink';
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
          'ss-key ss-cap h-10 lg:h-11 px-3 lg:px-[18px]'
          + ' rounded-lg text-sm lg:text-[17px] '
          + look
        }
      >
        FILL
      </button>
    </Tooltip>
  );
}
