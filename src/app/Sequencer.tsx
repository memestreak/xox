"use client";

import { useState, useEffect, useCallback } from 'react';
import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import { audioEngine } from './AudioEngine';
import TempoController from './TempoController';
import Knob from './Knob';
import { Kit, Pattern, TrackId, TrackState } from './types';

/**
 * Constants defining the instruments available in the sequencer.
 */
const TRACKS: { id: TrackId; name: string }[] = [
  { id: 'bd', name: 'Kick' },
  { id: 'sd', name: 'Snare' },
  { id: 'ch', name: 'C-Hat' },
  { id: 'oh', name: 'O-Hat' },
  { id: 'cy', name: 'Cymbal' },
  { id: 'ht', name: 'Hi-Tom' },
  { id: 'mt', name: 'Mid-Tom' },
  { id: 'lt', name: 'Low-Tom' },
  { id: 'rs', name: 'Rimshot' },
  { id: 'cp', name: 'Clap' },
  { id: 'cb', name: 'Cowbell' },
];

/**
 * The primary UI component for the 16-step drum sequencer.
 * Manages playback state, track settings (mute/solo), and visual synchronization.
 */
export default function Sequencer() {
  // --- Playback State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(110);
  const [currentStep, setCurrentStep] = useState(-1); // -1 = no active step
  const [isLoaded, setIsLoaded] = useState(false);   // Ensuring samples are ready

  // --- Configuration State ---
  const [currentKit, setCurrentKit] = useState<Kit>(kitsData.kits[0]);
  const [currentPattern, setCurrentPattern] = useState<Pattern>(patternsData.patterns[0]);

  // --- Mobile Mixer Panel ---
  const [showMixer, setShowMixer] = useState(false);

  // --- Track Mixer State ---
  const [trackStates, setTrackStates] = useState<Record<TrackId, TrackState>>({
    ac: { id: 'ac', name: 'Accent', isMuted: false, isSolo: false, gain: 1.0 },
    bd: { id: 'bd', name: 'Kick', isMuted: false, isSolo: false, gain: 1.0 },
    sd: { id: 'sd', name: 'Snare', isMuted: false, isSolo: false, gain: 1.0 },
    ch: { id: 'ch', name: 'C-Hat', isMuted: false, isSolo: false, gain: 1.0 },
    oh: { id: 'oh', name: 'O-Hat', isMuted: false, isSolo: false, gain: 1.0 },
    cy: { id: 'cy', name: 'Cymbal', isMuted: false, isSolo: false, gain: 1.0 },
    ht: { id: 'ht', name: 'Hi-Tom', isMuted: false, isSolo: false, gain: 1.0 },
    mt: { id: 'mt', name: 'Mid-Tom', isMuted: false, isSolo: false, gain: 1.0 },
    lt: { id: 'lt', name: 'Low-Tom', isMuted: false, isSolo: false, gain: 1.0 },
    rs: { id: 'rs', name: 'Rimshot', isMuted: false, isSolo: false, gain: 1.0 },
    cp: { id: 'cp', name: 'Clap', isMuted: false, isSolo: false, gain: 1.0 },
    cb: { id: 'cb', name: 'Cowbell', isMuted: false, isSolo: false, gain: 1.0 },
  });

  /**
   * Effect: Load kit samples into the AudioEngine whenever the kit selection changes.
   */
  useEffect(() => {
    const load = async () => {
      setIsLoaded(false);
      await audioEngine.preloadKit(currentKit.folder);
      setIsLoaded(true);
    };
    load();
  }, [currentKit]);

  /**
   * Effect: Stop the audio engine when the component unmounts.
   */
  useEffect(() => {
    return () => { audioEngine.stop(); };
  }, []);

  /**
   * Effect: Keep the AudioEngine's internal BPM in sync with the UI state.
   */
  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  /**
   * handleStep is called by the AudioEngine's scheduler for every 16th note.
   * 
   * @param step The index of the step (0-15)
   * @param time The precise AudioContext time the step should occur
   */
  const handleStep = useCallback((step: number, time: number) => {
    // 1. Visual update (use requestAnimationFrame to avoid stuttering during audio processing)
    requestAnimationFrame(() => setCurrentStep(step));

    // 2. Audio trigger logic
    const anySoloActive = Object.values(trackStates).some(t => t.isSolo);
    const isAccented = currentPattern.steps.ac[step] === '1';

    TRACKS.forEach(track => {

      const state = trackStates[track.id];

      // SOLO/MUTE Logic:
      // If ANY track is soloed, ONLY soloed tracks play.
      // Otherwise, any track that isn't muted plays.
      const isVisible = anySoloActive ? state.isSolo : !state.isMuted;

      // Trigger if track is active and the pattern has a '1' at this step
      if (isVisible && currentPattern.steps[track.id][step] === '1') {
        const perceptualGain = state.gain * state.gain * state.gain;
        const gain = isAccented ? perceptualGain * 1.5 : perceptualGain;
        audioEngine.playSound(track.id, time, gain);
      }
    });
  }, [trackStates, currentPattern]);

  /**
   * Effect: Update the AudioEngine's step callback whenever dependencies change.
   */
  useEffect(() => {
    if (isPlaying) {
      audioEngine.onStep = (step, time) => handleStep(step, time);
    }
  }, [handleStep, isPlaying]);

  /**
   * Toggles the playback state.
   */
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      audioEngine.start(bpm, (step, time) => {
        handleStep(step, time);
      });
      setIsPlaying(true);
    }
  }, [isPlaying, bpm, handleStep]);

  /**
   * Effect: Global spacebar shortcut to toggle play/stop.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLoaded) return;
      if (event.code !== 'Space') return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      handleTogglePlay();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, isLoaded]);

  /**
   * Toggles a specific step's active state.
   */
  const toggleStep = (trackId: TrackId, stepIndex: number) => {
    setCurrentPattern(prev => {
      const currentTrackSteps = prev.steps[trackId];
      const newChar = currentTrackSteps[stepIndex] === '1' ? '0' : '1';
      const newTrackSteps = currentTrackSteps.substring(0, stepIndex) + newChar + currentTrackSteps.substring(stepIndex + 1);

      return {
        ...prev,
        steps: {
          ...prev.steps,
          [trackId]: newTrackSteps
        }
      };
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-3 lg:p-8 font-sans">
      <div className="max-w-none lg:max-w-4xl mx-auto space-y-4 lg:space-y-8">
        {/* --- Sticky Header (mobile) / Static Header (desktop) --- */}
        <header className="sticky top-0 z-20 bg-neutral-950 safe-area-top safe-area-x border-b border-neutral-800 pb-3 lg:pb-6 lg:static space-y-2 lg:space-y-0">
          {/* Row 1: Logo + BPM + Play */}
          <div className="flex justify-between items-center lg:items-end">
            <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
              XOX
            </h1>
            <div className="flex gap-2 lg:gap-4 items-center lg:items-end">
              <TempoController bpm={bpm} setBpm={setBpm} />
              <button
                onClick={handleTogglePlay}
                disabled={!isLoaded}
                className={`px-4 lg:px-8 py-2 rounded-full font-bold text-sm lg:text-base transition-all ${isPlaying
                  ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                  : 'bg-orange-600 hover:bg-orange-700 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                  } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isPlaying ? 'STOP' : 'PLAY'}
              </button>
            </div>
          </div>
          {/* Row 2: Kit + Pattern (inside sticky zone) */}
          <div className="grid grid-cols-2 gap-2 lg:gap-4 pt-2 lg:pt-0">
            <div className="bg-neutral-900/50 p-2 lg:p-4 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
              <label className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 lg:mb-2 block font-bold">Drum Kit</label>
              <select
                value={currentKit.id}
                onChange={(e) => setCurrentKit(kitsData.kits.find(k => k.id === e.target.value)!)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-sm focus:outline-none hover:border-neutral-600 transition-colors"
              >
                {kitsData.kits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div className="bg-neutral-900/50 p-2 lg:p-4 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
              <label className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 lg:mb-2 block font-bold">Pattern</label>
              <select
                value={currentPattern.id}
                onChange={(e) => setCurrentPattern(patternsData.patterns.find(p => p.id === e.target.value)!)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-sm focus:outline-none hover:border-neutral-600 transition-colors"
              >
                {patternsData.patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </header>

        <div className={showMixer ? 'hidden lg:block' : ''}>
        {/* --- Sequencer Grid Section --- */}
        <div className="space-y-2 lg:space-y-4 bg-neutral-900/30 p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-neutral-800/50">
          {TRACKS.map(track => (
            <div key={track.id}>
              {/* Mobile: track name + M/S above grid */}
              <div className="flex items-center gap-2 mb-1 lg:hidden">
                <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
                  {track.name}
                </span>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => setTrackStates(prev => ({
                      ...prev, [track.id]: { ...prev[track.id], isMuted: !prev[track.id].isMuted }
                    }))}
                    className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[8px] rounded font-bold border transition-all ${trackStates[track.id].isMuted
                      ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                      }`}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    onClick={() => setTrackStates(prev => ({
                      ...prev, [track.id]: { ...prev[track.id], isSolo: !prev[track.id].isSolo }
                    }))}
                    className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[8px] rounded font-bold border transition-all ${trackStates[track.id].isSolo
                      ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                      }`}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                {/* Desktop: sidebar with name, M/S, knob */}
                <div className="hidden lg:flex w-48 items-center gap-2">
                  <span className="w-16 truncate text-xs font-bold uppercase text-neutral-400 tracking-wider">
                    {track.name}
                  </span>
                  <button
                    onClick={() => setTrackStates(prev => ({
                      ...prev, [track.id]: { ...prev[track.id], isMuted: !prev[track.id].isMuted }
                    }))}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] rounded-md font-bold border transition-all ${trackStates[track.id].isMuted
                      ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600'
                      }`}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    onClick={() => setTrackStates(prev => ({
                      ...prev, [track.id]: { ...prev[track.id], isSolo: !prev[track.id].isSolo }
                    }))}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] rounded-md font-bold border transition-all ${trackStates[track.id].isSolo
                      ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600'
                      }`}
                    title="Solo"
                  >
                    S
                  </button>
                  <Knob
                    value={trackStates[track.id].gain}
                    onChange={(v) => setTrackStates(prev => ({
                      ...prev,
                      [track.id]: { ...prev[track.id], gain: v }
                    }))}
                  />
                </div>

                {/* Step grid: 2x8 on mobile, 1x16 on desktop */}
                <div className="flex-1">
                  {/* Desktop: 1x16 */}
                  <div className="hidden lg:grid grid-cols-16 gap-1.5">
                    {currentPattern.steps[track.id].split('').map((step, i) => (
                      <div
                        key={i}
                        onClick={() => toggleStep(track.id, i)}
                        className={`h-12 rounded-sm transition-all duration-100 cursor-pointer ${step === '1'
                          ? (i === currentStep ? 'bg-orange-400 scale-105 shadow-[0_0_20px_rgba(251,146,60,0.8)] z-10' : 'bg-orange-600')
                          : (i === currentStep ? 'bg-neutral-700' : 'bg-neutral-800/40 hover:bg-neutral-800')
                          } ${i % 4 === 0 ? 'border-l-2 border-neutral-700' : ''}`}
                      />
                    ))}
                  </div>
                  {/* Mobile: 2x8 */}
                  <div className="lg:hidden space-y-[3px]">
                    {[0, 8].map(rowStart => (
                      <div key={rowStart} className="grid grid-cols-8 gap-[3px]">
                        {currentPattern.steps[track.id].slice(rowStart, rowStart + 8).split('').map((step, posInRow) => {
                          const i = rowStart + posInRow;
                          return (
                            <div
                              key={i}
                              onClick={() => toggleStep(track.id, i)}
                              className={`h-8 rounded-sm transition-all duration-100 cursor-pointer ${step === '1'
                                ? (i === currentStep ? 'bg-orange-400 scale-105 shadow-[0_0_20px_rgba(251,146,60,0.8)] z-10' : 'bg-orange-600')
                                : (i === currentStep ? 'bg-neutral-700' : 'bg-neutral-800/40 hover:bg-neutral-800')
                                } ${posInRow % 4 === 0 ? 'border-l-2 border-neutral-700' : ''}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Running Light (Visual Step Indicator) */}
          <div className="flex gap-4 items-center pt-2">
            {/* Desktop spacer for sidebar alignment */}
            <div className="hidden lg:block w-48" />
            <div className="flex-1">
              {/* Desktop: 1x16 */}
              <div className="hidden lg:grid grid-cols-16 gap-1.5">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-100 ${i === currentStep ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-900'}`}
                  />
                ))}
              </div>
              {/* Mobile: 2x8 */}
              <div className="lg:hidden space-y-[3px]">
                {[0, 8].map(rowStart => (
                  <div key={rowStart} className="grid grid-cols-8 gap-[3px]">
                    {Array.from({ length: 8 }).map((_, posInRow) => {
                      const i = rowStart + posInRow;
                      return (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-100 ${i === currentStep ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-900'}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Mobile Mixer Panel */}
        {showMixer && (
          <div className="lg:hidden space-y-2 bg-neutral-900/30 p-3 rounded-xl border border-neutral-800/50">
            {TRACKS.map(track => (
              <div key={track.id} className="flex items-center gap-2 bg-neutral-900 rounded-lg p-2 border border-neutral-800">
                <span className="w-12 text-[10px] font-bold uppercase text-neutral-400 tracking-wider truncate">
                  {track.name}
                </span>
                <button
                  onClick={() => setTrackStates(prev => ({
                    ...prev, [track.id]: { ...prev[track.id], isMuted: !prev[track.id].isMuted }
                  }))}
                  className={`shrink-0 w-[26px] h-[22px] flex items-center justify-center text-[9px] rounded font-bold border transition-all ${trackStates[track.id].isMuted
                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                    }`}
                >
                  M
                </button>
                <button
                  onClick={() => setTrackStates(prev => ({
                    ...prev, [track.id]: { ...prev[track.id], isSolo: !prev[track.id].isSolo }
                  }))}
                  className={`shrink-0 w-[26px] h-[22px] flex items-center justify-center text-[9px] rounded font-bold border transition-all ${trackStates[track.id].isSolo
                    ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                    }`}
                >
                  S
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={trackStates[track.id].gain}
                  onChange={(e) => setTrackStates(prev => ({
                    ...prev,
                    [track.id]: { ...prev[track.id], gain: Number(e.target.value) }
                  }))}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}

        {/* Mobile Mixer Toggle Button */}
        <button
          onClick={() => setShowMixer(prev => !prev)}
          className={`lg:hidden w-full rounded-lg py-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${showMixer
            ? 'bg-orange-600 text-white'
            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:border-neutral-600'
            }`}
        >
          {showMixer ? 'BACK TO SEQUENCER' : 'MIXER'}
        </button>

        {/* --- Footer --- */}
        <footer className="text-center pt-4 lg:pt-8">
          <a
            href="https://github.com/memestreak/xox"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-neutral-600 uppercase tracking-[0.2em] font-bold hover:text-orange-500 transition-colors"
          >
            Source Code
          </a>
        </footer>
      </div>
    </div>
  );
}
