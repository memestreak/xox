"use client";

import { useSequencer } from './SequencerContext';
import type { PatternMode } from './types';
import Tooltip from './Tooltip';
import PanelSection from './PanelSection';
import LatchKey from './LatchKey';
import LcdSelect from './LcdSelect';
import type { LcdSelectOption } from './LcdSelect';

const MODE_OPTIONS: LcdSelectOption<PatternMode>[] = [
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
          <LcdSelect
            id="mode-select"
            value={patternMode}
            options={MODE_OPTIONS}
            onChange={actions.setPatternMode}
            className="h-9 w-full lg:w-[140px]"
          />
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
