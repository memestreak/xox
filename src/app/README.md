# App code (`src/app/`)

What the files in `src/app/` do. `CLAUDE.md` has the commands,
the rules and the three-layer architecture (`AudioEngine`,
`computeStep`, `SequencerContext`); the hooks are described in
[`hooks/README.md`](./hooks/README.md) and the preset data in
[`data/README.md`](./data/README.md).

A PR that adds a component or file, or changes what one does,
updates this file (or `hooks/README.md`), not `CLAUDE.md`.

## Playback

`StepGrid` drains a scheduled-step queue (`stepQueue.ts`) in a
`requestAnimationFrame` loop for visual step sync.

Solo/mute priority: if any track is soloed, only soloed
tracks play; otherwise non-muted tracks play.

Accented steps multiply gain by `1 + accentLevel × 2`
(2x at the default accent level of 0.5, up to 3x). The
master bus runs through a limiter (`AudioEngine.init`)
so summed and accented hits don't clip. Master volume
(`MasterVolume.tsx`, `hooks/useMasterVolume.ts`) is a
gain after the limiter; it's a preference
(`xox.sequencer.output`, deliberately not in the
Settings dialog), not in
`SequencerConfig`, so share links and Reset leave it
alone. `LevelMeter.tsx`
reads `audioEngine.getOutputPeaks()` each frame.

### iOS audio

iOS routes Web Audio through the "ambient" audio session
by default, which obeys the hardware Silent Mode switch.
`AudioEngine.bypassSilentMode()` forces the "playback"
category by playing a looping silent `<audio>` element
(WAV data URI) on first `start()`. This runs within the
user gesture context and requires no external library.

The AudioContext is created eagerly in `preloadKit()` —
`decodeAudioData` works on a suspended context, so
deferring init to a user gesture is unnecessary and
introduces race conditions.

## Layout

Below `lg` the whole page scrolls (`Sequencer.tsx`); from
`lg` up the header is fixed and only the track area
scrolls. The grid uses `touch-action: pan-y` so vertical
swipes scroll on phones; don't set `none` on large
touch areas, or phones can't scroll past them.

## Saving and sharing

**configCodec (`src/app/configCodec.ts`)** — Encodes/decodes
`SequencerConfig` as compressed JSON + base64url for URL hash
sharing. Uses `CompressionStream('deflate-raw')`.
`decodeShareLink` also reports the link's version: older
versions can't be loaded (the session is kept and a notice
shown), newer versions load what validates, with a notice.

**configStorage (`src/app/configStorage.ts`)** — Autosaves
the session (the work) to localStorage at
`xox.sequencer.works.session` (debounced, flushed on
`pagehide`) and restores it on load. A share link in the
URL hash wins over the saved session and is then removed
from the URL.

**Preferences (`src/app/preferences.ts`)** — Per-viewer,
per-device settings, never in `SequencerConfig` or share
links. Follows the `settings-philosophy` skill: one
localStorage key per Settings section,
`xox.<page>.<section>` (`xox.general.interface`,
`xox.sequencer.midi`, plus `xox.sequencer.output` for
the fader), a JSON
object checked field by field by the section's parser
(bad or missing fields take defaults). Each section is a
`createPreferenceSection` store (`get`/`set`/`update`/
`useValue`); MIDI is saved by `MidiEngine` at
`MIDI_PREFS_KEY` (parser in `midiConfig.ts`). Old
`xox-*` keys are not read (dropped, not migrated). Every
preference must appear in `SettingsModal`, except the
master volume (header fader only, by choice); controls
elsewhere (the grid menu toggle) are shortcuts
that apply at once to the same saved value. A failed
save warns once in the console.

## Parameter locks and retrig

A parameter lock (`StepLocks` in `types.ts`) overrides a
track setting on one step: `gain`, `pan` and `retrig`.
`computeStep` reads a step's locks when it fires; the step
editor (`StepPopover` → `StepLockEditors.tsx`,
`RetrigEditor.tsx`) sets them through `setParameterLock`, and
`configCodec` validates each field (`validateRetrig`).

Retrig (#201) repeats a step's hit as a roll. `rate` is the
note value between hits (1/5 to 1/80, `RETRIG_RATES`) and
`length` how long the roll lasts in steps, from 1/128 to a
whole note (`RETRIG_LENGTHS`; a step is a 1/16, and lengths
under a step make flams). `retrig.ts` holds the options and
`retrigHits`, which turns one lit step into hit offsets: a
roll stops at the track's next lit step and at the end of the
pattern. `computeStep` expands the step into those timed hits
and carries a roll that runs past its step into the next
steps (`Rolls`), scheduling one step at a time, so Stop, a
pattern change or an edit to the track ends it, and a new hit
on the track ends an older roll. Turning retrig off keeps
`rate` and `length` (`enabled: false`). The editor is an
Off/On switch and two stepped `Knob` dials (double-click a
dial or its value to reset: 1/32 for 1/16, `DEFAULT_RETRIG`).
On the grid, `retrigCoverage` counts the hits per step for
the dots on the step keys (`RetrigDots` in `StepBadges.tsx`,
at most `RETRIG_DOTS_MAX`).

## Components

- `TrackRow.tsx` → `TrackNameButton.tsx` (track menu,
  desktop only: Free-run, Load sample, Reset to kit
  sample, Reset trig conditions, Clear parameter
  locks (disabled when the track has none), Clear
  track pattern),
  `TrackMixer.tsx`, `TrackEndBar.tsx`; an
  `isMinimized` row renders caret + name + step line
- `StepGrid.tsx` → `GridContextMenu.tsx` (grid menu:
  minimize empty / restore all tracks, Reset all samples
  to kit (only when a track is custom), Copy pattern,
  Reset trig conditions, Clear parameter locks
  (disabled when nothing to clear), Reset pattern.
  Opens from the ⋯ key over the track names, the only
  way in on phones, or a right-click on a blank spot)
- `CustomSampleDot.tsx` — amber dot button on a track
  with a custom sample: solid when on, hollow when off,
  click toggles, hover explains. On desktop rows it sits
  in an overlay over the name button (an invisible copy
  of the name places it) so it isn't nested in a button
- `LatchKey.tsx` — split key for Fill and Temp: the body
  does the key's action, the right section toggles the
  latch (its LED means latched only)
- `menuStyles.ts` — menu item class strings shared by
  the track name menu and the grid menu
- `LcdSelect.tsx` — every dropdown (Kit, Pattern
  change, Cycle, MIDI settings): amber LCD key, list
  with the chosen row as an inverted amber bar. Use it
  instead of a native `<select>`. Select-only combobox:
  focus stays on the key; ↓ ↑ Enter open (Space stays
  play/stop), typing jumps, Esc closes. An option's
  `hint` shows beside its row on hover or arrow keys
  (Pattern change modes; texts in `tooltips.json`).
  The Pattern key and the chooser's pattern list reuse
  the LCD look (`ss-lcd-select`, `LcdCaret`)
- `StepButton.tsx` → `stepColors.ts`, `StepBadges.tsx`
- `StepPopover.tsx` → `ProbabilityEditor.tsx`,
  `CycleEditor.tsx`, `FillConditionEditor.tsx`,
  `StepLockEditors.tsx`
- `AccentRow.tsx` shares `TrackEndBar` and `trackUtils`


## Supporting files

- `types.ts` — `TrackId`, `Kit`, `Pattern`, `TrackState`,
  `SequencerConfig`, `TrackMixerState` types; `TRACK_IDS`
  and `TRACKS` (grid tracks, display order);
  `cellKey()`/`parseCellKey()` for selection identifiers
- `constants.ts` — all timing, threshold, and tuning
  values (import from here, not inline literals)
- `trackUtils.ts` — `computeEffectiveStep`, `formatPan`
- `trigConditions.ts` — `evaluateCondition` for trig gating.
  Cycle conditions (e.g. 1:2) count the loops each track
  actually plays: a track's cycle advances whenever its own
  step wraps to 0, including at pattern boundaries
- `stepQueue.ts` — scheduled steps for the visual playhead
- `gridUtils.ts`, `patternUtils.ts` — grid geometry and
  pattern helpers
- `MidiEngine.ts` / `MidiContext.tsx` — Web MIDI note
  output; settings live in `SettingsModal.tsx`.
  `MidiContext` connects on load when saved as enabled;
  `applyConfig` saves the whole config
- `TempoController.tsx` — BPM input (clamped 20-300)
- `StepsEntry.tsx` — pattern length (1-64): LCD field
  plus a split ▲/▼ key; drag, hold-to-repeat, ↑/↓
  (Shift = 4), typing; double-click resets to 16.
  Each gesture passes the tracks
  from its start as `setPatternLength(n, base)`, so
  going down and back up within it keeps the steps
- `SettingsButton.tsx` — gear key, the last header
  key (after `?`); mounts `SettingsModal` while open.
  The dialog is REAPER-style: a list of two sections
  (Interface, MIDI; no groups, by choice) and a pane
  headed with the section name, one row per field. It
  opens at Interface. Its size is fixed
  (`h-[min(540px,…)]`); the list and the pane scroll
  inside it, so it never resizes. Below `sm` the list
  is a strip of section keys. Changes are staged: OK
  saves and closes, Apply saves (disabled until
  something differs), Cancel / Esc / × discard.
  Double-click a field's label (long-press on touch)
  stages its default; the control itself never
  resets. It has no Help key
- `ShareLinkButton.tsx` — Copy share link key in its
  own Share cell after Swing (Swing has no % readout);
  its note says custom samples aren't included. Below
  `lg` the strip is a 12-column grid
- `KitSelector.tsx` — Kit dropdown; right-click (or the
  context-menu key) opens the kit menu: Export kit...
- `ContextMenu.tsx` — floating menu shell (position,
  focus, arrows, dismissal) used by the grid and kit
  menus
- `ExportKitDialog.tsx` — modal `<dialog>`: Name, ID
  (slug follows the name until edited) and the slots;
  downloads `<id>.zip` for
  `scripts/kit_builder/import_kit.py`. Helpers in
  `kitExport.ts` (slug rule, `exportPlan`: a custom
  sample that is on, else the current kit's, and
  `buildKitZip`); `zipStore.ts` writes the stored zip
- `HelpContext.tsx` / `HelpModal.tsx` — Help dialog
  (shortcuts and gestures), opened by the header
  "?" key (hidden below `sm`) or the `?` key. Its text lives in `helpContent.ts`:
  **update it whenever a shortcut or gesture changes**
- `Tooltip.tsx` — hover tooltips (texts in
  `data/tooltips.json`). On hover a tooltip shifts
  sideways to stay inside the window and any clipping
  ancestor, such as the scrolling track area
  (`tooltipFit.ts`), and wraps if wider than the window
- `keyboardUtils.ts` — `shouldIgnoreShortcut` for global
  key handlers: skips form fields and any open modal
  `<dialog>` (Help, Settings, Export kit).
  `isPopupOpen` (a menu or the step editor) and `isPatternChooserOpen` set the
  Esc order: dialog, then popup, then the pattern
  chooser, then the step selection
- `PatternPicker.tsx` — pattern chooser drawer. P opens
  and closes it; inside, arrows move a cursor that is
  real focus (roving tabindex) over the category keys
  and the pattern list, and Enter picks (same as a
  click, so Sequential cues it). Cursor math lives in
  `patternUtils.moveChooserCursor`: ← → wrap; on the
  category keys ↑ ↓ move between their wrapped lines
  (measured from the DOM); in the list ↑ from the top
  row goes to the categories. A click beside the app's
  column (outside `data-chooser-area` in `Sequencer`)
  closes it like Esc and does nothing else (the step
  selection stays; `keyboardUtils.isChooserClickAway`).
  Settings › Interface turns that off
  (`useChooserClickAwaySetting.ts`, `interfacePrefs`,
  on by default)
- `mocks/useMock.ts`, `mocks/MockSwitcher.tsx` — UI
  options on a branch while Jeremy picks
  (`docs/specs/2026-11-01-mock-switcher-design.md`).
  Declare each with `useMock(MOCK_CONST)` (link
  parameter, label, options; first is the default),
  never by reading the query string. `Sequencer` mounts
  the switcher card, shown only when the link names a
  declared mock. `noMocksLeft.test.ts` fails while any
  file outside `src/app/mocks/` calls `useMock(`, so a
  mock branch stays red in CI until the pick: open it as
  a draft, and afterwards keep only the chosen option
- `data/kits.json` — Kit definitions (id, name, folder path)
- `patternExport.ts` — Copy pattern (grid menu): the
  grid as a `patterns.json` entry (preset id without
  `*`, name, category, tracks, non-default volume/pan;
  no BPM, swing, kit, mute or solo).
  `scripts/save_pattern.py` (`npm run save-pattern`,
  reads a file, piped stdin or `pbpaste`) checks it and
  replaces the preset with that id, or appends it. This
  is how the developer updates a preset's default
- `data/patterns.json` — preset patterns, one binary step
  string per track (`"1010101010101010"`), plus an
  optional `mixer` of per-track `gain`/`pan` (0-1)
- `data/trackPatterns.json` — single-track presets
- `public/kits/{808,electro}/` — .wav samples per kit


## Error boundaries

- Top-level `ErrorBoundary` wraps the entire
  `SequencerProvider` in `Sequencer.tsx`
- `StepGrid.tsx` wraps `StepPopover` in a boundary
- `StatusBanner` shows kit load errors, refused samples
  and share-link notices, one at a time in that order
  (`statusMessage.pickStatus`; uses `role="alert"`). MIDI
  unavailability is shown in the MIDI tab of
  `SettingsModal` instead

## Accessibility notes

- `StepPopover` has `aria-modal`, manual focus trap,
  auto-focus, and focus restore
- `TrackNameButton` menu has `role="menu"`,
  `aria-haspopup`, `aria-expanded`, Escape dismiss
- `TransportControls` play/stop has `aria-label` and
  `aria-pressed`
- `Sequencer` has `aria-live="polite"` for transport
  state announcements
