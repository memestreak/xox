"use client";

import { memo, useCallback } from 'react';
import Knob from './Knob';
import { useSequencer } from './SequencerContext';

/**
 * Global controls section: pattern length, swing, and
 * clear all.
 */
function GlobalControlsInner() {
  const { state, actions } = useSequencer();

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

  return (
    <div className="bg-neutral-900/50 p-2 lg:p-4 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
      <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 lg:mb-2 block font-bold">
        Global
      </span>
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Steps dropdown */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[7px] lg:text-[8px] uppercase tracking-wider text-neutral-600">
            Steps
          </span>
          <select
            id="global-steps"
            value={state.patternLength}
            onChange={handlePatternLength}
            className="bg-neutral-800 border border-neutral-700 rounded p-1 text-xs lg:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 hover:border-neutral-600 transition-colors w-12 lg:w-14"
          >
            {Array.from(
              { length: 16 },
              (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              )
            )}
          </select>
        </div>

        {/* Swing knob */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[7px] lg:text-[8px] uppercase tracking-wider text-neutral-600">
            Swing
          </span>
          <Knob
            value={state.swing / 100}
            onChange={handleSwing}
            size={20}
          />
          <span className="text-[7px] lg:text-[8px] text-neutral-600">
            {state.swing}%
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear button */}
        <button
          onClick={actions.clearAll}
          className="bg-neutral-800 border border-neutral-700 rounded px-1.5 lg:px-2 py-1 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <span className="hidden lg:inline">
            Clr
          </span>
          <span className="lg:hidden">C</span>
        </button>
      </div>
    </div>
  );
}

const GlobalControls = memo(GlobalControlsInner);
export default GlobalControls;
