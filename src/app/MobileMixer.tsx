"use client";

import { TRACKS, useSequencer } from './SequencerContext';
import TrackToggle from './TrackToggle';

/**
 * Mobile-only mixer panel with mute/solo toggles and
 * volume sliders for each track.
 */
export default function MobileMixer() {
  const { state, actions } = useSequencer();
  const { trackStates } = state;
  const { toggleMute, toggleSolo, setGain } = actions;

  return (
    <div className="lg:hidden space-y-2 bg-neutral-900/30 p-3 rounded-xl border border-neutral-800/50">
      {TRACKS.map(track => (
        <div
          key={track.id}
          className="flex items-center gap-2 bg-neutral-900 rounded-lg p-2 border border-neutral-800"
        >
          <span className="w-12 text-[10px] font-bold uppercase text-neutral-400 tracking-wider truncate">
            {track.name}
          </span>
          <TrackToggle
            variant="mute"
            active={trackStates[track.id].isMuted}
            trackName={track.name}
            size="sm"
            onToggle={() => toggleMute(track.id)}
          />
          <TrackToggle
            variant="solo"
            active={trackStates[track.id].isSolo}
            trackName={track.name}
            size="sm"
            onToggle={() => toggleSolo(track.id)}
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={trackStates[track.id].gain}
            onChange={(e) =>
              setGain(
                track.id,
                Number(e.target.value)
              )
            }
            aria-label={`Volume ${track.name}`}
            aria-valuenow={
              Math.round(
                trackStates[track.id].gain * 100
              )
            }
            className="flex-1"
          />
        </div>
      ))}
    </div>
  );
}
