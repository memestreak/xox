"use client";

import { memo, useCallback } from 'react';
import Knob from './Knob';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import { getPatternLength } from './types';

/**
 * Global controls section: pattern length, swing, and
 * clear all.
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
    actions.clearAll();
    actions.setPatternLength(16);
    actions.setSwing(0);
  }, [actions]);

  return (
    <div className="bg-neutral-900/50 p-2 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
      <div className="flex items-end gap-2 lg:gap-3">
        {/* Steps dropdown */}
        <div>
          <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold text-center">
            Steps
          </span>
          <Tooltip tooltipKey="steps">
            <select
              id="global-steps"
              value={patternLength}
              onChange={handlePatternLength}
              className="bg-neutral-800 border border-neutral-700 rounded p-1 text-xs lg:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 hover:border-neutral-600 transition-colors w-12 lg:w-14"
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
        </div>

        {/* Swing knob */}
        <div className="text-center">
          <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold">
            Swing
          </span>
          <Tooltip tooltipKey="swing">
            <Knob
              value={state.swing / 100}
              onChange={handleSwing}
              size={32}
              centerLabel={`${state.swing}%`}
              defaultValue={0}
            />
          </Tooltip>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Reset button */}
        <Tooltip tooltipKey="reset">
          <button
            onClick={handleReset}
            className="h-8 bg-neutral-800 border border-neutral-700 rounded px-1.5 lg:px-2 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-neutral-400 hover:text-red-400 hover:border-red-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            Reset
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

const GlobalControls = memo(GlobalControlsInner);
export default GlobalControls;
