# Unified TrackConfig Design

## Problem

The `Pattern` type (used in `patterns.json` presets) and
`SequencerConfig` (used for URL serialization and runtime
state) store the same per-track data in different shapes.
Pattern lacks `patternLength`, `trackLengths`, `freeRun`,
and `parameterLocks`. This means preset patterns cannot
represent polymetric lengths, freeRun settings, or
per-step parameter locks.

Additionally, per-track data is scattered across multiple
top-level fields (`steps`, `trackLengths`,
`trigConditions`, `parameterLocks`, and `mixer.freeRun`),
making it hard to reason about what belongs to a track.

## Design

### New Type: `TrackConfig`

A single structure for all per-track rhythm data:

```typescript
interface TrackConfig {
  steps: string;                              // binary string, length IS the track length
  freeRun?: boolean;                          // omitted = false
  trigConditions?: Record<number, StepConditions>;
  parameterLocks?: Record<number, StepLocks>;
}
```

### Shared `tracks` Field

Both `Pattern` and `SequencerConfig` use:

```typescript
tracks: Record<TrackId, TrackConfig>
```

### Pattern Type

```typescript
interface Pattern {
  id: string;
  name: string;
  category?: string;
  tracks: Record<TrackId, TrackConfig>;
}
```

`patternLength` is inferred:
`Math.max(...Object.values(tracks).map(t => t.steps.length))`

Per-track length is inferred: `tracks[id].steps.length`

### SequencerConfig Type

```typescript
interface SequencerConfig {
  version: number;   // bumped to 4
  kitId: string;
  bpm: number;
  tracks: Record<TrackId, TrackConfig>;
  mixer: Record<TrackId, TrackMixerState>;
  swing: number;
}
```

**Removed top-level fields:**
- `steps` — now `tracks[id].steps`
- `trackLengths` — inferred from `tracks[id].steps.length`
- `patternLength` — inferred as max track length
- `trigConditions` — now `tracks[id].trigConditions`
- `parameterLocks` — now `tracks[id].parameterLocks`

### TrackMixerState

`freeRun` is removed. It is now part of `TrackConfig`.

```typescript
interface TrackMixerState {
  gain: number;
  isMuted: boolean;
  isSolo: boolean;
}
```

### TrackState

`freeRun` is removed from `TrackState`. Components that
need freeRun read it from `config.tracks[id].freeRun`
directly. TrackState becomes purely mixer-derived:

```typescript
interface TrackState {
  id: TrackId;
  name: string;
  isMuted: boolean;
  isSolo: boolean;
  gain: number;
}
```

### HomeSnapshot

Replaces `steps`, `trigConditions`, `trackLengths`, and
`patternLength` with `tracks`:

```typescript
interface HomeSnapshot {
  tracks: Record<TrackId, TrackConfig>;
  selectedPatternId: string;
}
```

Note: the current HomeSnapshot does not capture
`parameterLocks`. The new `tracks`-based snapshot
inherently includes them, which fixes this existing gap.
The temp revert path must restore parameterLocks (via
`tracks`) where it currently does not.

## patterns.json Format

All presets are updated with explicit `tracks` structure.
`freeRun` is omitted when false (the common case).

Standard 16-step preset:

```json
{
  "id": "afro-cub-1",
  "name": "Afro-Cuban 01",
  "category": "Afro-Cuban",
  "tracks": {
    "ac": { "steps": "0000000000000000" },
    "bd": { "steps": "1000000010100010" },
    "sd": { "steps": "0000000000000000" },
    "ch": { "steps": "1011101010101010" },
    "oh": { "steps": "0000000000000000" },
    "cy": { "steps": "0000000000000000" },
    "ht": { "steps": "0000000000000000" },
    "mt": { "steps": "0000000000000000" },
    "lt": { "steps": "0000000000000000" },
    "rs": { "steps": "0001001000001000" },
    "cp": { "steps": "0000000000000000" },
    "cb": { "steps": "0000000000000000" }
  }
}
```

Polymetric preset with trig conditions:

```json
{
  "id": "poly-example",
  "name": "Polymetric",
  "tracks": {
    "bd": {
      "steps": "10001000100",
      "freeRun": true
    },
    "ch": { "steps": "101010111" },
    "cp": {
      "steps": "0000100000001000",
      "trigConditions": {
        "4": { "cycle": { "a": 1, "b": 2 } },
        "12": { "cycle": { "a": 1, "b": 2 } }
      }
    }
  }
}
```

All 12 `TrackId` entries are required in both
`patterns.json` presets and `SequencerConfig`. The codec
validator fills in missing tracks with a default
`{ steps: "0".repeat(patternLength) }` for robustness,
but presets must be explicit.

## Context API Changes

The SequencerContext no longer exposes `patternLength`
or `trackLengths` as top-level state values. Consumers
read `config.tracks` directly and derive lengths:

- Track length: `config.tracks[id].steps.length`
- Pattern length: `getPatternLength(config.tracks)`

The `currentPattern` memo is removed. Components that
need pattern data read `config.tracks` directly.
`selectedPatternId` remains as a separate state value
for UI highlighting of the active preset.

## Conditions and Locks: No Pruning on Length Change

TrigConditions and parameterLocks are NOT pruned when
track or pattern length changes. Conditions/locks at
indices beyond the current step string length are simply
dormant — the audio loop only visits steps
`0` through `steps.length - 1`, so out-of-range
conditions are never evaluated.

This means:
- Shrinking a track preserves its conditions/locks.
  Growing it back later reactivates them.
- `setPatternLength` and `setTrackLength` only need to
  pad/truncate the step string. No cascading prune logic.
- The codec validator accepts condition/lock keys in the
  range 0–63 regardless of step string length.

## setPattern Behavior

Selecting a preset overwrites `config.tracks` entirely
with the pattern's `tracks`. This replaces steps,
freeRun, trigConditions, and parameterLocks all at once.
The pattern's own track lengths become the new track
lengths — there is no normalization against the current
config's lengths.

Mixer state (gain, mute, solo) remains untouched.

The `normalizePatternSteps` helper is removed since step
strings define their own length.

### Pattern Modes

- **sequential**: The boundary check uses the OLD
  patternLength (from the current config at the time of
  the boundary step). The pending pattern is applied at
  `step === oldPatternLength - 1`. The next cycle uses
  the new pattern's track lengths.
- **direct-start**: Overwrites config.tracks immediately
  and resets playhead to step 0.
- **direct-jump**: Overwrites config.tracks immediately
  without resetting playhead.

### Audio Refs

`patternRef` is removed. The audio loop reads all track
data from `configRef.current.tracks`. Since setConfig is
async, there may be a one-tick lag on pattern switch.
This is acceptable.

### Custom Pattern Detection

Any edit to track data marks the pattern as 'custom':
toggling steps, toggling freeRun, adding/removing trig
conditions, adding/removing parameter locks, or changing
track length. All of these set `selectedPatternId` to
`'custom'`.

## setPatternLength Behavior

`setPatternLength(N)` has asymmetric grow/shrink
behavior:

- **Grow** (N > current max): ALL tracks extend to N,
  padded with '0'. This is uniform — polymetric tracks
  shorter than N are grown to N.
- **Shrink** (N < current max): Only tracks longer than
  N are truncated to N. Tracks already shorter than N
  are left untouched, preserving polymetric structure.

TrigConditions and parameterLocks are never pruned in
either direction.

## setTrackLength Behavior

`setTrackLength(trackId, N)` pads or truncates the
individual track's step string to length N. No pruning
of conditions/locks. If N exceeds the current inferred
patternLength, the inferred patternLength grows
automatically.

## clearAll Behavior

Resets all tracks to 16-step zero-filled strings:
`{ steps: "0".repeat(16) }`. Clears freeRun,
trigConditions, and parameterLocks on all tracks.
Mixer state (gain, mute, solo) is untouched.

## clearTrack Behavior

Resets the individual track to 16-step zeros:
`{ steps: "0".repeat(16) }`. Clears that track's
freeRun, trigConditions, and parameterLocks.

If the cleared track was the longest track, the inferred
patternLength may shrink. This is intentional.

## configCodec Changes

- `CONFIG_VERSION`: 3 → 4
- Old v3 URLs will not decode — `validateConfig` returns
  `defaultConfig()` when the version is unrecognized (same
  as the existing convention for malformed input)
- Encoding serializes `tracks` instead of separate fields
- **URL compaction**: The encoder strips empty/default
  optional fields per-track before serialization. For each
  track, `trigConditions`, `parameterLocks`, and `freeRun`
  are omitted when they are `undefined`/empty/`false`.
  The decoder fills in defaults for missing fields.
- Validation consolidated into `validateTracks`:
  validates each track's steps (binary string, 1–64),
  optional freeRun (boolean), optional trigConditions
  (keys 0–63, valid StepConditions), optional
  parameterLocks (keys 0–63, valid StepLocks). Condition
  and lock keys are NOT validated against step string
  length.
- Separate validators `validateSteps`,
  `validateTrackLengths`, `validatePatternLength`,
  `validateTrigConditions`, `validateParameterLocks` are
  removed or consolidated

## Codebase Migration

All references to removed fields are updated:

| Old                                    | New                                          |
|----------------------------------------|----------------------------------------------|
| `config.steps[id]`                     | `config.tracks[id].steps`                    |
| `config.trackLengths[id]`             | `config.tracks[id].steps.length`             |
| `config.patternLength`                 | `getPatternLength(config.tracks)`            |
| `config.trigConditions[id]`           | `config.tracks[id].trigConditions`            |
| `config.parameterLocks[id]`          | `config.tracks[id].parameterLocks`           |
| `config.mixer[id].freeRun`            | `config.tracks[id].freeRun`                  |
| `defaultConfig()` separate fields      | `defaultConfig()` builds `tracks`            |
| `HomeSnapshot.steps`, etc.             | `HomeSnapshot.tracks`                        |
| `patternRef.current.steps[id]`        | `configRef.current.tracks[id].steps`         |
| `trackStates` memo reads mixer freeRun | removed from trackStates                     |
| `currentPattern` memo                  | removed; use `config.tracks` directly        |
| `state.patternLength`                  | `getPatternLength(config.tracks)`            |
| `state.trackLengths`                   | `config.tracks[id].steps.length`             |
| `clearAll`/`clearTrack` mixer freeRun  | `config.tracks[id].freeRun`                  |

A `getPatternLength` helper is introduced:

```typescript
function getPatternLength(
  tracks: Record<TrackId, TrackConfig>
): number {
  return Math.max(
    ...Object.values(tracks).map(t => t.steps.length)
  );
}
```

All tests updated to match the new structure.
