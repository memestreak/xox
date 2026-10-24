"use client";

import { memo } from 'react';
import type { ReactNode } from 'react';
import type { PageNav } from './PageIndicator';
import kitsData from './data/kits.json';
import TempoController from './TempoController';
import SettingsPopover from './SettingsPopover';
import GlobalControls from './GlobalControls';
import FillButton from './FillButton';
import PatternModeSelector from './PatternModeSelector';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import PanelSection from './PanelSection';
import { useHelp } from './HelpContext';
import MasterVolume from './MasterVolume';
import { useMasterVolume } from './hooks/useMasterVolume';
import LcdSelect from './LcdSelect';

const KIT_OPTIONS = kitsData.kits.map(k => ({
  value: k.id,
  label: k.name,
}));

interface TransportControlsProps {
  page: PageNav;
  patternTrigger?: ReactNode;
}

/**
 * Header section with logo, master volume, BPM,
 * play/stop, kit and pattern selectors.
 */
function TransportControlsInner({
  page,
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
  // One state for both placements (header on desktop,
  // strip row below lg) so they never disagree.
  const master = useMasterVolume();
  const help = useHelp();

  return (
    <header className="safe-area-top safe-area-x space-y-3 lg:space-y-[18px]">
      {/* Row 1: logo, then play, tempo, fill, volume, settings */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-logo font-black text-2xl max-[380px]:text-xl lg:text-[32px] leading-none tracking-[0.02em] text-accent">
            X0X
          </h1>
          <span className="ss-label hidden lg:inline text-faint">
            Rhythm sequencer
          </span>
        </div>
        <div className="flex gap-1.5 lg:gap-3 items-center">
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
              {/* Fixed-size icon box and both labels stacked
                  in one grid cell, so the key keeps its width
                  when it toggles between PLAY and STOP. */}
              <span className="inline-flex items-center justify-center w-3.5 h-3.5" aria-hidden="true">
                {isPlaying ? (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
                  </svg>
                )}
              </span>
              <span className="hidden sm:grid" aria-hidden="true">
                <span className={'col-start-1 row-start-1' + (isPlaying ? ' invisible' : '')}>
                  PLAY
                </span>
                <span className={'col-start-1 row-start-1' + (isPlaying ? '' : ' invisible')}>
                  STOP
                </span>
              </span>
            </button>
          </Tooltip>
          <TempoController bpm={bpm} setBpm={setBpm} />
          <FillButton />
          {/* Desktop only; below lg it is a strip row. */}
          <MasterVolume
            variant="header"
            position={master.position}
            onChange={master.setPosition}
            onToggleMute={master.toggleMute}
            onGestureStart={master.beginGesture}
          />
          <SettingsPopover />
          {/* No room in row 1 on phones; there Help is
              in the gear menu. */}
          <Tooltip tooltipKey="help" position="bottom" align="right">
            <button
              type="button"
              onClick={help.open}
              aria-label="Help and shortcuts"
              aria-haspopup="dialog"
              className="ss-key hidden sm:flex w-10 h-10 lg:w-11 lg:h-11 rounded-lg items-center justify-center text-muted hover:text-ink font-display font-bold text-[22px] leading-none"
            >
              ?
            </button>
          </Tooltip>
        </div>
      </div>
      {/* Row 2: one panel strip, hairline dividers. No
          overflow-hidden here: it would clip the tooltips.
          The corner cells round themselves instead.
          Desktop runs Kit, Pattern, Pattern change,
          Steps, Swing. Below lg the rows are Steps +
          Swing, Pattern, Kit + Pattern change, then
          Volume (set by max-lg:order-* on the cells). */}
      <div className="grid grid-cols-6 lg:flex gap-px bg-line border border-line rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
        <PanelSection
          label="Kit"
          labelFor="kit-select"
          className="col-span-2 max-lg:order-4 lg:rounded-l-[11px]"
        >
          <Tooltip tooltipKey="kit" position="bottom">
            <LcdSelect
              id="kit-select"
              value={currentKit.id}
              options={KIT_OPTIONS}
              onChange={(id) => {
                const kit = kitsData.kits.find(
                  k => k.id === id
                );
                if (kit) setKit(kit);
              }}
              className="h-9 w-full lg:w-24"
            />
          </Tooltip>
        </PanelSection>
        <PanelSection
          label="Pattern"
          className="col-span-6 lg:flex-1 max-lg:order-2"
        >
          {patternTrigger}
        </PanelSection>
        <PatternModeSelector />
        <GlobalControls page={page} />
        <MasterVolume
          variant="strip"
          position={master.position}
          onChange={master.setPosition}
          onToggleMute={master.toggleMute}
          onGestureStart={master.beginGesture}
        />
      </div>
    </header>
  );
}

const TransportControls = memo(TransportControlsInner);
export default TransportControls;
