"use client";

import { useSequencer } from './SequencerContext';
import type { PatternMode } from './types';
import Tooltip from './Tooltip';
import PanelSection from './PanelSection';

const MODE_OPTIONS: {
  value: PatternMode;
  label: string;
}[] = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'direct-start', label: 'Direct start' },
  { value: 'direct-jump', label: 'Direct jump' },
];

export default function PatternModeSelector() {
  const { state, actions } = useSequencer();
  const { patternMode, tempState, isPlaying } = state;

  // Temp: blinking LED while armed, lit while active.
  let tempLook: string;
  let ledLook: string;
  if (tempState === 'armed') {
    tempLook = 'border-accent text-accent-hi';
    ledLook = 'ss-led-on animate-temp-blink';
  } else if (tempState === 'active') {
    tempLook = 'border-accent text-ink'
      + ' shadow-[0_0_12px_rgb(240_102_42/0.35)]';
    ledLook = 'ss-led-on';
  } else {
    tempLook = 'text-muted';
    ledLook = '';
  }

  return (
    <PanelSection
      label="Pattern change"
      labelFor="mode-select"
      className="col-span-4 max-lg:order-1"
    >
      <div className="flex gap-1.5 items-stretch">
        <Tooltip tooltipKey="mode" position="bottom">
          <select
            id="mode-select"
            value={patternMode}
            onChange={(e) => {
              actions.setPatternMode(
                e.target.value as PatternMode
              );
            }}
            className="ss-key ss-select h-9 w-full lg:w-[140px] pl-3 text-sm"
          >
            {MODE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Tooltip>
        {/* The span carries the tooltip so it isn't
            dimmed with the disabled button. */}
        <Tooltip
          tooltipKey={isPlaying ? 'temp' : 'tempStopped'}
          position="bottom"
        >
          <span className="inline-flex">
            <button
              onClick={() => actions.toggleTemp()}
              disabled={!isPlaying}
              aria-pressed={tempState !== 'off'}
              aria-label="Temp mode"
              className={
                'ss-key ss-cap h-9 px-2.5 text-xs'
                + ' inline-flex items-center gap-1.5'
                + ' disabled:opacity-40'
                + ' disabled:cursor-not-allowed '
                + tempLook
              }
            >
              <span className={'ss-led ' + ledLook} />
              Temp
            </button>
          </span>
        </Tooltip>
      </div>
    </PanelSection>
  );
}
