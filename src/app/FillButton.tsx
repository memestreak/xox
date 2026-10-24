"use client";

import { useCallback } from 'react';
import { useSequencer } from './SequencerContext';
import LatchKey from './LatchKey';
import type { LatchKeyBody } from './LatchKey';

/**
 * Fill key: hold the body for a momentary fill; the
 * latch section (or Cmd/Ctrl+click on the body) toggles
 * the latch. Releasing the body also clears the latch,
 * as releasing F does.
 */
export default function FillButton() {
  const { state, actions } = useSequencer();
  const { fillMode, isFillLatched } = state;

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

  let body: LatchKeyBody;
  if (fillMode === 'momentary') body = 'held';
  else if (fillMode === 'latched') body = 'active';
  else body = 'off';

  return (
    <LatchKey
      label="FILL"
      name="Fill"
      size="header"
      body={body}
      latched={isFillLatched}
      bodyTooltipKey="fill"
      latchTooltipKey="fillLatch"
      onBodyPointerDown={handlePointerDown}
      onBodyPointerUp={handlePointerUp}
      onBodyClick={handleClick}
      onLatch={actions.toggleFillLatch}
    />
  );
}
