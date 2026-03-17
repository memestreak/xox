# Phase 2: Trig Conditions

Part of the [XOX Feature Roadmap](2026-03-15-feature-roadmap-design.md).

## Context

Static patterns repeat identically every loop. Trig
conditions (inspired by Elektron drum machines) let
individual steps fire conditionally, creating evolving
patterns without writing long sequences.

Depends on Phase 1 (variable track lengths) for per-track
cycle counting.

---

## Condition Types

| Type | Abbrev | Behavior |
|------|--------|----------|
| Probability | `%` | X% chance (1-99) each cycle |
| Cycle A:B | `A:B` | Fires on Ath play of every B loops |
| First | `1st` | Only on first pattern play |
| Not First | `!1st` | Every time except first |
| Previous | `PRE` | Only if prev trig on track fired |
| Not Previous | `!PRE` | Only if prev trig didn't fire |
| Neighbor | `NEI` | Only if same step on prev track fired |
| Not Neighbor | `!NEI` | Only if same step on prev track didn't |
| Fill | `FILL` | Only during fill mode |
| Not Fill | `!FILL` | Only when fill is NOT active |

**One condition per step** (matches Elektron). No
multi-condition composition.

---

## Data Model

```typescript
// Added to SequencerConfig (version 3)
trigConditions: Record<TrackId,
  Record<number, TrigCondition>>  // sparse

type TrigCondition =
  | { type: 'probability'; value: number }
  | { type: 'cycle'; a: number; b: number }
  | { type: '1st' }
  | { type: '!1st' }
  | { type: 'pre' }
  | { type: '!pre' }
  | { type: 'nei' }
  | { type: '!nei' }
  | { type: 'fill' }
  | { type: '!fill' };
```

Only steps with non-default conditions are stored.
Missing entries = always fire (no condition).

**Accent track ('ac') supports trig conditions.** Since
accent has no visible track row, conditions are accessed
via a dedicated accent editor toggle in the header /
transport controls.

---

## Transient State

```typescript
// In TransientContext
cycleCount: Record<TrackId, number>
lastFired: Record<TrackId, boolean>
stepResults: Record<TrackId, boolean>
fillActive: boolean
```

- `cycleCount` — per-track loop count, increments when
  `globalStep % trackLength === 0`. Reset on stop.
  **Per-track reset policy:** only reset the cycle
  counter for tracks that actually changed (muted,
  unmuted, or affected by a pattern change). Other
  tracks' counters continue uninterrupted.
- `lastFired` — did the most recent step that had a trig
  (pattern bit '1') on this track actually fire? Follows
  Elektron semantics: PRE evaluates against the last
  trig, not the last step. If the previous step had no
  trig, `lastFired` is unchanged. Reset to `true` on
  stop.
- `stepResults` — per-track fire result for the *current
  global step only*. Reset at the start of each
  `handleStep` call. Used for NEI conditions (cross-track
  lookup within the same step). NOT accumulated across
  the full cycle.
- `fillActive` — true when fill is active (momentary
  hold OR latched on). See Phase 3 for fill button
  behavior.

---

## Probability Randomness

Probability conditions use `Math.random()` (truly
random). Each playback produces unique variations. Two
users with the same shared URL hear different outcomes.
This matches Elektron behavior.

---

## NEI Neighbor Wrapping

The track list wraps circularly for NEI evaluation:
- `bd` (kick)'s neighbor is `cb` (cowbell, last track)
- `sd` (snare)'s neighbor is `bd` (kick)
- Accent ('ac') participates in the neighbor chain

This creates interesting cross-track relationships at
the wrap point.

---

## Evaluation Order

Tracks must be evaluated in `TRACK_IDS` order so that
`NEI` conditions can reference the previous track's
result for the same step.

Within `handleStep`:
```
clear stepResults for current step
for each track in TRACK_IDS order:
  effectiveStep = globalStep % trackLength
  if step is active (pattern[effectiveStep] === '1'):
    condition = trigConditions[trackId]?.[effectiveStep]
    shouldFire = evaluateCondition(condition, context)
    if shouldFire AND audible (solo/mute):
      playSound(...)
    record result in stepResults and lastFired
```

---

## Condition Pruning

When a track's length is decreased, trig conditions on
steps beyond the new length are **deleted** (not
preserved). This matches the step string truncation
behavior from Phase 1.

---

## UI: Per-Step Condition Menu

- **Desktop:** Right-click on an active step button
  opens a popover with condition selector
- **Mobile:** Long-press (~300ms threshold) with haptic
  feedback (`navigator.vibrate`) opens the popover.
  Native context menu is suppressed via `preventDefault`.
- Dropdown for condition type
- Parameter input for probability (slider) and cycle
  (A/B number inputs)
- Visual badge on step buttons with conditions (small
  indicator dot or border color)
- Steps with conditions are visually distinct from plain
  active steps

### Accent Condition Editor

Since the accent track ('ac') has no visible track row,
a toggle button in the header / transport controls opens
a dedicated accent condition editor. This shows the
accent pattern as a row with the same condition popover
interaction as regular tracks.

---

## Serialization

- `configCodec` version bump to 3
- `validateConfig` fills missing `trigConditions` with
  empty object for backward compat
- Sparse encoding: only steps with conditions are stored
- Add v3 golden hash; v1 and v2 goldens preserved

---

## Verification

1. Set a step to 50% probability -> plays roughly half
   the time over many loops (truly random each play)
2. Set a step to cycle 1:4 -> plays only on the 1st of
   every 4 pattern repetitions
3. Set PRE on step 5, with step 3 active -> step 5
   fires only when step 3 fired
4. Set NEI on snare step -> fires when same step on
   kick (previous track) fired
5. Set NEI on kick (bd) -> wraps to cowbell (cb)
6. Hold fill button -> FILL steps activate, !FILL
   steps suppress
7. Set trig condition on accent via header editor ->
   accent applies conditionally
8. Shorten track with conditions on removed steps ->
   conditions are deleted
9. Export pattern with conditions to URL -> round-trip
   preserves all conditions
10. Open a v2 URL (no trigConditions) -> defaults to
    empty (all steps fire normally)
11. Long-press on mobile step -> haptic feedback, popover
    opens without triggering native context menu
12. `npm test` passes, `npm run lint` passes
