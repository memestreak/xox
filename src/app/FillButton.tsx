"use client";

import { useCallback } from 'react';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import LatchKey from './LatchKey';
import { useForcedLook, useLatchVariant } from './mockLatch';

/**
 * Fill button: momentary by default (hold to
 * activate), Cmd/Ctrl+click to toggle latch.
 */
export default function FillButton() {
  const { state, actions } = useSequencer();
  const { isFillActive, fillMode } = state;
  const mock = useLatchVariant();
  const forced = useForcedLook('fill');

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

  if (mock) {
    const latched = forced ? forced.latched : fillMode === 'latched';
    let body = forced ? forced.body
      : fillMode === 'momentary' ? 'held' as const : 'off' as const;
    if (latched && body === 'off') body = 'active';
    return (
      <LatchKey
        variant={mock}
        label="FILL"
        size="header"
        body={body}
        latched={latched}
        onBodyDown={() => actions.setFillHeld(true)}
        onBodyUp={() => actions.setFillHeld(false)}
        onLatch={actions.toggleFillLatch}
      />
    );
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
