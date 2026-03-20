# Shift+Drag Pattern Cycling

**Issue:** #41 — FR: Shift drag up/down on a cell should
cycle through various beat patterns for that track

**Date:** 2026-03-19

## Problem

Users have no quick way to populate a track with common
beat patterns. Currently they must toggle each step
individually or load an entire kit pattern (which
overwrites all tracks). This feature lets users paint
curated patterns onto a single track with a single drag
gesture.

## Interaction Design

### Mouse Gesture

1. User holds **Shift** and presses pointer down on a
   step cell (e.g., step 5 on the kick track).
2. While holding, **drags vertically** (up or down).
   Horizontal movement is ignored.
3. **Absolute vertical distance** from the click origin
   determines the pattern index. Each ~20px of distance
   advances one position. Direction (up vs down) does
   not matter — both advance through the same sequence.
4. The grid shows a **live preview**: the pattern
   replaces steps from the clicked cell through the end
   of the track. Steps before the click point are
   unchanged. If playback is active, the previewed
   pattern is **audible immediately** (mutate+restore).
5. **Releasing** the mouse commits the previewed pattern.
6. **Pressing Escape** during drag cancels the operation
   and restores the original step state.

### Touch Gesture

1. User **long-presses** (500ms) on a step cell.
2. Without releasing, **drags vertically** to cycle
   through patterns (same as mouse). Touch drag
   threshold is **10px** (vs 5px for normal drag-paint)
   to reduce accidental triggers from long-press jitter.
3. Releasing commits the pattern.
4. If the user long-presses and **releases without
   dragging**, the existing step conditions popover
   opens (no behavior change from current).

#### Touch Handoff Mechanism

StepButton sets a **shared ref flag**
(`longPressActiveRef.current = true`) when its long-press
callback fires at 500ms. `useDragPaint` checks this ref
on subsequent touch `pointerMove` events:

- If `longPressActiveRef` is true and touch movement
  exceeds 10px → enter pattern cycling mode.
- If `longPressActiveRef` is false → normal drag-paint
  mode.
- StepButton clears the flag on `pointerUp` /
  `pointerCancel`.

### Cycle Sequence

The patterns are ordered roughly by density (sparsest
to densest). The cycle positions are:

- **Position 0** — Current track state (no change).
  This is the starting point on shift+click, before
  any drag movement.
- **Position 1** — Clear (all zeros from click point
  onward).
- **Position 2..N** — Curated patterns in array order.
- **Wrap** — After the last pattern, wraps back to
  position 0 (current state).

Since position 0 is the current state, shift+click
without dragging is a **no-op**. Escape during drag
restores position 0.

### Pattern Application

- The selected pattern **replaces** all steps from the
  clicked cell through the track's length
  (`trackLengths[trackId]`).
- Steps **before** the clicked cell are unchanged.
- The pattern is **click-aligned**: pattern index 0
  maps to the clicked step. For a click at step `s`,
  the remaining `trackLength - s` steps are filled
  with pattern characters at indices `0` through
  `trackLength - s - 1`. Since patterns are 16 chars
  and tracks max at 16 steps, the pattern is always
  long enough — no tiling is needed, only truncation.
- On commit, `selectedPatternId` is set to `'custom'`
  (same as manual step edits).

### Preview Mechanism

**Mutate + restore**: On drag start, snapshot the
current track's full step string. On each cycle tick,
write the new pattern directly to state via
`setTrackSteps`. The audio engine picks up the mutated
state immediately for live auditioning. On cancel
(Escape or pointerCancel), restore the snapshot. On
commit (pointerUp), leave the mutated state in place.

### Escape Key Handling

A `keydown` listener for Escape is **added to
`document` on drag start** and **removed on drag end**
(pointerUp, pointerCancel, or Escape itself). This
avoids a persistent listener. The listener is only
active during pattern cycling mode — it has no effect
on normal drag-paint mode (which remains without
cancel support, out of scope).

### Guards

- Pattern cycling is **blocked while the step
  conditions popover is open**. Shift+drag does nothing
  if the popover is showing.

## Data Model

### New File: `src/app/data/trackPatterns.json`

A single ordered array of pattern objects, used for
**all tracks** universally. Structured for future
extensibility (per-instrument sets can be added later).

```json
{
  "patterns": [
    {
      "id": "quarter-notes",
      "name": "Quarter Notes",
      "steps": "1000100010001000"
    },
    {
      "id": "eighth-notes",
      "name": "Eighth Notes",
      "steps": "1010101010101010"
    },
    {
      "id": "offbeat-eighths",
      "name": "Offbeat Eighths",
      "steps": "0101010101010101"
    },
    {
      "id": "sixteenth-notes",
      "name": "Sixteenth Notes",
      "steps": "1111111111111111"
    }
  ]
}
```

The array order defines the cycle order. Pattern names
are for data file readability only — not surfaced in
UI. Additional subdivision and syncopation patterns
will be added during implementation.

### New Type: `TrackPattern`

```typescript
interface TrackPattern {
  id: string;
  name: string;
  steps: string; // 16-char binary string
}
```

Added to `src/app/types.ts`.

## Implementation Scope

### Files to Modify

- **`src/app/useDragPaint.ts`** — Core change. Detect
  shift+pointerdown (mouse) or long-press ref +
  pointerMove (touch) to enter pattern cycling mode.
  Track absolute vertical distance from start. Map
  distance to pattern index (wrapping via modulo).
  Snapshot steps on start, mutate via `setTrackSteps`
  on cycle, restore snapshot on Escape/pointerCancel.
  Add/remove Escape keydown listener on drag
  start/end.

- **`src/app/StepButton.tsx`** — Set
  `longPressActiveRef.current = true` when long-press
  fires. Clear on pointerUp/pointerCancel. If user
  drags after long-press, suppress the conditions
  popover (the long-press callback already fired but
  useDragPaint takes over the gesture).

- **`src/app/StepGrid.tsx`** — Import track pattern
  data. Pass pattern array and `longPressActiveRef` to
  useDragPaint hook. Pass popover-open state for the
  guard.

- **`src/app/SequencerContext.tsx`** — Add
  `setTrackSteps(trackId: TrackId, steps: string)`
  action that replaces the full step string for a
  single track. Sets `selectedPatternId` to `'custom'`.
  The caller is responsible for splicing the preserved
  prefix with the pattern before calling.

- **`src/app/types.ts`** — Add `TrackPattern` interface.

### New Files

- **`src/app/data/trackPatterns.json`** — Universal
  pattern data.

### Tests

- **`src/__tests__/useDragPaint.test.tsx`** — Test
  pattern cycling mode: shift+drag cycles patterns,
  absolute distance mapping, wrapping, preview via
  state mutation, Escape restores snapshot, position 0
  is current state (no-op on shift+click), popover
  guard blocks cycling, touch long-press handoff via
  ref flag.

- **`src/__tests__/trackPatterns.test.ts`** — Validate
  data integrity: all steps are 16-char binary strings,
  all IDs are unique.

- **`src/__tests__/SequencerContext.test.tsx`** — Test
  `setTrackSteps` action: replaces full step string,
  sets selectedPatternId to 'custom'.

## Edge Cases

- **Track length < 16:** Pattern is truncated to
  `trackLengths[trackId] - clickIndex` characters.
  Steps beyond track length are not modified.
- **Click on step 1:** Pattern fills entire track (no
  preserved prefix).
- **Click on last step:** Only that single step is set
  from pattern character 0.
- **Escape during drag:** Restores original step state
  (position 0 snapshot).
- **Browser tab switch / OS interruption:** pointerCancel
  fires, restoring snapshot.
- **Popover open:** Shift+drag is a no-op.
- **Shift+click without drag:** No-op (position 0 =
  current state).

## Out of Scope

- Per-instrument pattern sets (single universal set
  for now; data format supports adding them later).
- Visual indicator showing pattern name during preview
  (tooltip/label) — live grid preview only.
- Undo/redo support (not currently in the app).
- Per-pattern trig conditions.
- Escape-to-cancel for existing drag-paint mode
  (separate concern).
