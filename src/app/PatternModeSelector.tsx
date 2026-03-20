"use client";

import { useSequencer } from './SequencerContext';
import type { PatternMode } from './types';

const MODE_OPTIONS: {
  value: PatternMode;
  label: string;
}[] = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'direct-start', label: 'Direct Start' },
  { value: 'direct-jump', label: 'Direct Jump' },
];

export default function PatternModeSelector() {
  const { state, actions } = useSequencer();
  const { patternMode, tempState, isPlaying } = state;

  let tempBg: string;
  if (tempState === 'armed') {
    tempBg = 'bg-orange-600 border-orange-500'
      + ' animate-temp-blink';
  } else if (tempState === 'active') {
    tempBg = 'bg-orange-600 border-orange-500'
      + ' shadow-[0_0_12px_rgba(234,88,12,0.4)]';
  } else {
    tempBg = 'bg-neutral-800 border-neutral-700'
      + ' hover:border-neutral-600';
  }

  return (
    <div className="bg-neutral-900/50 p-2 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
      <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold">
        Mode
      </span>
      <div className="flex gap-1 items-stretch">
        <select
          id="mode-select"
          value={patternMode}
          onChange={(e) => {
            actions.setPatternMode(
              e.target.value as PatternMode
            );
          }}
          className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-xs lg:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 hover:border-neutral-600 transition-colors"
        >
          {MODE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => actions.toggleTemp()}
          disabled={!isPlaying}
          aria-pressed={tempState !== 'off'}
          aria-label="Temp mode"
          className={
            'px-2 rounded text-xs lg:text-sm'
            + ' font-bold border transition-colors'
            + ' focus-visible:outline-none'
            + ' focus-visible:ring-2'
            + ' focus-visible:ring-orange-500'
            + ' disabled:opacity-40'
            + ' disabled:cursor-not-allowed '
            + tempBg
          }
        >
          T
        </button>
      </div>
    </div>
  );
}
