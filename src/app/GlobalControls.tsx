"use client";

import { memo, useCallback } from 'react';
import Knob from './Knob';
import PanelSection from './PanelSection';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import { getPatternLength } from './types';

/**
 * Global controls: pattern length, swing, and reset.
 * Renders three cells of the controls strip; the
 * parent places them (Reset sits last on desktop).
 */
function GlobalControlsInner() {
  const { state, actions, meta } = useSequencer();
  const patternLength = getPatternLength(meta.config.tracks);

  const handlePatternLength = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      actions.setPatternLength(
        parseInt(e.target.value, 10)
      );
    },
    [actions]
  );

  const handleSwing = useCallback(
    (v: number) => {
      actions.setSwing(Math.round(v * 100));
    },
    [actions]
  );

  const handleReset = useCallback(() => {
    const ok = window.confirm(
      'Reset clears every track and setting. Continue?'
    );
    if (!ok) return;
    actions.clearAll();
    actions.setPatternLength(16);
    actions.setSwing(0);
  }, [actions]);

  return (
    <>
      <PanelSection
        label="Steps"
        labelFor="global-steps"
        className="col-span-2"
      >
        <Tooltip tooltipKey="steps">
          <select
            id="global-steps"
            value={patternLength}
            onChange={handlePatternLength}
            className="ss-key ss-select h-9 w-full lg:w-[76px] pl-3 font-mono text-sm"
          >
            {Array.from(
              { length: 64 },
              (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              )
            )}
          </select>
        </Tooltip>
      </PanelSection>

      <PanelSection label="Swing" className="col-span-2">
        <div className="flex items-center gap-2.5 h-9">
          <Tooltip tooltipKey="swing">
            <Knob
              value={state.swing / 100}
              onChange={handleSwing}
              size={34}
              ariaPrefix="Swing"
              defaultValue={0}
            />
          </Tooltip>
          <span className="font-mono text-sm text-ink w-9 tabular-nums">
            {state.swing}%
          </span>
        </div>
      </PanelSection>

      <PanelSection className="col-span-2 justify-end lg:order-last">
        <Tooltip tooltipKey="reset">
          <button
            onClick={handleReset}
            className="ss-key ss-cap h-9 px-3 text-xs text-muted hover:text-step1"
          >
            Reset
          </button>
        </Tooltip>
      </PanelSection>
    </>
  );
}

const GlobalControls = memo(GlobalControlsInner);
export default GlobalControls;
