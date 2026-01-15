"use client";

import { useState, useEffect, useCallback } from 'react';
import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import { audioEngine } from './AudioEngine';
import TempoController from './TempoController';
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
  const [currentStep, setCurrentStep] = useState(0); // For visual high-lighting
  const [isLoaded, setIsLoaded] = useState(false);   // Ensuring samples are ready

  // --- Configuration State ---
  const [currentKit, setCurrentKit] = useState<Kit>(kitsData.kits[0]);
  const [currentPattern, setCurrentPattern] = useState<Pattern>(patternsData.patterns[0]);

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
        const gain = isAccented ? state.gain * 1.5 : state.gain;
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
  const handleTogglePlay = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setCurrentStep(0);
    } else {
      audioEngine.start(bpm, (step, time) => {
        handleStep(step, time);
      });
      setIsPlaying(true);
    }
  };

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* --- Header Section --- */}
        <header className="flex justify-between items-end border-b border-neutral-800 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
              XOX
            </h1>
          </div>
          <div className="flex gap-4 items-center">
            <TempoController bpm={bpm} setBpm={setBpm} />
            <button
              onClick={handleTogglePlay}
              disabled={!isLoaded}
              className={`px-8 py-2 rounded-full font-bold transition-all ${isPlaying
                ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                : 'bg-orange-600 hover:bg-orange-700 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isPlaying ? 'STOP' : 'PLAY'}
            </button>
          </div>
        </header>

        {/* --- Controls Section --- */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-900/50 p-4 border border-neutral-800 rounded-xl shadow-inner">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2 block font-bold">Drum Kit</label>
            <select
              value={currentKit.id}
              onChange={(e) => setCurrentKit(kitsData.kits.find(k => k.id === e.target.value)!)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 focus:outline-none hover:border-neutral-600 transition-colors"
            >
              {kitsData.kits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div className="bg-neutral-900/50 p-4 border border-neutral-800 rounded-xl shadow-inner">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2 block font-bold">Pattern</label>
            <select
              value={currentPattern.id}
              onChange={(e) => setCurrentPattern(patternsData.patterns.find(p => p.id === e.target.value)!)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 focus:outline-none hover:border-neutral-600 transition-colors"
            >
              {patternsData.patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* --- Sequencer Grid Section --- */}
        <div className="space-y-4 bg-neutral-900/30 p-6 rounded-2xl border border-neutral-800/50">
          {TRACKS.map(track => (
            <div key={track.id} className="flex gap-4 items-center">
              {/* Track Info & Mute/Solo */}
              <div className="w-32 flex flex-col">
                <span className="text-xs font-bold uppercase text-neutral-400 tracking-wider">{track.name}</span>
                <div className="flex gap-2 mt-1">
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
                </div>
              </div>

              {/* 16-Step Grid */}
              <div className="flex-1 grid grid-cols-16 gap-1.5">
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
            </div>
          ))}

          {/* Running Light (Visual Step Indicator) */}
          <div className="flex gap-4 items-center pt-2">
            <div className="w-32" />
            <div className="flex-1 grid grid-cols-16 gap-1.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-100 ${i === currentStep ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-900'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* --- Footer --- */}
        <footer className="text-center pt-8">
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
