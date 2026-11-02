# Trig Conditions Tier 1: Probability & Cycle A:B — Spec

Refines the engine portion of the
[trig conditions design](2026-03-15-trig-conditions-design.md)
based on Elektron device research and design review.

**Scope:** Probability (X%) and Cycle (A:B) conditions
only. Engine + serialization. No UI.

**Issue:** [#5](https://github.com/memestreak/xox/issues/5)
(partial)

---

## 1. Condition Types (Tier 1)

| Type | Abbrev | Behavior | Parameters |
|------|--------|----------|------------|
| Probability | `%` | X% chance each visit | `value`: integer 1-99 |
| Cycle | `A:B` | Fires on the Ath of every B track loops | `a`: 1-B, `b`: 2-8 |

**One condition per step.** Missing = always fire.

### Parameter Constraints

- **Probability value:** Integer, clamped 1-99. Values
  outside this range are clamped during validation.
- **Cycle B:** Integer, clamped 2-8 (matches Elektron).
  B=1 is not valid — that's equivalent to "always fire."
- **Cycle A:** Integer, clamped 1-B. A > B is clamped
  to A = B.

---

## 2. Data Model

### TrigCondition Type

```typescript
export type TrigCondition =
  | { type: 'probability'; value: number }
  | { type: 'cycle'; a: number; b: number };
```

### SequencerConfig (version 3)

```typescript
export interface SequencerConfig {
  version: number;
  kitId: string;
  bpm: number;
  patternLength: number;
  trackLengths: Record<TrackId, number>;
  steps: Record<TrackId, string>;
  mixer: Record<TrackId, TrackMixerState>;
  swing: number;
  trigConditions: Partial<
    Record<
      TrackId, Record<number, TrigCondition>
    >
  >;
}
```

- Outer `Partial`: tracks with no conditions are absent
- Inner `Record<number, TrigCondition>`: sparse by step
  index
- Only steps with conditions are stored

### Pattern Type

```typescript
export interface Pattern {
  id: string;
  name: string;
  steps: Record<TrackId, string>;
  trigConditions?: Partial<
    Record<
      TrackId, Record<number, TrigCondition>
    >
  >;
}
```

- `trigConditions` is **optional** (`?`). When absent,
  defaults to `{}` (no conditions).
- Existing `patterns.json` is **not modified** — preset
  patterns have no conditions.
- Loading a preset pattern **clears** existing conditions
  and loads the pattern's conditions (empty for presets).

---

## 3. Cycle Counting

### Counter Scope

**Per-track.** All steps on a track share the same cycle
count. This matches Elektron behavior. Steps with
different A:B values on the same track reference the
same underlying counter — they just select different
slices.

### Increment Trigger

The cycle counter for a track increments **at the
track-length boundary**, when the track's pattern loops.
Specifically: `total > 0 && total % trackLength === 0`,
where `total` is `totalStepsRef.current` (the
pre-increment value in handleStep).

This applies to both freeRun and non-freeRun tracks.
`total` always increments by 1 per scheduler tick
regardless of mode.

### Timing Within handleStep

1. Read `total` from `totalStepsRef.current`
2. Increment `totalStepsRef`
3. **Increment cycle counts** for tracks at boundaries
4. Evaluate accent (with condition, if any)
5. Evaluate each track's steps (with conditions)

Accent is evaluated **after** cycle increment so that
accent and tracks see the same cycle count on boundary
steps.

This means:
- First step ever (`total=0`): cycleCount = 0 for all
  tracks (increment check is `total > 0`, so no
  increment)
- Second track loop start (`total=trackLength`):
  cycleCount increments to 1

### Evaluation Formula

For condition `A:B`:
```
fires = (cycleCount % B) === (A - 1)
```

- Cycle 0 → 1:B fires (1-1=0)
- Cycle 1 → 2:B fires
- Cycle B-1 → B:B fires
- Cycle B → wraps, 1:B fires again

### Reset

- **Stop:** All cycle counts reset to 0
- **Start:** All cycle counts initialized to 0
- **Mute/unmute:** Reset cycle count for the affected
  track only. Matches Elektron behavior where changing
  a track's audibility resets its cycle position.
- **Solo/unsolo:** Reset cycle count for the affected
  track only.

### FreeRun Interaction

FreeRun tracks use `total % trackLength` for their
effective step (instead of `step % trackLength`). The
cycle counter uses the same `total`-based boundary
detection for all tracks, so freeRun and non-freeRun
tracks count cycles consistently.

### Length-1 Tracks

For a track with length 1, `total % 1 === 0` is true
on every step (for total > 0). The cycle count
increments every step. This is mathematically correct:
a 1-step track repeats its single step every step, so
each repetition is a new cycle. Cycle 1:2 on a
length-1 track fires every other step.

### Test Conventions

Tests in `handleStep.test.ts` use static imports:

```typescript
import patternsData from '../app/data/patterns.json';
import type { Pattern } from '../app/types';
```

This matches existing test patterns in
`SequencerContext.test.tsx`. Do not use dynamic imports
for pattern data.

An E2E URL hash import test should be added to the
existing `'URL hash import'` describe block in
`SequencerContext.test.tsx` to verify trigConditions
survive the full mount → decode → state flow.

---

## 4. Probability

- Uses `Math.random()` (truly random)
- Each visit: `Math.random() < value / 100`
- Two users with the same shared URL hear different
  outcomes
- Matches Elektron behavior

---

## 5. Accent

Accent (`ac`) **supports trig conditions** in Tier 1.

- Accent is evaluated **once per step**, after cycle
  count increment but before the per-track loop
- Accent condition is **independent** of individual
  track conditions
- If accent fires, ALL audible tracks at that step get
  the 1.5x gain boost
- If a track's own condition suppresses it, the track
  doesn't play (accent boost is irrelevant for that
  track, but other tracks still get it)

---

## 6. Condition Lifecycle

### Loading a Preset Pattern

`setPattern` **clears** existing `trigConditions` and
loads the pattern's conditions:

```typescript
return {
  ...prev,
  steps: newSteps,
  trigConditions:
    pattern.trigConditions ?? {},
};
```

Since preset patterns have no `trigConditions` field,
this effectively clears all conditions on preset load.

### Clear All

`clearAll` resets `trigConditions` to `{}`.

### Track Length Change

When `setTrackLength` shortens a track, conditions on
steps beyond the new length are **pruned** (deleted).
Conditions within the new length are preserved.

### Pattern Length Change

When `setPatternLength` shortens the pattern, all
tracks whose length decreases have their conditions
pruned accordingly.

### Toggle Step Off

Toggling a step off does **not** remove its condition.
The condition is metadata that persists even when the
step is inactive. If the step is toggled back on, the
condition still applies. (Matches Elektron: parameter
locks persist on inactive trigs.)

---

## 7. Serialization

### configCodec v3

- `CONFIG_VERSION` bumps from 2 to 3
- `defaultConfig()` includes `trigConditions: {}`
- `validateConfig()` calls `validateTrigConditions()`
  which:
  - Returns `{}` for missing/non-object values
  - Iterates only known `TRACK_IDS`
  - Drops conditions on step indices beyond track length
  - Validates each condition: known type, clamped params
  - Drops empty track entries (sparse)
- `validateSingleCondition()`:
  - `probability`: value must be finite number, clamp
    1-99
  - `cycle`: a and b must be finite numbers. B<2 is
    dropped (null). B clamped to max 8. A clamped
    to 1-B.
  - Unknown types return `null` (dropped)

### Backward Compatibility

- **v1 URLs** (no patternLength, no trackLengths, no
  trigConditions): decode with all fields defaulted.
  `trigConditions` defaults to `{}`.
- **v2 URLs** (no trigConditions): decode with
  `trigConditions` defaulted to `{}`.
- **v3 URLs**: full round-trip with conditions.
- Version field is always stamped to `CONFIG_VERSION`
  (3) on decode.

### Golden Tests

- Existing v1 golden hash still decodes correctly
  (with `version: 3`, `trigConditions: {}`)
- Existing v2 golden config round-trips (version
  stamped to 3)
- New v2 backward compat test: encode v2 config
  without trigConditions, decode, verify
  `trigConditions: {}`

---

## 8. Transient State

```typescript
// In SequencerProvider
const cycleCountRef = useRef<
  Record<TrackId, number>
>({} as Record<TrackId, number>);
```

- Initialized to all-zeros on start
- Reset to all-zeros on stop
- Incremented per-track in handleStep at track-length
  boundaries
- Not serialized (transient — resets each playback)

---

## 9. Actions

### New Actions

```typescript
setTrigCondition: (
  trackId: TrackId,
  stepIndex: number,
  condition: TrigCondition
) => void;

clearTrigCondition: (
  trackId: TrackId,
  stepIndex: number
) => void;
```

### Modified Actions

- `setPattern`: clears and loads `trigConditions`
- `clearAll`: resets `trigConditions` to `{}`
- `setTrackLength`: prunes conditions beyond new length
- `setPatternLength`: prunes conditions for all
  affected tracks
- `toggleMute`: resets cycle count for the toggled
  track
- `toggleSolo`: resets cycle count for the toggled
  track

---

## 10. evaluateCondition Module

Pure function in `src/app/trigConditions.ts`:

```typescript
export interface ConditionContext {
  cycleCount: number;
}

export function evaluateCondition(
  condition: TrigCondition | undefined,
  ctx: ConditionContext
): boolean;
```

- `undefined` → `true` (always fire)
- `probability` → `Math.random() < value / 100`
- `cycle` → `(ctx.cycleCount % b) === (a - 1)`

Designed for extension: future tiers add fields to
`ConditionContext` (e.g., `lastFired`, `stepResults`,
`fillActive`) and new `case` branches.

---

## 11. Future Considerations

- **Negated cycle (NOT A:B):** Elektron supports this
  (fires on every loop *except* the Ath of every B).
  Not in Tier 1 scope. Consider adding as a separate
  condition type (e.g., `{ type: '!cycle', a, b }`)
  in a future tier.
- **Pattern save/load slots:** When XOX gains saveable
  pattern slots, conditions should be part of the saved
  data (already architected via the Pattern type).

---

## 12. Verification Criteria

- [ ] 50% probability fires ~half the time (mock
      Math.random for deterministic tests)
- [ ] Cycle 1:4 fires on 1st of every 4 track loops
- [ ] Cycle 3:4 fires on 3rd of every 4 track loops
- [ ] Cycle counter is per-track, shared by all steps
- [ ] B clamped to 2-8, A clamped to 1-B
- [ ] Probability clamped to integer 1-99
- [ ] Accent supports conditions (evaluated
      independently)
- [ ] Loading preset clears conditions
- [ ] clearAll resets conditions
- [ ] Shortening track prunes conditions
- [ ] Shortening pattern length prunes conditions
- [ ] v1 URL decodes with `trigConditions: {}`
- [ ] v2 URL decodes with `trigConditions: {}`
- [ ] v3 URL round-trips all conditions
- [ ] Invalid condition types dropped on decode
- [ ] Stop/start resets cycle counts
- [ ] Mute/unmute resets cycle count for that track
- [ ] Solo/unsolo resets cycle count for that track
- [ ] Toggling a step off preserves its condition
- [ ] Toggling a step back on re-applies its condition
- [ ] E2E: URL with trigConditions → mount → conditions
      in state
- [ ] Length-1 tracks: cycle increments every step
- [ ] `npm test` and `npm run lint` pass
