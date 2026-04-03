"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useMidi } from './MidiContext';
import { TRACKS } from './SequencerContext';
import type {
  NoteLength, TrackId,
} from './types';
import { midiEngine } from './MidiEngine';

const NOTE_LENGTH_OPTIONS: {
  label: string;
  value: NoteLength;
}[] = [
  { label: '10 ms',
    value: { type: 'fixed', ms: 10 } },
  { label: '25 ms',
    value: { type: 'fixed', ms: 25 } },
  { label: '50 ms',
    value: { type: 'fixed', ms: 50 } },
  { label: '100 ms',
    value: { type: 'fixed', ms: 100 } },
  { label: '50% of step',
    value: { type: 'percent', value: 50 } },
  { label: '75% of step',
    value: { type: 'percent', value: 75 } },
];

function noteLengthKey(nl: NoteLength): string {
  return nl.type === 'fixed'
    ? `fixed-${nl.ms}`
    : `percent-${nl.value}`;
}

interface MidiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MidiSettings({
  isOpen,
  onClose,
}: MidiSettingsProps) {
  const midi = useMidi();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose]
  );

  if (!midi) return null;
  const {
    available, initialized, config, outputs, updateConfig,
  } = midi;

  const disabled = !available;
  const statusMsg = initialized && !available
    ? 'MIDI not available in this browser'
    : available && outputs.length === 0
      ? 'No MIDI devices detected'
      : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      className="m-auto backdrop:bg-black/60 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl text-neutral-200 p-0 max-w-md w-full"
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">
            MIDI Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {statusMsg && (
          <p className="text-sm text-amber-400 mb-4">
            {statusMsg}
          </p>
        )}

        {/* Enable toggle */}
        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              updateConfig({
                enabled: e.target.checked,
              })
            }
            className="accent-orange-500 w-4 h-4"
          />
          <span className="text-sm">Enable MIDI output</span>
        </label>

        {/* Device picker */}
        <label className="block mb-4">
          <span className="text-sm text-neutral-400 block mb-1">
            Output Device
          </span>
          <select
            value={config.deviceId ?? ''}
            disabled={disabled || outputs.length === 0}
            onChange={(e) => {
              midiEngine.setOutput(e.target.value);
              updateConfig({
                deviceId: e.target.value,
              });
            }}
            className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {outputs.length === 0
                ? 'No devices'
                : 'Select device…'}
            </option>
            {outputs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name || o.id}
              </option>
            ))}
          </select>
        </label>

        {/* Channel */}
        <label className="block mb-4">
          <span className="text-sm text-neutral-400 block mb-1">
            Channel
          </span>
          <input
            type="number"
            min={1}
            max={16}
            value={config.channel}
            disabled={disabled}
            onChange={(e) =>
              updateConfig({
                channel: Math.max(
                  1, Math.min(16,
                    parseInt(e.target.value) || 1)
                ),
              })
            }
            className="w-20 bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>

        {/* Note length */}
        <label className="block mb-6">
          <span className="text-sm text-neutral-400 block mb-1">
            Note Length
          </span>
          <select
            value={noteLengthKey(config.noteLength)}
            disabled={disabled}
            onChange={(e) => {
              const opt = NOTE_LENGTH_OPTIONS.find(
                (o) =>
                  noteLengthKey(o.value) ===
                  e.target.value
              );
              if (opt) {
                updateConfig({
                  noteLength: opt.value,
                });
              }
            }}
            className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {NOTE_LENGTH_OPTIONS.map((opt) => (
              <option
                key={noteLengthKey(opt.value)}
                value={noteLengthKey(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Track note mapping */}
        <div>
          <span className="text-sm text-neutral-400 block mb-2">
            Track Notes (MIDI note 0-127)
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {TRACKS.map((track) => (
              <label
                key={track.id}
                className="flex items-center gap-2"
              >
                <span className="text-xs font-mono w-12 text-neutral-400">
                  {track.id.toUpperCase()}
                </span>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={
                    config.tracks[
                      track.id as Exclude<
                        TrackId, 'ac'
                      >
                    ]?.noteNumber ?? 0
                  }
                  disabled={disabled}
                  onChange={(e) => {
                    const note = Math.max(
                      0,
                      Math.min(
                        127,
                        parseInt(e.target.value) || 0
                      )
                    );
                    updateConfig({
                      tracks: {
                        ...config.tracks,
                        [track.id]: {
                          noteNumber: note,
                        },
                      },
                    });
                  }}
                  className="w-16 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm text-center disabled:opacity-50"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </dialog>
  );
}
