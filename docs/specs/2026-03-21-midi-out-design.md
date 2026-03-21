# MIDI Out — Note Triggers (Issue #10)

## Context

XOX is a 16-step drum sequencer running in the browser.
Currently it only produces audio via the Web Audio API.
Users with external MIDI gear (drum machines, samplers,
synth modules) want XOX to send MIDI note triggers so
patterns drive hardware in sync with the internal audio.

This spec covers MIDI note output only. MIDI clock and
transport messages are deferred to issue #58.

## Requirements

- Send short MIDI note-on/note-off messages when steps fire
- Global MIDI channel (1–16) for all tracks
- Per-track MIDI note number (0–127) with GM drum defaults
- User-configurable note length (default 50ms)
- Velocity derived from gain (linear mapping — the gain
  value is already cubed by handleStep before reaching
  MidiEngine)
- First-time opt-in; remembers settings on subsequent visits
- Pick one output device from connected MIDI outputs
- MIDI config stored in localStorage (not in URL / not in
  `SequencerConfig`)
- Graceful fallback when Web MIDI API is unavailable or
  user denies permission
- MIDI section visible but disabled when no device available

## Browser Compatibility

The Web MIDI API is supported in Chrome, Edge, and other
Chromium-based browsers. It is **not supported on iOS
Safari**. Requires HTTPS (satisfied by Cloudflare Pages).
The browser prompts the user for permission on first access.

`requestMIDIAccess` is called with `{ sysex: false }` to
avoid the more aggressive SysEx permission prompt.

## Data Model

### New types in `src/app/types.ts`

```typescript
/** Note length: fixed milliseconds or tempo-relative. */
export type NoteLength =
  | { type: 'fixed'; ms: number }
  | { type: 'percent'; value: number };

/** Per-track MIDI note mapping. */
export interface MidiTrackConfig {
  noteNumber: number;  // 0–127
}

/** Complete MIDI output configuration. */
export interface MidiConfig {
  enabled: boolean;
  deviceId: string | null;
  channel: number;  // 1–16
  noteLength: NoteLength;  // default: { type: 'fixed', ms: 50 }
  tracks: Record<
    Exclude<TrackId, 'ac'>,
    MidiTrackConfig
  >;
}
```

### Default note numbers (GM drum map)

| Track | Note | GM Sound        |
|-------|------|-----------------|
| BD    | 36   | Bass Drum 1     |
| SD    | 38   | Acoustic Snare  |
| CH    | 42   | Closed Hi-Hat   |
| OH    | 46   | Open Hi-Hat     |
| CY    | 49   | Crash Cymbal 1  |
| HT    | 50   | High Tom        |
| MT    | 47   | Mid Tom         |
| LT    | 43   | Low Tom         |
| RS    | 37   | Side Stick      |
| CP    | 39   | Hand Clap       |
| CB    | 56   | Cowbell         |

The accent track (`ac`) is excluded from `MidiConfig.tracks`
at the type level. It modifies velocity of other tracks
(same as audio) but does not send its own MIDI note.

### TypeScript types for Web MIDI API

Install `@types/webmidi` as a devDependency to get
`MIDIAccess`, `MIDIOutput`, `MIDIOutputMap`, and related
interfaces.

### Storage

Key: `'xox-midi'` in localStorage. JSON-serialized
`MidiConfig`. Not part of `SequencerConfig` or URL hash
sharing — MIDI routing is device-specific.

On first visit (no stored config), MIDI is disabled.
On subsequent visits, the saved config is restored
including enabled state.

## Architecture

### MidiEngine (`src/app/MidiEngine.ts`)

A singleton class mirroring AudioEngine's pattern:

```typescript
class MidiEngine {
  private access: MIDIAccess | null;
  private output: MIDIOutput | null;
  private config: MidiConfig;
  private bpm: number;

  // Request MIDI access with { sysex: false }.
  // Loads config from localStorage.
  // Returns false if API unavailable or permission denied.
  // Idempotent — safe to call multiple times (e.g.
  // React StrictMode double-mount).
  async init(): Promise<boolean>;

  // Send note-on at perfTimeMs, schedule note-off at
  // perfTimeMs + noteLengthMs via MIDIOutput.send()
  // timestamp parameter (no setTimeout).
  // No-ops if !enabled, no output, or trackId === 'ac'.
  sendNote(
    trackId: TrackId,
    perfTimeMs: number,
    gain: number
  ): void;

  // Send All Notes Off (CC 123) on the active channel.
  // Called when playback stops or before config changes.
  stop(): void;

  // Update BPM (needed for percent-based note lengths).
  setBpm(bpm: number): void;

  // List available MIDI output ports
  getOutputs(): MIDIOutput[];

  // Select an output by device ID
  setOutput(deviceId: string): void;

  // Get/set config (triggers localStorage persist).
  // On channel/note changes, sends All Notes Off on
  // the old channel before applying the new config.
  getConfig(): MidiConfig;
  updateConfig(partial: Partial<MidiConfig>): void;
}
```

**Singleton access:** Exported as a module-level instance
(same pattern as `audioEngine`):
```typescript
export const midiEngine = new MidiEngine();
```

**Time conversion:** handleStep converts AudioContext time
to `DOMHighResTimeStamp` before calling sendNote. The
conversion happens in SequencerContext, not in MidiEngine:

```typescript
// In handleStep (SequencerContext.tsx):
const perfTimeMs = performance.now()
  + (scheduledTime - audioEngine.getCurrentTime()) * 1000;
midiEngine.sendNote(track.id, perfTimeMs, gain);
```

This keeps MidiEngine fully decoupled from AudioEngine.
A new `getCurrentTime()` getter is added to AudioEngine
to expose `this.ctx!.currentTime`.

**Note length computation:**
- Fixed: use `config.noteLength.ms` directly
- Percent: `(60 / this.bpm) * 0.25 * 1000 * (value / 100)`

**Note-on and note-off scheduling:** Both messages use
`MIDIOutput.send(data, timestamp)` with the browser's
native MIDI scheduling. No setTimeout is used:

```typescript
const noteOnTime = perfTimeMs;
const noteOffTime = perfTimeMs + noteLengthMs;
output.send([0x90 | (ch - 1), note, velocity], noteOnTime);
output.send([0x80 | (ch - 1), note, 0], noteOffTime);
```

**MIDI message encoding:**

```
Note-on:  [0x90 | (channel - 1), noteNumber, velocity]
Note-off: [0x80 | (channel - 1), noteNumber, 0]
All Notes Off: [0xB0 | (channel - 1), 123, 0]
```

**Velocity mapping:** The `gain` parameter is already cubed
(`baseGain ** 3`) and accent-scaled by handleStep.
Linear mapping with clamping:

```typescript
const velocity = Math.max(
  1, Math.round(Math.min(gain, 1.0) * 127)
);
```

Clamped to 1–127 because velocity 0 means note-off in
some MIDI implementations.

**Defense in depth:** `sendNote` checks `trackId === 'ac'`
and returns early, even though the handleStep TRACKS loop
already excludes accent. This guards against future callers.

**Device hotplug:** Listen for `statechange` on
`MIDIAccess`. If the selected device disconnects, set
`output = null` (sendNote silently no-ops). If it
reconnects and matches the saved `deviceId`, auto-reconnect.
Emit a callback so the UI can update connection status.

### handleStep integration

In `SequencerContext.tsx`, after the existing `playSound`
call (~line 420):

```typescript
audioEngine.playSound(track.id, scheduledTime, gain);

// MIDI output (time conversion done here to keep
// MidiEngine decoupled from AudioEngine)
const perfTimeMs = performance.now()
  + (scheduledTime - audioEngine.getCurrentTime()) * 1000;
midiEngine.sendNote(track.id, perfTimeMs, gain);
```

Swing offset is already baked into `scheduledTime`, so
MIDI notes swing identically to audio. Trig conditions
(probability, cycle, fill) and freeRun mode are
transparent — they gate whether this code is reached at
all.

### Stop integration

In `SequencerContext.tsx`, in the `togglePlay` callback
alongside `audioEngine.stop()`:

```typescript
audioEngine.stop();
midiEngine.stop();  // sends All Notes Off (CC 123)
```

This prevents stuck notes on external gear when playback
is stopped mid-step.

### BPM sync

In `SequencerContext.tsx`, in the BPM effect alongside
`audioEngine.setBpm()`:

```typescript
useEffect(() => {
  audioEngine.setBpm(config.bpm);
  midiEngine.setBpm(config.bpm);
}, [config.bpm]);
```

### Config change cleanup

When `updateConfig()` detects a channel or note number
change, it sends All Notes Off (CC 123) on the **old**
channel before applying the new config. This prevents
stuck notes when the user changes MIDI routing mid-playback.

### MidiEngine initialization

`midiEngine.init()` is called once when the app mounts,
inside SequencerContext (or MidiContext provider). It
requests MIDI access and loads config from localStorage.

The init call is idempotent — if called again (e.g. React
StrictMode double-mount in development), it returns the
existing result without re-requesting MIDI access.

### MidiContext (`src/app/MidiContext.tsx`)

A separate lightweight React context wrapping MidiEngine:

```typescript
interface MidiContextValue {
  available: boolean;       // Web MIDI API accessible?
  config: MidiConfig;
  outputs: MIDIOutput[];    // connected devices
  updateConfig: (partial: Partial<MidiConfig>) => void;
}
```

This avoids bloating SequencerContext with MIDI concerns.
The MidiContext provider:
- Calls `midiEngine.init()` on mount
- Subscribes to `statechange` for hotplug device updates
- Persists config changes to localStorage via MidiEngine
- Wraps the app tree (inside or alongside
  SequencerProvider)

## UI Design

### Settings gear menu

Add a "MIDI Settings…" menu item in `SettingsPopover.tsx`
below the existing "Export URL" button. Clicking it opens
a modal dialog.

### MIDI settings modal (`src/app/MidiSettings.tsx`)

A centered modal dialog with backdrop, accessed from the
gear menu. Contains:

1. **Enable toggle** — on/off switch for MIDI output
2. **Device dropdown** — lists connected MIDI outputs by
   name. Shows "No devices" when empty. Updates on hotplug.
3. **Channel selector** — dropdown or number input, 1–16
4. **Note length** — dropdown with presets (see below)
5. **Track note mapping** — grid of 11 tracks (excluding
   `ac`), each with a number input for MIDI note (0–127).
   Track labels (BD, SD, etc.) with editable note numbers.

Dismiss via close button, Escape key, or backdrop click.

When no MIDI device is detected or Web MIDI is unsupported,
the modal is visible but controls are disabled with a
status message: "No MIDI device detected" or "MIDI not
supported in this browser".

### Note length options

| Label           | Config value                       |
|-----------------|------------------------------------|
| 10 ms           | `{ type: 'fixed', ms: 10 }`       |
| 25 ms           | `{ type: 'fixed', ms: 25 }`       |
| 50 ms (default) | `{ type: 'fixed', ms: 50 }`       |
| 100 ms          | `{ type: 'fixed', ms: 100 }`      |
| 50% of step     | `{ type: 'percent', value: 50 }`   |
| 75% of step     | `{ type: 'percent', value: 75 }`   |

Step duration = `(60 / BPM) * 0.25 * 1000` ms. Percentage-
based lengths adapt to tempo changes automatically.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No Web MIDI API | UI shows "MIDI not supported" (disabled) |
| Permission denied | UI shows "MIDI access denied" (disabled) |
| No devices connected | UI shows "No MIDI devices" (disabled) |
| Device disconnects mid-play | sendNote silently no-ops; UI updates |
| Device reconnects | Auto-reconnect if deviceId matches |
| Gain > 1.0 (accent) | Velocity clamped to 127 |
| Stop mid-playback | All Notes Off (CC 123) sent |
| Config change mid-playback | All Notes Off on old channel, then apply |

## Files Affected

### New files

- `src/app/MidiEngine.ts` — Web MIDI API wrapper singleton
- `src/app/MidiContext.tsx` — React context for MIDI state
- `src/app/MidiSettings.tsx` — MIDI config modal component

### Modified files

- `src/app/SequencerContext.tsx` — call sendNote in
  handleStep (with time conversion), call stop() in
  togglePlay, sync BPM
- `src/app/AudioEngine.ts` — add `getCurrentTime()` getter
- `src/app/SettingsPopover.tsx` — add "MIDI Settings…"
  menu item
- `src/app/types.ts` — add `MidiConfig`, `MidiTrackConfig`,
  `NoteLength` types
- `package.json` — add `@types/webmidi` devDependency

## Testing

### Unit tests (`src/__tests__/midiEngine.test.ts`)

Mock `navigator.requestMIDIAccess` with fake `MIDIAccess`
and `MIDIOutput` objects (same pattern as AudioContext
mocking in audioEngine.test.ts):

- Verify `sendNote()` calls `output.send()` with correct
  note-on bytes `[0x99, noteNum, velocity]` for channel 10
- Verify note-off sent via `output.send()` with timestamp
  = noteOnTime + noteLengthMs (not setTimeout)
- Verify velocity calculation: `gain=0.5` (already cubed)
  → `velocity = Math.max(1, Math.round(0.5 * 127)) = 64`
- Verify accent gain (>1.0) clamps velocity to 127
- Verify `sendNote()` no-ops when disabled, no output,
  or trackId is `'ac'`
- Verify `stop()` sends All Notes Off (CC 123)
- Verify `updateConfig()` sends All Notes Off on old
  channel when channel changes
- Verify config round-trips through localStorage
- Verify graceful handling when `requestMIDIAccess` is
  undefined or rejects
- Verify percent-based note length uses current BPM
- Verify idempotent init (second call returns same result)

### Integration (handleStep)

Extend `handleStep.test.ts` with a mock midiEngine
alongside the existing mock audioEngine (same vi.mock
pattern):

- Verify `midiEngine.sendNote()` is called with
  perfTimeMs and same gain as `audioEngine.playSound()`
- Verify muted/soloed tracks are skipped for MIDI too
- Verify swing offset is reflected in MIDI timing
- Verify trig condition gates apply to MIDI

### Manual testing

1. Connect USB MIDI device
2. Open XOX in Chrome, grant MIDI permission
3. Open gear menu → MIDI Settings
4. Enable MIDI, select device, set channel 10
5. Play a pattern — verify external gear receives triggers
6. Adjust note numbers — verify correct sounds trigger
7. Change note length — verify audible duration difference
8. Disconnect device mid-play — verify no errors, UI updates
9. Reconnect — verify auto-reconnect
10. Stop playback — verify no stuck notes on gear
11. Change channel mid-playback — verify clean switch

## Timing Considerations

Web MIDI's `MIDIOutput.send(data, timestamp)` uses
`DOMHighResTimeStamp` (performance.now() basis), which is a
different clock from `AudioContext.currentTime`. The time
conversion introduces ~10–50ms of jitter. This is acceptable
for drum triggers but worth noting:

- MIDI and audio will not be perfectly sample-aligned
- The jitter is comparable to hardware MIDI latency
- For tighter sync, users can adjust their external gear's
  audio monitoring to compensate

## Future Work (Out of Scope)

- MIDI clock and transport output — tracked as issue #58
- Per-track MIDI channel (currently global only)
- MIDI input (note triggering from external controllers)
- MIDI CC output for continuous parameters
- SysEx support
