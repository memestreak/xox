# Pattern Modes Design

**Issue:** #47 — FR: Support pattern modes
**Date:** 2026-03-20

## Problem

When a user selects a different pattern, it applies immediately.
Musicians need control over *when* a pattern change takes effect —
at the end of the current pattern, immediately from step 0, or
immediately continuing from the current position. They also need
a "temp" mode that plays a pattern once and reverts to the
previous one.

## Pattern Modes

Three modes, selectable via dropdown. The application is always
in exactly one mode. Default: `sequential`.

### Sequential

The new pattern is queued. When the current pattern reaches its
last step (step index `patternLength - 1`, the global pattern
length — not per-track lengths), the queued pattern begins
playing from step 0. The step counter wraps naturally via
`advanceStep()` — no explicit reset is needed.

If the user selects another pattern before the current one
finishes, the latest selection replaces any previously queued
pattern (no playlist — only one pending pattern at a time).

### Direct Start

The new pattern takes effect on the very next step tick. The
step counter resets to 0, so the new pattern plays from its
beginning.

### Direct Jump

The new pattern takes effect on the very next step tick. The
step counter stays at its current position, so the new pattern
starts playing from whatever step the old pattern was on.

## Temp Mode

An optional one-shot modifier that works with any pattern mode.
Controlled by a separate toggle button (click-to-arm,
click-to-cancel — no hold/momentary mode).

### State Machine

```
off → armed      User clicks Temp button (or presses T)
armed → active   User selects a pattern while armed
active → off     Temp pattern reaches its last step
armed → off      User clicks Temp again (cancel)
armed → off      User disarms temp before queue triggers
                  (sequential: also cancels pending queue)
active → off     User stops playback (immediate revert)
```

### Behavior

1. **Arm:** User clicks the Temp button (or presses T). It
   starts blinking.
2. **Trigger:** User selects a pattern. A snapshot of the
   current config state is stored as `homeSnapshot` (see
   HomeSnapshot type below). The new pattern is applied using
   the current mode's switch semantics (sequential queues it,
   direct-start/direct-jump apply immediately). Temp state
   becomes `active`; button stops blinking, stays lit.
3. **Revert:** When the temp pattern reaches its last step, the
   `homeSnapshot` is restored and playback starts from step 0.
   Temp state returns to `off`. Button returns to neutral.

### Edge Cases

- **Selecting another pattern while temp is active:** The new
  pattern replaces the current temp pattern (same mode switch
  semantics). `homeSnapshot` is unchanged — revert still goes
  to the original.
- **Temp is one-shot:** After revert, temp state is `off`. The
  user must re-arm for another temp switch.
- **Temp when stopped:** The Temp button is disabled when
  playback is stopped.
- **Step edits during temp:** If the user edits individual
  steps while temp is active, those edits are discarded on
  revert (the homeSnapshot is restored as-is).
- **clearAll during temp/pending:** `clearAll` cancels temp
  mode (sets `tempState → 'off'`, clears `homeSnapshot`) and
  clears any `pendingPattern`. This prevents orphaned state.
- **Disarming temp while queued (sequential):** If temp is
  armed and a pattern is queued (temp + sequential), disarming
  temp cancels the pending pattern entirely — clean slate.
- **Stop during temp active:** Stopping playback immediately
  reverts to homeSnapshot and clears all temp state. The user
  sees the original pattern in the grid.
- **Stop with pending queue:** Stopping playback discards any
  pendingPattern. The user must re-select after play.
- **PatternPicker during temp:** PatternPicker highlights
  whichever pattern is currently active (the temp one). No
  special indicator for the home pattern.

## Stopped Behavior

When the sequencer is stopped, pattern selection always applies
immediately regardless of the current mode. Temp state is
irrelevant when stopped. Stopping clears temp state (reverts to
home if active) and discards any pending queue.

## State Model

### New Types (`src/app/types.ts`)

```typescript
type PatternMode = 'sequential' | 'direct-start'
                 | 'direct-jump';

type TempState = 'off' | 'armed' | 'active';

interface HomeSnapshot {
  steps: Record<TrackId, string>;
  trigConditions: SequencerConfig['trigConditions'];
  selectedPatternId: string;
  trackLengths: Record<TrackId, number>;
  patternLength: number;
}
```

**Why `patternLength` in HomeSnapshot?** If the user changes
pattern length during temp, revert must restore the original
length. This also requires calling
`audioEngine.setPatternLength()` synchronously during revert.

**Why no mixer state?** `setPattern` only updates `steps` and
`trigConditions` — it does not touch mixer state (mute/solo/gain).
Since pattern changes don't modify the mixer, there is nothing
to revert.

### Transient State (all in SequencerContext)

`patternMode` is a UI preference, not part of the shared
pattern configuration. It is **not** serialized in the URL hash
or included in `SequencerConfig`.

- `patternMode: PatternMode` — default `'sequential'`
- `tempState: TempState` — default `'off'`
- `homeSnapshot: HomeSnapshot | null` — config fields to
  restore after temp finishes. Storing a full snapshot (not just
  a pattern ID) is necessary because the user may have edited
  steps after loading a preset (making
  `selectedPatternId = 'custom'`), and `setPattern` normalizes
  step lengths.
- `pendingPattern: Pattern | null` — full pattern object queued
  in sequential mode (not just an ID, since we need steps and
  trigConditions to apply it). The `category` field is carried
  along but is cosmetic — only `steps` and `trigConditions` are
  used during application.

## Architecture

Pattern switch logic lives in `SequencerContext`. The
`AudioEngine` receives two small additions: a public
`requestReset()` method and a `pendingReset` flag.

### AudioEngine Changes

`AudioEngine.currentStep` is private. Direct-start mode and
temp revert need to reset it to 0 during playback.

**Timing hazard:** `handleStep` (the `onStep` callback) runs
inside the scheduler loop. After `onStep` returns,
`advanceStep()` immediately increments `currentStep`. If we
set `currentStep = 0` inside `onStep`, `advanceStep()` would
increment it to 1 — the wrong result.

**Solution:** Use a `pendingReset` flag that `advanceStep()`
checks:

```typescript
private pendingReset = false;

public requestReset() {
  this.pendingReset = true;
}

private advanceStep() {
  if (this.pendingReset) {
    this.currentStep = 0;
    this.pendingReset = false;
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextStepTime += 0.25 * secondsPerBeat;
    return;
  }
  const secondsPerBeat = 60.0 / this.bpm;
  this.nextStepTime += 0.25 * secondsPerBeat;
  this.currentStep =
    (this.currentStep + 1) % this.patternLength;
}
```

When `requestReset()` is called from inside `onStep`,
`advanceStep()` runs next and sees `pendingReset = true`,
setting `currentStep = 0` instead of incrementing. The timing
advance still happens so step spacing is preserved.

**Note:** Sequential mode does NOT need `requestReset()`. The
step counter naturally wraps from `patternLength - 1` to 0 via
the modulo in `advanceStep()`. Only direct-start and temp
revert call `requestReset()`.

**Lookahead behavior:** When `requestReset()` is called inside
`onStep` at step N, the scheduler's while-loop may immediately
schedule step 0 in the same tick (since both steps fall within
the 100ms lookahead window). This is correct — both steps get
precise Web Audio timestamps, so the swap is inaudible. No
delay logic is needed.

### Step Boundary Detection via `handleStep`

The `handleStep` callback in SequencerContext is called by
AudioEngine's look-ahead scheduler. It fires **ahead of real
time** (up to 100ms early per `scheduleAheadTime`). This is
the correct place to detect step boundaries, but pattern swaps
must be done via **refs** (not React state) so `handleStep`
reads the new pattern data synchronously on the very next
invocation.

The approach:

1. `handleStep` checks if the current step is the last step
   (`step === patternLength - 1`).
2. If a pending pattern or temp revert is needed, it updates
   `patternRef` (the ref that `handleStep` already reads for
   step data) **synchronously** within the callback.
3. A React state update is dispatched in parallel for UI sync,
   but `handleStep` does not depend on it — it reads from refs.
4. For direct-start and temp revert, call
   `audioEngine.requestReset()` so the next `advanceStep()`
   sets `currentStep` to 0.

This means the pending/home state must also be stored in refs:
- `pendingPatternRef` — mirrors `pendingPattern` state
- `homeSnapshotRef` — mirrors `homeSnapshot` state
- `tempStateRef` — mirrors `tempState`

The refs are the source of truth for the audio thread; React
state is the source of truth for the UI.

### Ref Synchronization Guard

The existing `useEffect` that syncs `patternRef` from
`currentPattern` (line 286-288) must be guarded to prevent
overwriting a fresher ref value set synchronously by
`handleStep`. Add a guard:

```typescript
useEffect(() => {
  // Only sync if state has caught up to the ref;
  // handleStep may have written a newer value.
  if (patternRef.current !== currentPattern) {
    patternRef.current = currentPattern;
  }
}, [currentPattern]);
```

This prevents the race where: handleStep writes new pattern to
ref → React state update queues → useEffect fires with stale
`currentPattern` → overwrites the ref. The guard ensures the
useEffect only writes when React state has truly changed.

### Step Normalization

The existing `setPattern` normalizes pattern steps (pad/truncate
to match `trackLengths`) inside a `setConfig` callback. For
immediate pattern changes (direct-start/direct-jump), the ref
path also needs normalization.

**Approach:** Extract normalization to a shared pure function:

```typescript
function normalizePatternSteps(
  steps: Record<TrackId, string>,
  trackLengths: Record<TrackId, number>
): Record<TrackId, string> {
  const result = { ...steps };
  for (const id of TRACK_IDS) {
    const cur = result[id] ?? '';
    const len = trackLengths[id];
    if (cur.length < len) {
      result[id] = cur.padEnd(len, '0');
    } else if (cur.length > len) {
      result[id] = cur.substring(0, len);
    }
  }
  return result;
}
```

Both the ref path and the state path call this function. The
ref path normalizes against `configRef.current.trackLengths`
(the active track lengths at time of application).

### `totalStepsRef` on Direct-Start Reset

When direct-start resets the step counter, `totalStepsRef` is
**not** reset. This is intentional: free-run tracks
(`freeRun: true`) use `totalStepsRef` to maintain their
independent position across pattern changes. Non-free-run
tracks use `step % len`, which naturally aligns to the new step
counter.

### Modified `setPattern` Flow

The existing `setPattern` action is extended with a wrapper that
checks playback state, pattern mode, and temp state to determine
*when* and *how* to apply the pattern:

1. **Stopped:** Apply immediately (existing behavior).
2. **Playing + temp armed:** Snapshot current config into
   `homeSnapshot`/`homeSnapshotRef`, apply using current mode
   semantics, set `tempState → 'active'`.
3. **Playing + temp active:** Replace temp pattern using current
   mode semantics, keep `homeSnapshot`.
4. **Playing + temp off + sequential:** Store full `Pattern`
   object as `pendingPattern`/`pendingPatternRef`.
5. **Playing + temp off + direct-start:** Normalize steps
   against `configRef.current.trackLengths`, update `patternRef`
   synchronously, call `audioEngine.requestReset()`, then
   update React state.
6. **Playing + temp off + direct-jump:** Normalize steps
   against `configRef.current.trackLengths`, update `patternRef`
   synchronously, then update React state (step unchanged).

### Step Boundary Hook (inside `handleStep`)

At the end of `handleStep`, after playing sounds for the
current step, check:

- If `pendingPatternRef.current` is set and
  `step === patternLength - 1`:
  → Normalize pending pattern steps against
  `configRef.current.trackLengths`, apply to `patternRef`,
  update React state, clear `pendingPatternRef`. Do NOT call
  `requestReset()` — the step counter wraps naturally.

- If `tempStateRef.current === 'active'` and
  `step === patternLength - 1`:
  → Restore `homeSnapshotRef` to `patternRef` and config refs,
  call `audioEngine.setPatternLength()` synchronously if
  `homeSnapshot.patternLength` differs from current, call
  `audioEngine.requestReset()`, update React state, set
  `tempState → 'off'`, clear `homeSnapshotRef`.

### Stop Behavior

When `togglePlay` stops playback:

1. If `tempState === 'active'`: restore `homeSnapshot` to
   config state, clear `homeSnapshot`, set `tempState → 'off'`.
2. If `pendingPattern` is set: clear it.
3. If `tempState === 'armed'`: set `tempState → 'off'` and
   clear any `pendingPattern` that was set while armed.

This runs before `audioEngine.stop()` so state is clean.

## UI

### Layout

Row 2 grid changes from 3 columns to 4:

```
grid-cols-[1fr_1fr_1.5fr]
→ grid-cols-[1fr_1fr_auto_1.5fr]
```

The new Mode column sits between Drum Kit and Pattern.

### Component: `PatternModeSelector.tsx`

Contains two controls side by side:

1. **Mode dropdown** (`<select>`): Options are "Sequential",
   "Direct Start", "Direct Jump". Styled to match the Kit
   selector.

2. **Temp button**: A square button labeled "T".
   - **Off:** `bg-neutral-800`, `border-neutral-700`
   - **Armed:** `bg-orange-600`, CSS blink animation (1s cycle,
     opacity 0.3–1.0)
   - **Active:** `bg-orange-600` solid (no animation)
   - Disabled when playback is stopped.

### Keyboard Shortcut

- **T key:** Toggle temp arm/disarm (same as clicking the
  button). Follows the existing pattern of Space for play/stop
  and F for fill.

### Mobile

The Mode column uses `auto` width (only as wide as its content).
Dropdown option labels may abbreviate on small screens.

## Files to Modify

- `src/app/types.ts` — add `PatternMode`, `TempState`,
  `HomeSnapshot` types (NOT added to `SequencerConfig`)
- `src/app/AudioEngine.ts` — add `requestReset()` method and
  `pendingReset` flag, modify `advanceStep()`
- `src/app/SequencerContext.tsx` — add transient state + refs,
  modify `setPattern`, add step-boundary logic in `handleStep`,
  add stop cleanup, extract `normalizePatternSteps()`, guard
  `patternRef` useEffect, add T keyboard shortcut
- `src/app/TransportControls.tsx` — change grid to 4 columns,
  render `PatternModeSelector`

## New Files

- `src/app/PatternModeSelector.tsx` — mode dropdown + temp
  button component

## Testing

### Unit Tests

- State machine transitions for temp mode (off → armed →
  active → off, armed → off cancel)
- `setPattern` behavior for each mode × temp state combination
- Sequential mode: pending pattern replaces on re-selection
- Sequential mode does NOT call `requestReset()` (natural wrap)
- Step boundary: pending pattern applied at last step
- Step boundary: temp revert at last step, home snapshot
  restored from step 0 with patternLength restored
- Direct-start calls `requestReset()`, next step is 0
- Stopped behavior: always immediate
- Stop during temp active: reverts to homeSnapshot
- Stop with pending queue: discards pendingPattern
- Disarm temp while queued: cancels pending pattern
- `clearAll` clears temp state and pending pattern
- Step edits during temp are discarded on revert
- `AudioEngine.requestReset()` causes `advanceStep()` to set
  `currentStep` to 0 instead of incrementing
- `totalStepsRef` is not reset on direct-start
- `normalizePatternSteps()` pads/truncates correctly
- T keyboard shortcut toggles temp state

### Manual Testing

1. Start playback with a pattern in sequential mode
2. Select a different pattern — verify it changes at end of
   current pattern
3. Switch to direct-start — verify immediate switch from step 0
4. Switch to direct-jump — verify immediate switch keeping
   step position
5. Arm temp, select a pattern — verify blink → solid → revert
6. During temp playback, select another pattern — verify it
   replaces the temp pattern but still reverts to original
7. Verify Temp button is disabled when stopped
8. Verify pattern mode is NOT in the URL hash
9. Test with patterns of varying lengths (16, 32, 64 steps)
10. Stop during temp — verify immediate revert to original
11. Stop with queued pattern — verify queue is discarded
12. Arm temp in sequential mode, disarm before queue triggers
    — verify queue is cancelled
13. Press T key — verify temp toggles
