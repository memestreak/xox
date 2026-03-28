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

`patternRef.current` (the audio-thread ref) must also be
updated to use the new `tracks` shape. The audio loop
reads step data via `pattern.tracks[trackId].steps`
instead of the old `pattern.steps[trackId]`.

The `currentPattern` memo, which constructs a synthetic
Pattern from config state, changes from
`{ steps: config.steps }` to `{ tracks: config.tracks }`.

`clearAll` and `clearTrack` actions write
`freeRun: false` (or undefined) into
`config.tracks[id]` instead of `config.mixer[id]`.

## configCodec Changes

- `CONFIG_VERSION`: 3 → 4
- Old v3 URLs will not decode — `validateConfig` returns
  `defaultConfig()` when the version is unrecognized (same
  as the existing convention for malformed input)
- Encoding serializes `tracks` instead of separate fields
- Validation consolidated into `validateTracks`:
  validates each track's steps (binary string, 1–64),
  optional freeRun (boolean), optional trigConditions,
  optional parameterLocks
- Separate validators `validateSteps`,
  `validateTrackLengths`, `validatePatternLength`,
  `validateTrigConditions`, `validateParameterLocks` are
  removed or consolidated

## Codebase Migration

All references to removed fields are updated:

| Old                                  | New                                          |
|--------------------------------------|----------------------------------------------|
| `config.steps[id]`                   | `config.tracks[id].steps`                    |
| `config.trackLengths[id]`            | `config.tracks[id].steps.length`             |
| `config.patternLength`               | `getPatternLength(config.tracks)`            |
| `config.trigConditions[id]`          | `config.tracks[id].trigConditions`            |
| `config.parameterLocks[id]`         | `config.tracks[id].parameterLocks`           |
| `config.mixer[id].freeRun`           | `config.tracks[id].freeRun`                  |
| `defaultConfig()` separate fields    | `defaultConfig()` builds `tracks`            |
| `HomeSnapshot.steps`, etc.           | `HomeSnapshot.tracks`                        |
| `patternRef.current.steps[id]`       | `patternRef.current.tracks[id].steps`        |
| `trackStates` memo reads mixer freeRun | reads `config.tracks[id].freeRun`          |
| `currentPattern` memo `steps: ...`   | `tracks: config.tracks`                      |
| `clearAll`/`clearTrack` mixer freeRun | `config.tracks[id].freeRun`                 |

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
