# Phase 1: Pattern Engine

Part of the [XOX Feature Roadmap](2026-03-15-feature-roadmap-design.md).

## Context

XOX currently locks all tracks to 16 steps with straight
timing. This phase adds variable track lengths
(polyrhythms), a Euclidean rhythm generator, and swing.

---

## 1a. Variable Track Lengths (Polyrhythms)

### Data Model

```typescript
// Added to SequencerConfig (version 2)
trackLengths: Record<TrackId, number>  // 1-16, default 16
```

- Step strings are variable-length (1-16 chars), matching
  `trackLengths[trackId]`. A track with length 5 stores
  a 5-character binary string.
- Increasing track length pads with '0' (silent steps).
- Decreasing track length truncates the string AND
  deletes any trig conditions on the removed steps.

### Audio Engine

- Global step counter stays (0-15, mod 16)
- `handleStep` computes effective step per track:
  `effectiveStep = globalStep % trackLength[trackId]`
- AudioEngine itself is unchanged

### UI

- Per-track length control (small number input or
  dropdown, 1-16) next to the track name
- Steps beyond the track length are visually dimmed
- The grid always shows 16 columns; inactive steps are
  grayed out but still clickable (for pre-programming)
- **Per-track running light:** Each track row highlights
  its own effective step position independently.
  Computed in TrackRow as
  `effectiveStep = displayStep % trackLength`.
  A 5-step track's highlight wraps back to step 0
  while a 16-step track continues forward.

### Serialization

- `configCodec` version bump to 2
- `validateSteps` updated to accept 1-16 char binary
  strings (validated against corresponding trackLength)
- `validateConfig` merges missing `trackLengths` with
  default (all 16s) for backward compat
- v1 URLs with 16-char step strings remain valid

### Golden Tests

- Keep the v1 golden hash as a backward-compatibility
  regression test (v1 hash must still decode correctly
  in the v2 app, with defaults filled in)
- Add a new v2 golden hash for the new format
- Each future version bump adds a new golden; old
  goldens never change

### Cycle Counting

- Per-track cycle counter increments when
  `globalStep % trackLength === 0`
- Stored in TransientContext (not serialized)
- Reset on stop

---

## 1b. Euclidean Rhythm Generator

### Purpose

UI tool that generates evenly-distributed patterns using
the Bjorklund algorithm.

### Interaction

- Click a new icon/button in the TrackRow (next to the
  track name) to open the Euclidean generator popover
- Controls: hits (1-16), steps (1-16), rotation (0-15)
- **Live mode:** While the popover is open, changes to
  hits/steps/rotation immediately update the pattern in
  the grid (real-time preview). The user hears the
  result if playback is running. Closing the popover
  commits the changes.
- Writes the binary string to `steps[trackId]` and
  sets `trackLengths[trackId]` to match the step count

### Implementation

- Pure function: `euclidean(hits, steps, rotation) ->
  string` (e.g., `"10010010"`)
- Output string length matches the `steps` parameter
  (not padded to 16)
- No serialization — the generated pattern is stored as
  a normal steps string
- Swing is playback-only; the Euclidean generator is not
  swing-aware. The preview uses the current swing setting
  naturally since playback applies swing at scheduling
  time.
- New component: `EuclideanGenerator.tsx`
- Algorithm reference: Bjorklund/Toussaint

---

## 1c. Swing / Groove Templates

### Data Model

```typescript
// Added to SequencerConfig (version 2)
swing: number  // 0-100, default 0. Percentage.
```

### Audio

- Swing shifts even-numbered 16th notes (off-beats)
  later in time
- Applied in `handleStep` based on **global step
  parity** (not effectiveStep), so swing stays musically
  consistent even for tracks with variable lengths:
  ```
  halfStepDuration = (60 / bpm) * 0.25 / 2
  if (globalStep % 2 === 1) {
    offset = (swing / 100) * 0.7 * halfStepDuration
    scheduledTime = time + offset
  }
  ```
- `halfStepDuration` is half of one 16th-note:
  `(60 / bpm) * 0.25 / 2`
- The 0.7 cap prevents the off-beat from colliding with
  the next on-beat
- AudioEngine's `nextStepTime` stays uniform — swing is
  a per-sound timing nudge
- Swing is purely a playback-time effect. Stored patterns
  are always "straight."

### UI

- Global swing knob/slider in transport controls or
  settings (reuse existing `Knob` component)
- Range 0-100, labeled "Swing"

---

## Verification

1. Set a track to length 5, play -> hear it loop within
   the 16-step pattern (polyrhythm with 16-step tracks)
2. Running light highlights wrap independently per track
3. Use Euclidean generator: 3 hits, 8 steps -> pattern
   "10010010", track length set to 8; changes update
   live while popover is open
4. Increase track length from 5 to 8 -> new steps are
   silent (padded with '0')
5. Decrease track length from 8 to 5 -> steps 5-7
   truncated, conditions on those steps deleted
6. Set swing to 50, play -> off-beat 16ths shift later
7. Export pattern with track lengths + swing to URL,
   open in new tab -> same settings restored
8. Open a v1 URL (no trackLengths) -> defaults to 16,
   step strings default to 16 chars
9. v1 golden hash still decodes correctly in v2 app
10. `npm test` passes, `npm run lint` passes
