# Unified TrackConfig Re-Architecture

## Motivation

Per-track data was scattered across five separate
top-level fields in `SequencerConfig`:

```
steps:            Record<TrackId, string>
trackLengths:     Record<TrackId, number>
trigConditions:   Partial<Record<TrackId, Record<...>>>
parameterLocks:   Partial<Record<TrackId, Record<...>>>
mixer[id].freeRun: boolean
```

This made it impossible for preset patterns to carry
polymetric lengths, freeRun settings, or parameter
locks — they could only store step strings and
(optionally) trig conditions.

The `Pattern` type and `SequencerConfig` type had
different shapes for the same underlying data, requiring
mapping logic whenever patterns were loaded or saved.

## What Changed

All per-track rhythm data is now consolidated into a
single `TrackConfig` type:

```typescript
interface TrackConfig {
  steps: string;                              // binary string — length IS the track length
  freeRun?: boolean;                          // omitted = false
  trigConditions?: Record<number, StepConditions>;
  parameterLocks?: Record<number, StepLocks>;
}
```

Both `Pattern` and `SequencerConfig` use the same
structure:

```typescript
tracks: Record<TrackId, TrackConfig>
```

## Key Design Decisions

### Inferred lengths

Track length is the length of the step string. Pattern
length is the maximum track length. There are no
explicit length fields — this eliminates an entire
class of sync bugs between lengths and step data.

```typescript
function getPatternLength(
  tracks: Record<TrackId, TrackConfig>
): number {
  return Math.max(
    ...Object.values(tracks).map(t => t.steps.length)
  );
}
```

### No pruning on length change

Trig conditions and parameter locks at indices beyond
the current step string length are dormant, not deleted.
The audio loop only visits steps `0` through
`steps.length - 1`, so out-of-range entries are never
evaluated. If the track grows back, they reactivate.

This simplifies `setPatternLength` and `setTrackLength`
to pure string pad/truncate operations.

### Asymmetric grow/shrink

`setPatternLength(N)` extends ALL tracks to N when
growing (uniform), but only truncates tracks longer
than N when shrinking (preserving polymetric structure).

### freeRun moved out of mixer

`freeRun` is a rhythm property, not a mixer property.
It now lives in `TrackConfig` alongside the step data
it affects. `TrackMixerState` is purely audio:
`{ gain, isMuted, isSolo }`.

### Any track edit marks pattern as custom

Toggling steps, freeRun, trig conditions, parameter
locks, or changing track length all set
`selectedPatternId` to `'custom'`.

## Removed Abstractions

| Removed | Replacement |
|---------|-------------|
| `config.steps` | `config.tracks[id].steps` |
| `config.trackLengths` | `config.tracks[id].steps.length` |
| `config.patternLength` | `getPatternLength(config.tracks)` |
| `config.trigConditions` | `config.tracks[id].trigConditions` |
| `config.parameterLocks` | `config.tracks[id].parameterLocks` |
| `config.mixer[id].freeRun` | `config.tracks[id].freeRun` |
| `normalizePatternSteps()` | Not needed — step strings define their own length |
| `patternRef` | Audio loop reads `configRef.current.tracks` |
| `currentPattern` memo | Components read `config.tracks` directly |
| `state.patternLength` | Derived via `getPatternLength()` |
| `state.trackLengths` | Read from `config.tracks[id].steps.length` |

## patterns.json Format

Presets now use the same `tracks` structure. All 137
patterns were migrated. Minimal preset:

```json
{
  "id": "funk-1",
  "name": "Funk 01",
  "category": "Funk",
  "tracks": {
    "ac": { "steps": "0000000000000000" },
    "bd": { "steps": "1000001010000010" },
    "sd": { "steps": "0010000000100000" },
    ...
  }
}
```

Polymetric preset with conditions:

```json
{
  "bd": {
    "steps": "10001000100",
    "freeRun": true
  },
  "cp": {
    "steps": "0000100000001000",
    "trigConditions": {
      "4": { "cycle": { "a": 1, "b": 2 } }
    }
  }
}
```

## URL Serialization

`CONFIG_VERSION` bumped from 3 to 4. Old URLs return
`defaultConfig()`. The encoder strips default-valued
optional fields (`freeRun: false`, empty
`trigConditions`, empty `parameterLocks`) per-track to
keep URLs compact.

## Context API

The `useSequencer()` context no longer exposes
`patternLength`, `trackLengths`, or `currentPattern`.
Components read `meta.config.tracks` directly and derive
lengths with `getPatternLength()`. `selectedPatternId`
is exposed as a state field for UI highlighting.

## Files Changed

| File | Nature of Change |
|------|-----------------|
| `types.ts` | Added `TrackConfig`, `getPatternLength`. Updated `Pattern`, `SequencerConfig`, `TrackMixerState`, `TrackState`, `HomeSnapshot` |
| `configCodec.ts` | Rewrote validators, encoder, decoder. Removed 6 validator functions, added `validateTracks`/`validateSingleTrack` |
| `data/patterns.json` | Migrated 137 presets to `tracks` format |
| `SequencerContext.tsx` | Rewrote all 18+ state mutations and the `handleStep` audio loop. Removed `normalizePatternSteps`, `currentPattern`, `patternRef` |
| `StepGrid.tsx` | Reads from `config.tracks` |
| `useDragPaint.ts` | Accepts `tracks` instead of separate `steps`/`trackLengths` |
| `Sequencer.tsx`, `GlobalControls.tsx` | Derive `patternLength` from `config.tracks` |
| `TransportControls.tsx`, `PatternPicker.tsx` | Use `selectedPatternId` instead of `currentPattern` |
| 5 test files | Updated to match new data shapes |
