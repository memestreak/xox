"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTooltips } from './TooltipContext';
import { useMidi } from './MidiContext';
import { TRACKS } from './types';
import type {
  NoteLength, TrackId,
} from './types';
import { midiEngine } from './MidiEngine';
import LcdSelect from './LcdSelect';
import {
  setAutoMinimize, useAutoMinimizeSetting,
} from './hooks/useAutoMinimizeSetting';

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

const NOTE_LENGTH_SELECT_OPTIONS = NOTE_LENGTH_OPTIONS.map(
  o => ({ value: noteLengthKey(o.value), label: o.label })
);

type Tab = 'options' | 'midi';

const TABS: { id: Tab; label: string }[] = [
  { id: 'options', label: 'Options' },
  { id: 'midi', label: 'MIDI' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const {
    tooltipsEnabled, setTooltipsEnabled,
  } = useTooltips();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>(
    'options'
  );

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

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="ss-menu m-auto backdrop:bg-black/60 rounded-xl text-ink p-0 max-w-lg w-full"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="ss-cap text-xl">
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ss-key w-8 h-8 flex items-center justify-center text-muted hover:text-ink text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-4 border-b border-line mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ss-cap px-1 pb-2 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'options' && (
          <OptionsTab
            tooltipsEnabled={tooltipsEnabled}
            setTooltipsEnabled={setTooltipsEnabled}
          />
        )}
        {activeTab === 'midi' && <MidiTab />}
      </div>
    </dialog>
  );
}

/* ── Options Tab ─────────────────────────────── */

function OptionsTab({
  tooltipsEnabled,
  setTooltipsEnabled,
}: {
  tooltipsEnabled: boolean;
  setTooltipsEnabled: (v: boolean) => void;
}) {
  const autoMinimize = useAutoMinimizeSetting();
  return (
    <div className="flex flex-col gap-3">
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={tooltipsEnabled}
        onChange={(e) =>
          setTooltipsEnabled(e.target.checked)
        }
        aria-label="Show tooltips"
        className="accent-[#f0662a] w-4 h-4"
      />
      <span className="text-sm">Show tooltips</span>
    </label>
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={autoMinimize}
        onChange={(e) =>
          setAutoMinimize(e.target.checked)
        }
        aria-label="Auto-minimize empty tracks"
        className="accent-[#f0662a] w-4 h-4"
      />
      <span className="text-sm">
        Auto-minimize empty tracks
      </span>
    </label>
    </div>
  );
}

/* ── MIDI Tab ────────────────────────────────── */

function MidiTab() {
  const midi = useMidi();

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
    <>
      {statusMsg && (
        <p className="text-sm text-lcd mb-4">
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
          aria-label="Enable MIDI output"
          className="accent-[#f0662a] w-4 h-4"
        />
        <span className="text-sm">Enable MIDI output</span>
      </label>

      {/* Device picker */}
      <div className="mb-4">
        <span
          id="midi-device-label"
          className="ss-label block mb-1"
        >
          Output Device
        </span>
        <LcdSelect
          aria-labelledby="midi-device-label"
          value={config.deviceId ?? ''}
          options={[
            {
              value: '',
              label: outputs.length === 0
                ? 'No devices'
                : 'Select device…',
            },
            ...outputs.map(o => ({
              value: o.id,
              label: o.name || o.id,
            })),
          ]}
          disabled={disabled || outputs.length === 0}
          onChange={(deviceId) => {
            midiEngine.setOutput(deviceId);
            updateConfig({ deviceId });
          }}
          className="w-full h-9"
        />
      </div>

      {/* Channel */}
      <label className="block mb-4">
        <span className="ss-label block mb-1">
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
          aria-label="MIDI channel"
          className="w-20 h-9 bg-well border border-line rounded-md px-3 font-mono text-sm text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>

      {/* Note length */}
      <div className="mb-6">
        <span
          id="midi-note-length-label"
          className="ss-label block mb-1"
        >
          Note Length
        </span>
        <LcdSelect
          aria-labelledby="midi-note-length-label"
          value={noteLengthKey(config.noteLength)}
          options={NOTE_LENGTH_SELECT_OPTIONS}
          disabled={disabled}
          onChange={(key) => {
            const opt = NOTE_LENGTH_OPTIONS.find(
              (o) => noteLengthKey(o.value) === key
            );
            if (opt) {
              updateConfig({
                noteLength: opt.value,
              });
            }
          }}
          className="w-full h-9"
        />
      </div>

      {/* Track note mapping */}
      <div>
        <span className="ss-label block mb-2">
          Track Notes (MIDI note 0-127)
        </span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {TRACKS.map((track) => (
            <label
              key={track.id}
              className="flex items-center gap-2"
            >
              <span className="ss-cap text-sm w-12 text-muted">
                {track.id.toUpperCase()}
              </span>
              <input
                type="number"
                min={0}
                max={127}
                aria-label={`${track.id.toUpperCase()} MIDI note`}
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
                className="w-16 h-8 bg-well border border-line rounded-md px-2 font-mono text-sm text-center text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
