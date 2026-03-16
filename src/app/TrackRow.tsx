"use client";

import { memo, useCallback } from 'react';
import { TrackId } from './types';
import TrackToggle from './TrackToggle';
import StepButton from './StepButton';
import Knob from './Knob';

interface TrackRowProps {
  trackId: TrackId;
  trackName: string;
  steps: string;
  isMuted: boolean;
  isSolo: boolean;
  gain: number;
  currentStep: number;
  onToggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onToggleMute: (trackId: TrackId) => void;
  onToggleSolo: (trackId: TrackId) => void;
  onSetGain: (trackId: TrackId, value: number) => void;
}

/**
 * Single track row: name, mute/solo, knob, and 16 step
 * buttons. Uses a unified responsive grid (grid-cols-8
 * on mobile, grid-cols-16 on desktop) to avoid duplicated
 * DOM nodes.
 */
function TrackRowInner({
  trackId,
  trackName,
  steps,
  isMuted,
  isSolo,
  gain,
  currentStep,
  onToggleStep,
  onToggleMute,
  onToggleSolo,
  onSetGain,
}: TrackRowProps) {
  const handleMute = useCallback(
    () => onToggleMute(trackId),
    [onToggleMute, trackId]
  );
  const handleSolo = useCallback(
    () => onToggleSolo(trackId),
    [onToggleSolo, trackId]
  );
  const handleGain = useCallback(
    (v: number) => onSetGain(trackId, v),
    [onSetGain, trackId]
  );

  return (
    <div>
      {/* Mobile: track name + M/S above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
          {trackName}
        </span>
        <div className="flex gap-1 ml-auto items-center">
          <TrackToggle
            variant="mute"
            active={isMuted}
            trackName={trackName}
            size="lg"
            onToggle={handleMute}
          />
          <TrackToggle
            variant="solo"
            active={isSolo}
            trackName={trackName}
            size="lg"
            onToggle={handleSolo}
          />
          <Knob
            value={gain}
            onChange={handleGain}
            trackName={trackName}
            size={20}
          />
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Desktop: sidebar with name, M/S, knob */}
        <div className="hidden lg:flex w-48 items-center gap-2">
          <span className="w-16 truncate text-xs font-bold uppercase text-neutral-400 tracking-wider">
            {trackName}
          </span>
          <TrackToggle
            variant="mute"
            active={isMuted}
            trackName={trackName}
            size="md"
            onToggle={handleMute}
          />
          <TrackToggle
            variant="solo"
            active={isSolo}
            trackName={trackName}
            size="md"
            onToggle={handleSolo}
          />
          <Knob
            value={gain}
            onChange={handleGain}
            trackName={trackName}
          />
        </div>

        {/* Unified step grid: 8-col mobile, 16-col desktop */}
        <div className="flex-1 grid grid-cols-8 lg:grid-cols-16 gap-[3px] lg:gap-1.5">
          {steps.split('').map((step, i) => (
            <StepButton
              key={i}
              trackName={trackName}
              stepIndex={i}
              isActive={step === '1'}
              isCurrent={i === currentStep}
              isBeat={i % 4 === 0}
              onToggle={() => onToggleStep(trackId, i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const TrackRow = memo(TrackRowInner);
export default TrackRow;
