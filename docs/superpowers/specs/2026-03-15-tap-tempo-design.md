# Phase 0: Tap Tempo

Part of the [XOX Feature Roadmap](2026-03-15-feature-roadmap-design.md).

## Context

XOX has a numeric BPM input but no way to set tempo by
feel. Tap tempo lets users match a tempo by tapping a
button rhythmically.

## Behavior

- Maintain a buffer of up to 4 tap timestamps
- On each tap, compute BPM from the average of all
  available inter-tap intervals
- Minimum 2 taps required to produce a BPM; a single
  tap after reset is stored but does not update BPM
- Call `setBpm()` action with the computed BPM
- Reset the buffer if gap > 2 seconds between taps
- Keyboard shortcut (e.g., `T` key)

## Files Affected

- `src/app/TempoController.tsx` — add tap button
- No AudioEngine changes (`setBpm()` already works
  during playback)
- No serialization changes (BPM is already in config)

## Verification

1. Tap 4 times at a steady pace -> BPM updates
2. Tap once, wait 3 seconds, tap again -> buffer resets,
   single tap stored, no BPM change yet
3. Change BPM via tap while playing -> tempo changes
   smoothly
4. `npm test` passes, `npm run lint` passes
