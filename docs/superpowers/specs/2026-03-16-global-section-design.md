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
- Swing knob: reuses rotary knob pattern from TrackRow
  gain controls, displays current percentage as a label
  below the knob (e.g., "0%", "50%")
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
  `"0".repeat(trackLength)` per track
- Sets `selectedPatternId` to `'custom'`
- No confirmation dialog — intentional for fast workflow
  (loading a pattern is a quick recovery path)

**`setSwing(value: number)`**
- Clamps to 0-100
- Updates `config.swing`

**`setPatternLength`** — already exists, no changes
needed. Only the UI location moves.

### SettingsPopover.tsx

Remove the "Steps" pattern length selector and its
separator. The popover retains the Export URL button
and any future settings.

## Audio Engine — Swing Timing

Swing delays even-numbered sixteenth notes (zero-indexed
odd steps: 1, 3, 5, 7, 9, 11, 13, 15).

```
delay = (swing / 100) * (secondsPerStep / 2)
```

- At 0%: no delay (straight time)
- At 50%: triplet feel
- At 100%: even 16ths merge with next beat

**Edge case — odd pattern lengths:** When the pattern
length is odd, the last step may be an odd-indexed step
with no "next beat" to merge into. Swing delay still
applies normally — it shifts the step's timing within
the pattern cycle. At extreme swing values this may
produce a very short gap before the pattern loops, which
is musically acceptable and consistent with how hardware
sequencers handle this case.

**Implementation in `AudioEngine.ts`:**
- Add a `swing` property (0-100, default 0) with a
  public setter `setSwing(value: number)`
- In `advanceStep()`, after computing the base
  `nextStepTime`, add the swing delay for odd-indexed
  steps: `this.nextStepTime += delay`
- SequencerContext sets `audioEngine.setSwing(value)`
  via a `useEffect` watching `config.swing`, matching
  the existing pattern for `setBpm()` and
  `setPatternLength()`

**No changes to `handleStep` signature.** Swing is
purely a timing concern handled inside AudioEngine.

## Serialization — configCodec

- `swing` is included in `SequencerConfig` serialization
- Backward compatibility: when decoding URLs without a
  `swing` field, default to 0
- No codec version bump needed — the codec already
  handles missing fields gracefully via defaults

## Testing

### Unit Tests

- **SequencerContext.test.tsx:**
  - `clearAll` sets all track steps to zeros
  - `clearAll` sets pattern to 'custom'
  - `setSwing` updates swing value
  - `setSwing` clamps to 0-100

- **configCodec.test.ts:**
  - Round-trip with swing field
  - Backward compat: old URLs decode with `swing: 0`

- **audioEngine.test.ts:**
  - Swing delay calculation for odd vs even steps
  - Zero swing produces no delay
  - Boundary values (0%, 50%, 100%)

- **GlobalControls UI test:**
  - Renders steps dropdown, swing knob, clear button
  - Steps change calls `setPatternLength`
  - Clear button calls `clearAll`
  - Swing knob calls `setSwing`

### Manual Verification

1. Run dev server, confirm Global | Kit | Pattern layout
2. Test Clear button wipes all tracks immediately
3. Test swing knob audibly shifts timing at various %
4. Test on mobile viewport — three columns stay compact
5. Verify pattern length no longer in SettingsPopover
6. Export URL, reload — swing value preserved
7. Import old URL (no swing) — defaults to 0%

## Files to Modify

- `src/app/types.ts` — add `swing` to SequencerConfig
- `src/app/SequencerContext.tsx` — add `clearAll`,
  `setSwing` actions; expose `swing` in state
- `src/app/AudioEngine.ts` — swing delay in scheduling
- `src/app/TransportControls.tsx` — grid-cols-3, render
  GlobalControls
- `src/app/SettingsPopover.tsx` — remove Steps selector
- `src/app/configCodec.ts` — handle swing in
  encode/decode with default
- **New:** `src/app/GlobalControls.tsx`
- **New:** `src/__tests__/GlobalControls.test.tsx`
- Update existing test files for new state/codec fields
