"use client";

import { memo } from 'react';
import TrackToggle from './TrackToggle';
import Knob from './Knob';
import Tooltip from './Tooltip';
import { formatPan } from './trackUtils';

interface TrackMixerProps {
  trackName: string;
  isMuted: boolean;
  isSolo: boolean;
  gain: number;
  pan: number;
  size: 'sm' | 'lg';
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onSetGain: (value: number) => void;
  onSetPan: (value: number) => void;
}

/**
 * Mute/Solo toggle buttons + gain/pan knobs.
 * Renders in two sizes: 'sm' (mobile) and 'lg'
 * (desktop sidebar).
 */
function TrackMixerInner({
  trackName,
  isMuted,
  isSolo,
  gain,
  pan,
  size,
  onToggleMute,
  onToggleSolo,
  onSetGain,
  onSetPan,
}: TrackMixerProps) {
  const knobSize = size === 'sm' ? 20 : undefined;

  return (
    <>
      <div className="flex gap-1">
        <TrackToggle
          variant="mute"
          active={isMuted}
          trackName={trackName}
          size={size === 'sm' ? 'lg' : 'md'}
          onToggle={onToggleMute}
        />
        <TrackToggle
          variant="solo"
          active={isSolo}
          trackName={trackName}
          size={size === 'sm' ? 'lg' : 'md'}
          onToggle={onToggleSolo}
        />
      </div>
      <div
        className={
          'flex gap-1'
          + (size === 'lg' ? ' ml-1' : '')
        }
      >
        <Knob
          value={gain}
          onChange={onSetGain}
          trackName={trackName}
          size={knobSize}
        />
        <Tooltip tooltipKey="pan">
          <Knob
            value={pan}
            onChange={onSetPan}
            trackName={trackName}
            size={knobSize}
            defaultValue={0.5}
            ariaPrefix="Pan"
            formatValue={formatPan}
          />
        </Tooltip>
      </div>
    </>
  );
}

const TrackMixer = memo(TrackMixerInner);
export default TrackMixer;
