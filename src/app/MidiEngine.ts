"use client";

import type {
  MidiConfig, NoteLength, TrackId,
} from './types';
import { defaultMidiConfig } from './types';

const STORAGE_KEY = 'xox-midi';

export class MidiEngine {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private config: MidiConfig;
  private bpm: number = 120;
  private initPromise: Promise<boolean> | null = null;
  private onDeviceChange:
    ((outputs: MIDIOutput[]) => void) | null = null;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): MidiConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return validateMidiConfig(JSON.parse(raw));
    } catch { /* ignore */ }
    return defaultMidiConfig();
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.config)
      );
    } catch { /* ignore */ }
  }

  async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.requestMIDIAccess
    ) {
      return false;
    }
    try {
      this.access = await navigator.requestMIDIAccess(
        { sysex: false }
      );
    } catch {
      return false;
    }

    // Auto-select saved device if available
    if (this.config.deviceId) {
      const saved = this.access.outputs.get(
        this.config.deviceId
      );
      if (saved) this.output = saved;
    }

    // Listen for hotplug
    this.access.addEventListener(
      'statechange',
      this.handleStateChange
    );

    return true;
  }

  private handleStateChange = (): void => {
    if (!this.access) return;

    // Check if current output disconnected
    if (
      this.output &&
      this.output.state === 'disconnected'
    ) {
      this.output = null;
    }

    // Try to reconnect saved device
    if (!this.output && this.config.deviceId) {
      const saved = this.access.outputs.get(
        this.config.deviceId
      );
      if (saved && saved.state === 'connected') {
        this.output = saved;
      }
    }

    // Notify UI
    if (this.onDeviceChange) {
      this.onDeviceChange(this.getOutputs());
    }
  };

  isAvailable(): boolean {
    return this.access !== null;
  }

  getOutputs(): MIDIOutput[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values());
  }

  setOutput(deviceId: string): void {
    if (!this.access) return;
    const device = this.access.outputs.get(deviceId);
    if (device) {
      this.output = device;
      this.config.deviceId = deviceId;
      this.saveConfig();
    }
  }

  getConfig(): MidiConfig {
    return { ...this.config };
  }

  /** Use setOutput() to change the active device;
   *  updateConfig persists deviceId but does not
   *  sync the live MIDIOutput reference. */
  updateConfig(partial: Partial<MidiConfig>): void {
    // Send All Notes Off on old channel before changes
    if (
      'channel' in partial &&
      partial.channel !== this.config.channel
    ) {
      this.sendAllNotesOff();
    }

    this.config = { ...this.config, ...partial };
    this.saveConfig();
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  setOnDeviceChange(
    cb: ((outputs: MIDIOutput[]) => void) | null
  ): void {
    this.onDeviceChange = cb;
  }

  private computeNoteLengthMs(): number {
    const nl = this.config.noteLength;
    if (nl.type === 'fixed') return nl.ms;
    // percent of step duration
    const stepMs = (60 / this.bpm) * 0.25 * 1000;
    return stepMs * (nl.value / 100);
  }

  /** Send a MIDI note-on/note-off pair for a step.
   *  @param gain — expected in [0, 1]; values above 1.0
   *  (e.g. accented steps) are clamped to velocity 127. */
  sendNote(
    trackId: TrackId,
    perfTimeMs: number,
    gain: number
  ): void {
    if (!this.config.enabled) return;
    if (!this.output) return;
    if (trackId === 'ac') return;

    const trackConfig = this.config.tracks[
      trackId as Exclude<TrackId, 'ac'>
    ];
    if (!trackConfig) return;

    const ch = this.config.channel - 1; // 0-indexed
    const note = trackConfig.noteNumber;
    const velocity = Math.max(
      1, Math.round(Math.min(gain, 1.0) * 127)
    );

    const noteLengthMs = this.computeNoteLengthMs();

    this.output.send(
      [0x90 | ch, note, velocity],
      perfTimeMs
    );
    this.output.send(
      [0x80 | ch, note, 0],
      perfTimeMs + noteLengthMs
    );
  }

  stop(): void {
    this.sendAllNotesOff();
  }

  private sendAllNotesOff(): void {
    if (!this.output) return;
    const ch = this.config.channel - 1;
    this.output.send([0xB0 | ch, 123, 0]);
  }
}

function isInt(
  v: unknown, min: number, max: number
): v is number {
  return Number.isInteger(v)
    && (v as number) >= min && (v as number) <= max;
}

function validateNoteLength(
  raw: unknown, fallback: NoteLength
): NoteLength {
  if (!raw || typeof raw !== 'object') return fallback;
  const nl = raw as Record<string, unknown>;
  if (
    nl.type === 'fixed'
    && typeof nl.ms === 'number'
    && isFinite(nl.ms) && nl.ms > 0
  ) {
    return { type: 'fixed', ms: nl.ms };
  }
  if (
    nl.type === 'percent'
    && typeof nl.value === 'number'
    && isFinite(nl.value) && nl.value > 0
  ) {
    return { type: 'percent', value: nl.value };
  }
  return fallback;
}

/**
 * Sanitize a MIDI config read from localStorage. Each
 * field falls back to its default when missing or
 * invalid, so a config saved by an older version can't
 * break note sending.
 */
export function validateMidiConfig(raw: unknown): MidiConfig {
  const defaults = defaultMidiConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const tracks = { ...defaults.tracks };
  if (obj.tracks && typeof obj.tracks === 'object') {
    const rawTracks = obj.tracks as Record<string, unknown>;
    for (const id of Object.keys(tracks) as
      (keyof MidiConfig['tracks'])[]) {
      const t = rawTracks[id] as
        { noteNumber?: unknown } | undefined;
      if (t && isInt(t.noteNumber, 0, 127)) {
        tracks[id] = { noteNumber: t.noteNumber };
      }
    }
  }

  return {
    enabled: typeof obj.enabled === 'boolean'
      ? obj.enabled : defaults.enabled,
    deviceId: typeof obj.deviceId === 'string'
      ? obj.deviceId : defaults.deviceId,
    channel: isInt(obj.channel, 1, 16)
      ? obj.channel : defaults.channel,
    noteLength: validateNoteLength(
      obj.noteLength, defaults.noteLength
    ),
    tracks,
  };
}

export const midiEngine = new MidiEngine();
