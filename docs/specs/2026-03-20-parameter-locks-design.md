# Parameter Locks — Gain (Issue #30)

## Context

XOX is a 16-step drum sequencer. Currently every step on a
track plays at the same mixer-set volume. Hardware drum
machines like the Elektron Analog Rytm allow per-step
parameter overrides ("parameter locks") for expressive
variation — ghost notes, accent patterns, velocity ramps.

This spec covers the first parameter lock: **gain** (per-step
volume override). The design is extensible to future parameters
(pitch, decay, pan) without structural changes.

## Requirements

- Per-step, per-track gain override (0–100%)
- Gain lock replaces the track's mixer gain as the base;
  accent still stacks (1.5x multiplier)
- Edited via a renamed `StepPopover` (right-click /
  Ctrl+click / long-press), in a new "Locks" section below
  trig conditions
- Popover opens on **any step**, including inactive ones
  (removing the existing `isActive` guard in StepButton)
- Visual indicator: active step button opacity maps to
  locked gain (absolute; 100% lock = full opacity, 50%
  lock = 50% opacity). Inactive steps do not show opacity.
- Serialized in URL hash for sharing (backward compatible)

## Data Model

### New types (`src/app/types.ts`)

```typescript
export interface StepLocks {
  gain?: number; // 0.0–1.0
}
```

### New field in `SequencerConfig`

```typescript
parameterLocks: Partial<
  Record<TrackId, Record<number, StepLocks>>
>;
```

Mirrors `trigConditions` structure exactly. Empty object `{}`
when no locks are set.

### `Pattern` type extension

The `Pattern` interface gains an optional field:

```typescript
parameterLocks?: Partial<
  Record<TrackId, Record<number, StepLocks>>
>;
```

This allows locks to round-trip through pattern
sharing/export.

## Audio Pipeline

In `handleStep` (SequencerContext.tsx), the gain calculation
changes. Note: `handleStep` reads config via
`configRef.current` (aliased as `cfg`) and computes
`effectiveStep = trackStep(track.id)` for freeRun / per-track
length support.

```typescript
const locks =
  cfg.parameterLocks?.[track.id]?.[effectiveStep];
const baseGain = locks?.gain ?? st.gain;
const cubic = baseGain ** 3;
const gain = isAccented ? cubic * 1.5 : cubic;
```

The lock overrides the mixer gain. If no lock exists, mixer
gain is used. Accent multiplier always applies on top.

## Popover UI

### Rename

Rename `TrigConditionPopover` → `StepPopover` (file and
component). Update all imports in StepGrid, TrackRow, and
test files.

### Popover on inactive steps

Remove the `if (!isActive) return` guard in
`StepButton.openPopover()`. The popover now opens on any
step — active or inactive. This also means trig conditions
can be set on inactive steps before activating them.

### Layout

```
┌──────────────────────────┐
│ Step 3 · SD  [Reset cond]│
│                          │
│ PROBABILITY              │
│ [=========|----] 75%     │
│                          │
│ CYCLE                    │
│ [Every rep         ▾]    │
│                          │
│ FILL                     │
│ [None] [FILL] [!FILL]    │
│──────────────────────────│
│ LOCKS        [Reset locks]│
│                          │
│ GAIN                     │
│ [================] 100%  │
│ Drag to set gain lock    │
└──────────────────────────┘
```

### Behavior

- **Slider starts at 100%** when no lock exists for the step
- **Dragging the slider** creates/updates the gain lock
- Opening and closing without touching the slider = no change
- **100% is a valid lock value** — dragging to 100% keeps the
  lock. Only the "Reset locks" button removes it.
- **"Reset locks" button** clears all parameter locks for
  that step (independent from "Reset trig cond." button)
- Slider shows current locked value when a lock exists
- Slider uses same orange color as probability slider
  (`bg-orange-600`) — section headers provide distinction

### RangeSlider component

Generalize `ProbabilitySlider` into a reusable `RangeSlider`
component with configurable `min`, `max`, and `onChange`
props. Both probability (1–100) and gain (0–100) use it.

```typescript
interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}
```

### Actions

Two new actions in SequencerContext:

- `setParameterLock(trackId, stepIndex, locks: StepLocks)` —
  creates or updates locks for a step
- `clearParameterLock(trackId, stepIndex)` — removes all
  locks for a step

## State Management Parity

Every place in `SequencerContext.tsx` that manages
`trigConditions` must also manage `parameterLocks`:

- **`setPattern`** — load `parameterLocks` from the pattern
  (if present), else clear to `{}`
- **`clearPattern`** — reset `parameterLocks` to `{}`
- **`clearTrack`** — delete `parameterLocks[trackId]`
- **`setPatternLength`** — prune locks on steps beyond the
  new length (mirrors trig condition pruning)
- **`setTrackLength`** — same pruning for per-track length

**Pattern cycling (shift+drag):** Locks are NOT cleared when
patterns are cycled via drag-paint, matching existing trig
condition behavior. Orphaned locks on now-inactive steps are
harmlessly ignored during playback.

**`toggleStep`:** Does NOT clear locks. Locks persist on
inactive steps and take effect again when the step is
re-activated.

## Design Decisions

- **Kit switching** does not clear parameter locks. Gain
  locks are kit-agnostic (0–1 scalar), so they remain valid
  across kit changes.
- **Accent track (`ac`)** is excluded from parameter locks.
  It has no UI surface (hidden from grid) and its role is
  purely to flag accent — not to carry its own gain lock.
  If `ac` entries appear in a shared URL, they are silently
  dropped during validation.
- **100% is a valid lock value.** A lock at 100% means "this
  step always plays at full gain regardless of mixer." Only
  the "Reset locks" button removes a lock.
- **No config version bump needed.** The field is optional
  and backward compatible — old URLs simply lack it and
  decode to `{}`.
- **Playback glow is unaffected by opacity.** The step glow
  uses `box-shadow` which renders independently of element
  opacity. A dim gain-locked step still shows full playback
  glow — this is intentional for tracking playback position.
- **Opacity indicator only on active steps.** Inactive steps
  remain uniformly dark regardless of any locks they carry.
  The lock data persists but isn't shown visually until the
  step is activated.
- **Combined indicators: gain and probability are independent
  visually.** Opacity reflects gain lock only. The
  probability bar at the bottom remains a separate indicator.
  They are not multiplied.

## Visual Indicator

Step buttons with a gain lock have their opacity set to
the locked gain value:

- `opacity = Math.max(0.2, lockedGain)` — floor at 20%
  so steps remain visible even at gain = 0
- Only **active** steps with a gain lock change opacity;
  inactive steps and unlocked steps remain at full opacity
- Applied via inline `style` on the step button, only
  when the step is active AND
  `parameterLocks?.[trackId]?.[stepIndex]?.gain` is defined
- No CSS transition on opacity — changes are instant, which
  is appropriate for real-time parameter edits during
  playback

## Serialization (`src/app/configCodec.ts`)

### Encoding

The encoder strips `parameterLocks` from the JSON when it is
empty (`{}`), keeping URLs identical to current size when no
locks are in use. When locks exist, the field is included in
the JSON-stringified config before deflate-raw compression.

### Decoding / Validation

New `validateParameterLocks()` function (follows the
`validateTrigConditions()` pattern):
- Validates track IDs against `TRACK_IDS`
- Drops `ac` (accent) track entries
- Validates step indices are 0–63 (supports up to 64 steps)
- Clamps gain to [0, 1]
- Drops entries with no valid lock fields
- Returns `{}` for missing/invalid input

### `defaultConfig()`

Add `parameterLocks: {}` to the default config object.

### Backward Compatibility

- URLs without `parameterLocks` decode with `{}`
  (no locks = current behavior)
- Old clients ignore the field if present in a URL
  (`validateConfig` whitelists known fields)
- Golden test snapshot will need updating (`npm test -- -u`)

## Testing

### `handleStep.test.ts`
- Gain lock overrides mixer gain
- Accent stacks on locked gain (1.5x)
- No lock falls back to mixer gain
- Gain lock = 0 produces silence

### `configCodec.test.ts`
- Round-trip encode/decode preserves parameter locks
- Validation clamps out-of-range gain values
- Missing `parameterLocks` defaults to `{}`
- Invalid track IDs / step indices are dropped
- `ac` track entries are dropped
- Empty `parameterLocks` is stripped from encoded output

### `configCodec.golden.test.ts`
- Snapshot update for new defaultConfig shape

### `types.test.ts`
- Snapshot update for `SequencerConfig` shape (if applicable)

### UI tests
- Popover renders gain slider in locks section
- Drag creates a gain lock
- Reset locks button clears locks (independent of trig reset)
- Step button opacity reflects locked gain on active steps
- Inactive steps do not show opacity change
- Popover shows current locked value for existing locks
- Popover opens on inactive steps
- RangeSlider: keyboard and drag controls, min/max clamping
