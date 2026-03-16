# Global Section Design

## Context

XOX's header area has two control widgets — Drum Kit and
Pattern selectors — in a two-column grid. Global controls
like pattern length are buried in the SettingsPopover (gear
icon), making them hard to discover. Clear-all functionality
doesn't exist. There's no swing/shuffle control.

This design adds a "Global" section as a first-class widget
alongside Kit and Pattern, surfacing the most-used global
controls for faster workflow.

## Requirements

1. Add a Global section to the left of Kit and Pattern in
   the header, forming a three-column grid:
   **Global | Drum Kit | Pattern**
2. Global contains three controls:
   - **Steps** — pattern length dropdown (1-16)
   - **Swing** — rotary knob (0-100%)
   - **Clear** — button, immediate action, all 12 tracks
3. Remove pattern length from SettingsPopover (no
   duplication)
4. Three-column layout on all screen sizes (mobile and
   desktop)
5. Swing affects audio timing by delaying even-numbered
   sixteenth notes

## UI Design

### GlobalControls Component

New file: `src/app/GlobalControls.tsx`

Rendered as the first child of the existing grid in
`TransportControls.tsx`. Grid changes from `grid-cols-2`
to `grid-cols-3`.

Internal layout (horizontal flex):
```
[Steps dropdown] [Swing knob] --(spacer)-- [CLR button]
```

**Styling** matches existing Kit/Pattern cards:
- Outer: `bg-neutral-900/50 p-2 lg:p-4 border
  border-neutral-800 rounded-lg lg:rounded-xl shadow-inner`
- Label: `text-[8px] lg:text-[10px] uppercase
  tracking-widest text-neutral-500 mb-1 lg:mb-2 block
  font-bold`
- Steps dropdown: same `<select>` styling as Kit/Pattern
- Swing knob: imports `Knob` from `src/app/Knob.tsx`
  (already extracted, 0-1 normalized). Maps 0-1 to
  0-100% for display. Shows percentage label below
  (e.g., "0%", "50%").
- CLR button: `bg-neutral-800 border border-neutral-700
  rounded` with uppercase text

**Mobile:** Controls shrink proportionally. CLR button
label shortens to "C". Knob and dropdown reduce in size
via existing responsive classes.

## State Changes

### types.ts — SequencerConfig

Add `swing: number` field (0-100, default 0).

### SequencerContext.tsx — New Actions

**`clearAll()`**
- Sets all 12 track step strings to
  `"0".repeat(patternLength)` (uniform length)
- Resets all `trackLengths` to `patternLength`
- Resets `config.swing` to 0
- Sets `selectedPatternId` to `'custom'`
- No confirmation dialog — intentional for fast workflow
  (loading a pattern is a quick recovery path)
- Rationale for resetting swing: Clear is a "blank
  canvas" action, distinct from loading a pattern.
  BPM and pattern length are preserved because they
  define the time grid itself; swing and track lengths
  are compositional choices that get wiped.

**`setSwing(value: number)`**
- Clamps to 0-100
- Updates `config.swing`

**`setPatternLength`** — already exists, no changes
needed. Only the UI location moves.

**Pattern load (`setPattern`)** — does NOT reset swing.
Swing is a playback preference like BPM, preserved
across pattern changes.

### SettingsPopover.tsx

Remove the "Steps" pattern length selector and its
separator. The popover retains the Export URL button
and any future settings.

## Swing Timing

Aligns with the existing pattern engine spec
(`docs/superpowers/specs/2026-03-15-pattern-engine-design.md`
section 1c).

Swing delays even-numbered sixteenth notes (zero-indexed
odd steps: 1, 3, 5, 7, 9, 11, 13, 15) based on
**global step parity** — not per-track effectiveStep.
This keeps swing musically consistent even for tracks
with variable lengths or free-run mode.

### Timing formula (in handleStep)

```
halfStepDuration = (60 / bpm) * 0.25 / 2
if (globalStep % 2 === 1) {
  offset = (swing / 100) * 0.7 * halfStepDuration
  scheduledTime = time + offset
}
```

- The 0.7 multiplier caps effective swing at ~70% to
  prevent off-beats from colliding with the next on-beat
- At swing 0: no delay (straight time)
- At swing 50: moderate shuffle
- At swing 100: heavy shuffle (0.7 cap still applies)
- Swing value stored as 0-100, read from
  `configRef.current.swing` (no new refs needed)

### Implementation location

Swing is applied in `handleStep` (SequencerContext.tsx)
as a per-sound timing offset passed to
`audioEngine.playSound(trackId, scheduledTime, gain)`.
**AudioEngine's `nextStepTime` stays uniform** — swing
is not a clock modification.

No changes to AudioEngine.ts for swing. No changes to
the `handleStep` callback signature.

### Visual-audio desync

The step highlight (running light) fires on the grid
beat, not the swung audio time. This matches hardware
drum machine behavior where LEDs track the grid and
audio is offset. At moderate swing values the desync is
imperceptible.

### Free-run interaction

Swing applies to all tracks uniformly based on global
step parity. Free-run tracks receive the same timing
offset as normal tracks. This is consistent with
hardware behavior where swing is a clock-level feature.

### Edge case — odd pattern lengths

When pattern length is odd, the last step may be
odd-indexed with no "next beat" to merge into. Swing
delay still applies normally — it shifts the step's
timing within the pattern cycle. At extreme swing
values this may produce a short gap before the pattern
loops, which is musically acceptable.

## Serialization — configCodec

- `swing` is included in `SequencerConfig` serialization
- Backward compatibility: when decoding URLs without a
  `swing` field, default to 0
- No codec version bump needed — codebase is already at
  CONFIG_VERSION 2 (from variable track lengths). The
  codec handles missing fields via defaults.

## Testing

### Unit Tests

- **SequencerContext.test.tsx:**
  - `clearAll` sets all track steps to zeros
  - `clearAll` resets swing to 0
  - `clearAll` resets all track lengths to patternLength
  - `clearAll` sets pattern to 'custom'
  - `setSwing` updates swing value
  - `setSwing` clamps to 0-100
  - `setPattern` does not reset swing

- **handleStep.test.ts:**
  - Swing delay applied to odd-indexed steps
  - No delay on even-indexed steps
  - Zero swing produces no delay
  - 0.7 cap prevents collision at max swing
  - Swing offset scales with BPM

- **configCodec.test.ts:**
  - Round-trip with swing field
  - Backward compat: old URLs decode with `swing: 0`

- **GlobalControls UI test:**
  - Renders steps dropdown, swing knob, clear button
  - Steps change calls `setPatternLength`
  - Clear button calls `clearAll`
  - Swing knob calls `setSwing`

### Manual Verification

1. Run dev server, confirm Global | Kit | Pattern layout
2. Test Clear wipes steps, resets swing and track lengths
3. Test swing knob audibly shifts timing at various %
4. Test on mobile viewport — three columns stay compact
5. Verify pattern length no longer in SettingsPopover
6. Export URL, reload — swing value preserved
7. Import old URL (no swing) — defaults to 0%
8. Load a preset pattern — swing value persists

## Files to Modify

- `src/app/types.ts` — add `swing` to SequencerConfig
- `src/app/SequencerContext.tsx` — add `clearAll`,
  `setSwing` actions; swing offset in `handleStep`;
  expose `swing` in state
- `src/app/TransportControls.tsx` — grid-cols-3, render
  GlobalControls
- `src/app/SettingsPopover.tsx` — remove Steps selector
- `src/app/configCodec.ts` — handle swing in
  encode/decode with default
- **New:** `src/app/GlobalControls.tsx`
- **New:** `src/__tests__/GlobalControls.test.tsx`
- Update existing test files for new state/codec fields

**Not modified:** `src/app/AudioEngine.ts` — swing is
handled entirely in handleStep, AudioEngine clock stays
uniform.
