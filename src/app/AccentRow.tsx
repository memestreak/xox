"use client";

import { memo, useCallback, useRef } from 'react';
import type { TrackId } from './types';
import { computeEffectiveStep } from './trackUtils';
import TrackEndBar from './TrackEndBar';
import StepButton from './StepButton';
import Knob from './Knob';
import Tooltip from './Tooltip';

interface AccentRowProps {
  steps: string;
  trackLength: number;
  patternLength: number;
  pageOffset: number;
  isFreeRun: boolean;
  gain: number;
  currentStep: number;
  totalSteps: number;
  onToggleStep: (
    trackId: TrackId, stepIndex: number
  ) => void;
  onSetTrackLength: (
    trackId: TrackId, length: number
  ) => void;
  onToggleFreeRun: (trackId: TrackId) => void;
  onSetGain: (
    trackId: TrackId, value: number
  ) => void;
  onClearTrack: (trackId: TrackId) => void;
}

/**
 * Mini accent row at the bottom of the step grid.
 * Half-height step buttons for toggling accent steps,
 * with a draggable length handle, free-run support,
 * and an intensity knob.
 */
function AccentRowInner({
  steps,
  trackLength,
  patternLength,
  pageOffset,
  isFreeRun,
  gain,
  currentStep,
  totalSteps,
  onToggleStep,
  onSetTrackLength,
  onToggleFreeRun,
  onSetGain,
  onClearTrack,
}: AccentRowProps) {
  const stepGridRef = useRef<HTMLDivElement>(null);
  const handleFreeRun = useCallback(
    () => onToggleFreeRun('ac'),
    [onToggleFreeRun]
  );

  const handleGain = useCallback(
    (v: number) => onSetGain('ac', v),
    [onSetGain]
  );

  const handleClear = useCallback(
    () => onClearTrack('ac'),
    [onClearTrack]
  );

  const handleToggleStep = useCallback(
    (tid: TrackId, localStep: number) =>
      onToggleStep(tid, localStep + pageOffset),
    [onToggleStep, pageOffset]
  );

  const handleSetLength = useCallback(
    (len: number) => onSetTrackLength('ac', len),
    [onSetTrackLength]
  );

  const effectiveStep = computeEffectiveStep(
    currentStep, totalSteps, isFreeRun, trackLength
  );

  return (
    <div>
      {/* Mobile: label + knob above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <Tooltip tooltipKey="track-ac">
          <button
            type="button"
            onClick={(e) => {
              if (e.shiftKey) handleClear();
            }}
            className={
              'text-lg font-bold uppercase'
              + ' tracking-wider rounded px-1 py-0.5'
              + ' transition-colors cursor-pointer'
              + ' font-[family-name:var(--font-orbitron)]'
              + (isFreeRun
                ? ' text-orange-400'
                : ' text-neutral-400')
            }
          >
            AC
          </button>
        </Tooltip>
        <div className="ml-auto">
          <Tooltip
            tooltipKey="accentIntensity"
            position="bottom"
          >
            <Knob
              value={gain}
              onChange={handleGain}
              trackName="ACCENT"
              size={20}
              defaultValue={0.5}
            />
          </Tooltip>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Desktop: sidebar with label + knob */}
        <div className="hidden lg:flex w-56 items-center gap-2">
          <Tooltip tooltipKey="track-ac">
            <div>
              <button
                type="button"
                onClick={(e) => {
                  if (e.shiftKey) handleClear();
                }}
                className={
                  'w-12 truncate text-xl text-left'
                  + ' font-bold uppercase tracking-wider'
                  + ' rounded px-1 py-0.5 transition-colors'
                  + ' cursor-pointer'
                  + ' font-[family-name:var(--font-orbitron)]'
                  + (isFreeRun
                    ? ' text-orange-400'
                    : ' text-neutral-400')
                }
              >
                AC
              </button>
            </div>
          </Tooltip>
          {/* Spacer matching mute + solo widths */}
          <div className="flex gap-1">
            <div className="w-6 h-6" />
            <div className="w-6 h-6" />
          </div>
          <div className="flex gap-1 ml-1">
            <Tooltip
              tooltipKey="accentIntensity"
              position="bottom"
            >
              <Knob
                value={gain}
                onChange={handleGain}
                trackName="ACCENT"
                defaultValue={0.5}
              />
            </Tooltip>
          </div>
        </div>

        {/* Step grid with drag handle */}
        <div className="flex-1 relative">
          <div
            ref={stepGridRef}
            data-track="ac"
            className="grid grid-cols-8 lg:grid-cols-16 gap-[3px] lg:gap-1.5"
          >
            {Array.from(
              { length: 16 },
              (_, i) => {
                const globalIdx = pageOffset + i;
                const disabled =
                  globalIdx >= trackLength
                  || globalIdx >= patternLength;
                return (
                  <StepButton
                    key={i}
                    trackId={'ac' as TrackId}
                    trackName="accent"
                    stepIndex={i}
                    isActive={
                      !disabled
                      && steps[globalIdx] === '1'
                    }
                    isCurrent={
                      !disabled
                      && effectiveStep === globalIdx
                    }
                    isBeat={globalIdx % 4 === 0}
                    isDisabled={disabled}
                    mini
                    onToggle={handleToggleStep}
                  />
                );
              }
            )}
          </div>

          <TrackEndBar
            trackName="accent"
            trackLength={trackLength}
            patternLength={patternLength}
            pageOffset={pageOffset}
            isFreeRun={isFreeRun}
            gridRef={stepGridRef}
            onSetTrackLength={handleSetLength}
            onToggleFreeRun={handleFreeRun}
            showTooltip={false}
          />
        </div>
      </div>
    </div>
  );
}

const AccentRow = memo(AccentRowInner);
export default AccentRow;
