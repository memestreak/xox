"use client";

import { useSequencer } from './SequencerContext';
import type { PatternMode } from './types';
import Tooltip from './Tooltip';
import PanelSection from './PanelSection';
import LatchKey from './LatchKey';

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
  const {
    patternMode, tempState, isTempLatched, isPlaying,
  } = state;

  return (
    <PanelSection
      label="Pattern change"
      labelFor="mode-select"
      className="col-span-4 max-lg:order-4"
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
        <LatchKey
          label="TEMP"
          name="Temp"
          bodyAriaLabel="Temp mode"
          size="strip"
          body={tempState}
          latched={isTempLatched}
          bodyDisabled={!isPlaying}
          bodyTooltipKey={isPlaying ? 'temp' : 'tempStopped'}
          latchTooltipKey="tempLatch"
          onBodyClick={actions.toggleTemp}
          onLatch={actions.toggleTempLatch}
        />
      </div>
    </PanelSection>
  );
}
