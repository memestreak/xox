# Hooks (`src/app/hooks/`)

Every custom hook lives here. `SequencerContext` composes the
state hooks (`useFillMode`, `usePatternMode`, `useTrackConfig`,
`usePlayback`, and the rest below) into one context; components
read it through `useSequencer()`. The architecture is in
`CLAUDE.md`; the components that use these hooks are in
[`../README.md`](../README.md).

A PR that adds a hook or changes what one does updates this
file, not `CLAUDE.md`.

## Rules

Every hook that manages resettable state must expose a
`reset()` method. The orchestrator's `clearAll` composes
all hook resets. Exceptions: `useMasterVolume` and
`useCustomSamples`, which Reset deliberately keeps.

## The hooks

- `useFillMode.ts` — fill latch/momentary state, F-key
- `usePatternMode.ts` — pattern mode state machine, temp
  and its latch (latched Temp re-arms after each temp
  pattern; T / Shift+T). A preset sets every grid
  track's volume and pan when it takes effect (a cued
  Sequential one at its boundary): its own `mixer`
  values, else the defaults. Mute, solo and the
  accent level stay (`mixerUtils.ts`). Temp's home
  snapshot keeps the mixer, and the revert restores
  those levels
- `useTrackConfig.ts` — all track/mixer config actions;
  a step turned on while Fill is active gets the Fill
  condition (reads `fillActiveRef`); turning a step
  off clears its Fill condition (probability and
  cycle stay). `clearTrackConditions`/`clearTrackLocks`
  and `clearAllConditions`/`clearAllLocks` (accent
  too) drop every condition or lock in one go; steps
  stay. Step edits and track volume/pan
  changes mark the preset modified (its id gets a
  `*`, shown as "NAME*"; helpers in `patternUtils`);
  mute, solo and the accent level don't. `custom`
  is only a share link or Reset. The chooser opens
  on a modified preset
- `usePlayback.ts` — audio engine, handleStep, spacebar
- `useSelection.ts` — multi-step selection (Ctrl/Shift)
- `useDragPaint.ts` — pointer drag gestures on the grid
- `useMasterVolume.ts` — master fader (`outputPrefs`,
  no `reset()`: Reset deliberately keeps it)
- `useCustomSamples.ts` — samples loaded from WAV files
  onto tracks (track name menu: Load sample from
  file... / Reset to kit sample, or drop a WAV on a
  row; grid menu: Reset all
  samples to kit). Memory only, not in
  `SequencerConfig` or share links; kept by kit changes
  and by Reset (no `reset()`). Each load/reset bumps a
  per-track counter so the latest request wins.
  `toggleSample` (click the dot) switches a custom
  track to the kit sample and back: the file and its
  decoded buffer stay, `state.disabledSamples` marks
  it off, and a new load turns it back on. Checks
  (WAV only, 20 MB) live in `sampleFiles.ts`;
  `AudioEngine.customBuffers` win over kit buffers
- `useMinimizedTracks.ts` — which empty grid rows are
  drawn minimized (`state.minimizedTracks`), H / Shift+H.
  View state only: not in `SequencerConfig`, not saved.
  A track that gains steps leaves the set; AC never
  minimizes. `StepGrid` passes the visible track order
  to `useDragPaint`/`useSelection` so drags skip
  minimized rows. "Auto-minimize empty tracks"
  (`useAutoMinimizeSetting.ts`, `interfacePrefs`, off
  by default; toggled in the grid menu and Settings ›
  Interface) also minimizes a track
  that loses its last step and every empty track on a
  pattern load (`loadSeq`, bumped by the setter that
  pattern loads use). A track that lost its last step
  waits while the pointer is on its row
  (`data-row-track`) or pressed on the grid
  (`holdAutoMinimize`, fed by `StepGrid`), so sparse
  tracks stay editable and drags don't move rows; it
  minimizes the moment the pointer moves off. Pattern
  loads apply at once. Reset still opens every row
- `useFileDrop.ts` — HTML drag-and-drop of files onto a
  track row (full or minimized): only drags carrying
  files react, a depth count keeps the dashed outline
  steady, and the first file goes to `loadSample`, so
  drops get the menu's checks. Separate from the pointer
  events `useDragPaint` uses. `usePreventFileNavigation`
  (mounted in `Sequencer`) cancels stray drops so the
  browser doesn't open the file
- `useInputModality.ts` — mounted once in `Sequencer`:
  sets `data-input="pointer"` on `<html>` after a
  click/tap and clears it on a navigation key (Tab,
  Enter, arrows, Home/End, PageUp/Down). `globals.css`
  hides focus rings while it's set, so Chromium doesn't
  ring a clicked button (or the opener a menu/dialog
  returns focus to) when Space, Esc or a letter
  shortcut is pressed. Focus never moves. Use
  `:focus-visible` for new focus styles; the rule
  covers outlines and Tailwind rings

