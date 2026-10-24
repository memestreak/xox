"use client";

import { memo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import LevelMeter from './LevelMeter';
import PanelSection from './PanelSection';
import Tooltip from './Tooltip';
import { formatDb, positionToGain } from './hooks/useMasterVolume';

interface MasterVolumeProps {
  position: number;
  onChange: (position: number) => void;
  /** Mute, or unmute back to the previous level. */
  onToggleMute: () => void;
  /** Called when a press on the widget begins. */
  onGestureStart: () => void;
  /**
   * "header": compact box in header row 1 (desktop).
   * "strip": full-width row of the controls strip
   * (below lg). The parent renders both; CSS shows one.
   */
  variant: 'header' | 'strip';
}

/**
 * Master volume fader (labelled "Volume") with a
 * stereo level meter and a dB readout. Double-click
 * anywhere on it to mute, and again to unmute.
 */
function MasterVolumeInner({
  position, onChange, onToggleMute, onGestureStart, variant,
}: MasterVolumeProps) {
  const id = `master-volume-${variant}`;
  const readout = formatDb(positionToGain(position));

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  // Only the first press of a double-click marks the
  // level to work from.
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.detail <= 1) onGestureStart();
    },
    [onGestureStart]
  );

  // Double-click anywhere on the widget (label, fader,
  // meter, readout) toggles mute. A mouse shortcut on
  // top of the slider, which stays keyboard operable.
  const gestureProps = {
    onMouseDown: handleMouseDown,
    onDoubleClick: onToggleMute,
  };

  const control = (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Tooltip tooltipKey="master" position="top">
          <input
            id={id}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={position}
            onChange={handleInput}
            aria-label="Volume"
            aria-valuetext={readout}
            className={
              'ss-fader w-full'
              + (variant === 'strip' ? ' ss-fader-touch' : '')
            }
            style={{
              '--fill': `${position * 100}%`,
            } as CSSProperties}
          />
        </Tooltip>
        <LevelMeter />
      </div>
      <output
        htmlFor={id}
        className="font-mono text-[13px] text-ink tabular-nums w-[58px] text-right shrink-0"
      >
        {readout}
      </output>
    </div>
  );

  if (variant === 'header') {
    return (
      <div
        {...gestureProps}
        className="hidden lg:flex items-center gap-3 h-11 w-[260px] px-3 rounded-lg ss-panel select-none"
      >
        <label htmlFor={id} className="ss-label text-[10px]">
          Volume
        </label>
        {control}
      </div>
    );
  }

  return (
    <PanelSection
      label="Volume"
      labelFor={id}
      className="col-span-6 max-lg:order-5 rounded-b-[11px] lg:hidden select-none"
      {...gestureProps}
    >
      {control}
    </PanelSection>
  );
}

const MasterVolume = memo(MasterVolumeInner);
export default MasterVolume;
