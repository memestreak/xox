"use client";

import { memo } from 'react';
import type { ReactNode } from 'react';
import kitsData from './data/kits.json';
import TempoController from './TempoController';
import SettingsPopover from './SettingsPopover';
import GlobalControls from './GlobalControls';
import FillButton from './FillButton';
import PatternModeSelector from './PatternModeSelector';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import PanelSection from './PanelSection';

interface TransportControlsProps {
  pageIndicator?: ReactNode;
  patternTrigger?: ReactNode;
}

/**
 * Header section with logo, BPM, play/stop, kit and
 * pattern selectors.
 */
function TransportControlsInner({
  pageIndicator,
  patternTrigger,
}: TransportControlsProps) {
  const { state, actions } = useSequencer();
  const {
    isPlaying, bpm, currentKit,
    isLoaded,
  } = state;
  const {
    togglePlay, setBpm, setKit,
  } = actions;

  return (
    <header className="safe-area-top safe-area-x space-y-3 lg:space-y-[18px]">
      {/* Row 1: Logo + tempo + transport */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-logo font-black text-2xl lg:text-[32px] leading-none tracking-[0.02em] text-accent">
            X0X
          </h1>
          <span className="ss-label hidden lg:inline text-faint">
            Rhythm sequencer
          </span>
        </div>
        <div className="flex gap-1.5 lg:gap-3 items-center">
          <TempoController bpm={bpm} setBpm={setBpm} />
          <Tooltip tooltipKey="play" position="bottom">
            <button
              onClick={togglePlay}
              disabled={!isLoaded}
              aria-label={isPlaying ? 'Stop playback' : 'Start playback'}
              aria-pressed={isPlaying}
              className={
                'ss-cap h-10 lg:h-11 px-3 lg:pl-[18px] lg:pr-[22px]'
                + ' inline-flex items-center justify-center gap-2 lg:gap-2.5'
                + ' rounded-lg border text-sm lg:text-[17px]'
                + ' transition-colors focus-visible:outline-2'
                + ' focus-visible:outline-offset-2'
                + ' focus-visible:outline-accent'
                + (isPlaying
                  ? ' bg-[#2a1a12] border-accent text-accent-hi'
                    + ' shadow-[inset_0_2px_6px_rgb(0_0_0/0.6),0_0_16px_rgb(240_102_42/0.25)]'
                  : ' bg-linear-to-b from-[#f57a3e] to-[#e0561f]'
                    + ' border-accent-hi text-[#1a0d05]'
                    + ' shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-3px_0_rgb(0_0_0/0.18),0_6px_18px_rgb(240_102_42/0.25)]'
                    + ' hover:from-[#f88a52] hover:to-[#e86228]')
                + (!isLoaded ? ' opacity-50 cursor-wait' : '')
              }
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
                </svg>
              )}
              <span className="hidden sm:inline">
                {isPlaying ? 'STOP' : 'PLAY'}
              </span>
            </button>
          </Tooltip>
          <FillButton />
          <SettingsPopover />
        </div>
      </div>
      {/* Row 2: one panel strip, hairline dividers. No
          overflow-hidden here: it would clip the tooltips.
          The corner cells round themselves instead. */}
      <div className="grid grid-cols-6 lg:flex gap-px bg-line border border-line rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
        <GlobalControls />
        <PanelSection
          label="Kit"
          labelFor="kit-select"
          className="col-span-2"
        >
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
              className="ss-key ss-select h-9 w-full lg:w-24 pl-3 text-sm"
            >
              {kitsData.kits.map(k => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Tooltip>
        </PanelSection>
        <PatternModeSelector />
        <PanelSection
          label="Pattern"
          className="col-span-6 lg:flex-1 rounded-b-[11px] lg:rounded-none"
        >
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              {patternTrigger}
            </div>
            {pageIndicator}
          </div>
        </PanelSection>
      </div>
    </header>
  );
}

const TransportControls = memo(TransportControlsInner);
export default TransportControls;
