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
    <div className="border-t border-line pt-3 lg:pt-4">
      {/* Mobile: label + knob above grid */}
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <Tooltip tooltipKey="track-ac">
          <button
            type="button"
            onClick={(e) => {
              if (e.shiftKey) handleClear();
            }}
            className={
              'text-xl font-bold uppercase leading-none'
              + ' tracking-[0.08em] rounded px-1 py-1'
              + ' transition-colors cursor-pointer'
              + ' font-display'
              + ' text-muted'
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
              size={26}
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
                  'w-14 truncate text-[22px] text-left'
                  + ' font-bold uppercase tracking-[0.08em]'
                  + ' leading-none rounded px-1 py-1'
                  + ' transition-colors cursor-pointer'
                  + ' font-display'
                  + ' text-muted'
                }
              >
                AC
              </button>
            </div>
          </Tooltip>
          {/* Spacer matching mute + solo widths */}
          <div className="flex gap-1">
            <div className="w-[26px] h-[26px]" />
            <div className="w-[26px] h-[26px]" />
          </div>
          <div className="flex gap-1.5 ml-2">
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
