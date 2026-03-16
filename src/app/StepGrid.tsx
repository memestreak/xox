"use client";

import { useEffect, useState } from 'react';
import { TRACKS, useSequencer } from './SequencerContext';
import TrackRow from './TrackRow';
import RunningLight from './RunningLight';

/**
 * The main sequencer grid section containing all track
 * rows and the running light indicator. Subscribes to
 * stepRef via requestAnimationFrame to update the visual
 * step highlight without causing full-tree re-renders.
 */
export default function StepGrid() {
  const { state, actions, meta } = useSequencer();
  const {
    currentPattern, trackStates,
    patternLength, trackLengths,
  } = state;
  const {
    toggleStep, toggleMute, toggleSolo,
    setGain, setTrackLength, toggleFreeRun,
  } = actions;
  const { stepRef, totalStepsRef } = meta;

  // Local state driven by rAF, isolated from the context
  // provider so only StepGrid and its children re-render
  // on step ticks.
  const [displayStep, setDisplayStep] = useState(-1);
  const [displayTotal, setDisplayTotal] = useState(0);

  useEffect(() => {
    let raf: number;
    let prev = -1;

    const tick = () => {
      const cur = stepRef.current;
      if (cur !== prev) {
        prev = cur;
        setDisplayStep(cur);
        setDisplayTotal(
          Math.max(0, totalStepsRef.current - 1)
        );
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stepRef, totalStepsRef]);

  return (
    <div className="space-y-2 lg:space-y-4 bg-neutral-900/30 p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-neutral-800/50">
      {TRACKS.map(track => (
        <TrackRow
          key={track.id}
          trackId={track.id}
          trackName={track.name}
          steps={currentPattern.steps[track.id]}
          trackLength={trackLengths[track.id]}
          patternLength={patternLength}
          isMuted={trackStates[track.id].isMuted}
          isSolo={trackStates[track.id].isSolo}
          isFreeRun={
            trackStates[track.id].freeRun
          }
          gain={trackStates[track.id].gain}
          currentStep={displayStep}
          totalSteps={displayTotal}
          onToggleStep={toggleStep}
          onToggleMute={toggleMute}
          onToggleSolo={toggleSolo}
          onSetGain={setGain}
          onSetTrackLength={setTrackLength}
          onToggleFreeRun={toggleFreeRun}
        />
      ))}
      <RunningLight
        currentStep={displayStep}
        patternLength={patternLength}
      />
    </div>
  );
}
