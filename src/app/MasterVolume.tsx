"use client";

import { memo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import LevelMeter from './LevelMeter';
import PanelSection from './PanelSection';
import Tooltip from './Tooltip';
import { MASTER_VOLUME_DEFAULT } from './constants';
import { formatDb, positionToGain } from './hooks/useMasterVolume';

interface MasterVolumeProps {
  position: number;
  onChange: (position: number) => void;
  /**
   * "header": compact box in header row 1 (desktop).
   * "strip": full-width row of the controls strip
   * (below lg). The parent renders both; CSS shows one.
   */
  variant: 'header' | 'strip';
}

/**
 * Master volume fader with a stereo level meter and a
 * dB readout. Double-click the fader to return to 0 dB.
 */
function MasterVolumeInner({
  position, onChange, variant,
}: MasterVolumeProps) {
  const id = `master-volume-${variant}`;
  const readout = formatDb(positionToGain(position));

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  const handleReset = useCallback(() => {
    onChange(MASTER_VOLUME_DEFAULT);
  }, [onChange]);

  const control = (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Tooltip
          tooltipKey="master"
          position={variant === 'header' ? 'bottom' : 'top'}
        >
          <input
            id={id}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={position}
            onChange={handleInput}
            onDoubleClick={handleReset}
            aria-label="Master volume"
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
      <div className="hidden lg:flex items-center gap-3 h-11 w-[260px] px-3 rounded-lg ss-panel">
        <label htmlFor={id} className="ss-label text-[10px]">
          Master
        </label>
        {control}
      </div>
    );
  }

  return (
    <PanelSection
      label="Master"
      labelFor={id}
      className="col-span-6 lg:hidden"
    >
      {control}
    </PanelSection>
  );
}

const MasterVolume = memo(MasterVolumeInner);
export default MasterVolume;
