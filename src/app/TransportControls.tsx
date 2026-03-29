"use client";

import { memo } from 'react';
import type { ReactNode } from 'react';
import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import TempoController from './TempoController';
import SettingsPopover from './SettingsPopover';
import GlobalControls from './GlobalControls';
import FillButton from './FillButton';
import PatternModeSelector from './PatternModeSelector';
import { useSequencer } from './SequencerContext';
import PatternPicker from './PatternPicker';
import Tooltip from './Tooltip';
import { getCategorizedPatterns } from './patternUtils';
import type { Pattern } from './types';

const categories = getCategorizedPatterns(
  patternsData.patterns as Pattern[]
);

interface TransportControlsProps {
  pageIndicator?: ReactNode;
}

/**
 * Header section with logo, BPM, play/stop, kit and
 * pattern selectors.
 */
function TransportControlsInner({
  pageIndicator,
}: TransportControlsProps) {
  const { state, actions } = useSequencer();
  const {
    isPlaying, bpm, currentKit,
    selectedPatternId, isLoaded,
  } = state;
  const {
    togglePlay, setBpm, setKit, setPattern,
  } = actions;

  return (
    <header className="bg-neutral-950 safe-area-top safe-area-x border-b border-neutral-800 pb-3 lg:pb-4 space-y-2 lg:space-y-4">
      {/* Row 1: Logo + BPM + Play */}
      <div className="flex justify-between items-center lg:items-end">
        <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
          XOX
        </h1>
        <div className="flex gap-2 lg:gap-4 items-center lg:items-end">
          <TempoController bpm={bpm} setBpm={setBpm} />
          <Tooltip tooltipKey="play" position="bottom">
            <button
              onClick={togglePlay}
              disabled={!isLoaded}
              className={`w-20 lg:w-28 py-2 rounded-full font-bold text-sm lg:text-base text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${isPlaying
                ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                : 'bg-orange-600 hover:bg-orange-700 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isPlaying ? 'STOP' : 'PLAY'}
            </button>
          </Tooltip>
          <FillButton />
          <SettingsPopover />
        </div>
      </div>
      {/* Row 2: Global + Kit + Mode + Pattern */}
      <div className="grid grid-cols-[1fr_1fr_auto_1.5fr] gap-2 lg:gap-4 pt-2 lg:pt-0">
        <GlobalControls />
        <div className="bg-neutral-900/50 p-2 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
          <label
            htmlFor="kit-select"
            className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold"
          >
            Kit
          </label>
          <Tooltip tooltipKey="kit">
            <select
              id="kit-select"
              value={currentKit.id}
              onChange={(e) => {
                const kit = kitsData.kits.find(
                  k => k.id === e.target.value
                );
                if (kit) setKit(kit);
              }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 hover:border-neutral-600 transition-colors"
            >
              {kitsData.kits.map(k => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Tooltip>
        </div>
        <PatternModeSelector />
        <div className="bg-neutral-900/50 p-2 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
          <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold">
            Pattern
          </span>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <PatternPicker
                categories={categories}
                selectedPatternId={selectedPatternId}
                onSelect={setPattern}
              />
            </div>
            {pageIndicator}
          </div>
        </div>
      </div>
    </header>
  );
}

const TransportControls = memo(TransportControlsInner);
export default TransportControls;
