# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when
working with code in this repository.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build (static export to /out/)
npm run lint     # ESLint
npm run typecheck  # tsc --noEmit (app + tests)
npm test         # Vitest (unit + integration)
npm run test:watch  # Vitest in watch mode
```

## Architecture

XOX is a step drum sequencer (16 steps by default, up
to 64 per track). Next.js 16 App Router with
static export to Cloudflare Pages. All app code lives in
`src/app/`.

Three-layer design:

**AudioEngine (`src/app/AudioEngine.ts`)** — Singleton managing
the Web Audio API. Implements a look-ahead scheduler (25ms timer,
100ms lookahead window) for sample-accurate playback. Preloads
and caches kit samples as AudioBuffers. Core loop:
`scheduler()` → `advanceStep()` → `playSound()`.

**computeStep (`src/app/computeStep.ts`)** — Pure function
for step computation. Takes `ComputeStepDeps` (track states,
config, cycle counts, fill state, pattern mode refs) and
returns `ComputeStepResult` (sounds to play, triggered tracks,
pattern transition signals). No side effects.

**SequencerContext (`src/app/SequencerContext.tsx`)** — React
context orchestrator composing four focused hooks. One context;
consumer API is `useSequencer()` returning
`{ state, actions, meta }`. Each part and the value are
memoized and every action is a stable callback, so the
value changes only when state or config actually changes
(every consumer still re-renders then). Keep new actions
stable (read refs, not state) so memoized children that
take them as props can skip renders. `StepGrid`
drains a scheduled-step queue (`stepQueue.ts`) in a
`requestAnimationFrame` loop for visual step sync.
Below `lg` the whole page scrolls (`Sequencer.tsx`); from
`lg` up the header is fixed and only the track area
scrolls. The grid uses `touch-action: pan-y` so vertical
swipes scroll on phones; don't set `none` on large
touch areas, or phones can't scroll past them.
Solo/mute priority: if any track is soloed, only soloed
tracks play; otherwise non-muted tracks play.
Accented steps multiply gain by `1 + accentLevel × 2`
(2x at the default accent level of 0.5, up to 3x). The
master bus runs through a limiter (`AudioEngine.init`)
so summed and accented hits don't clip. Master volume
(`MasterVolume.tsx`, `hooks/useMasterVolume.ts`) is a
gain after the limiter; it's a per-device setting in
its own localStorage key, not in `SequencerConfig`, so
share links and Reset leave it alone. `LevelMeter.tsx`
reads `audioEngine.getOutputPeaks()` each frame.

**SequencerConfig (`src/app/types.ts`)** — Canonical type for
all persistable state (kit, BPM, steps, mixer). Single source
of truth for serializable configuration.

**configCodec (`src/app/configCodec.ts`)** — Encodes/decodes
`SequencerConfig` as compressed JSON + base64url for URL hash
sharing. Uses `CompressionStream('deflate-raw')`.
`decodeShareLink` also reports the link's version: older
versions can't be loaded (the session is kept and a notice
shown), newer versions load what validates, with a notice.

**configStorage (`src/app/configStorage.ts`)** — Autosaves
the session to localStorage (debounced, flushed on
`pagehide`) and restores it on load. A share link in the
URL hash wins over the saved session and is then removed
from the URL.

**Hooks (`src/app/hooks/`)** — All custom hooks live here:
- `useFillMode.ts` — fill latch/momentary state, F-key
- `usePatternMode.ts` — pattern mode state machine, temp
  and its latch (latched Temp re-arms after each temp
  pattern; T / Shift+T)
- `useTrackConfig.ts` — all track/mixer config actions;
  a step turned on while Fill is active gets the Fill
  condition (reads `fillActiveRef`)
- `usePlayback.ts` — audio engine, handleStep, spacebar
- `useSelection.ts` — multi-step selection (Ctrl/Shift)
- `useDragPaint.ts` — pointer drag gestures on the grid
- `useMasterVolume.ts` — master fader (localStorage,
  no `reset()`: Reset deliberately keeps it)
- `useMinimizedTracks.ts` — which empty grid rows are
  drawn minimized (`state.minimizedTracks`), H / Shift+H.
  View state only: not in `SequencerConfig`, not saved.
  A track that gains steps leaves the set; AC never
  minimizes. `StepGrid` passes the visible track order
  to `useDragPaint`/`useSelection` so drags skip
  minimized rows
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

Every hook that manages resettable state must expose a
`reset()` method. The orchestrator's `clearAll` composes
all hook resets.

**Component decomposition:**
- `TrackRow.tsx` → `TrackNameButton.tsx`,
  `TrackMixer.tsx`, `TrackEndBar.tsx`; an
  `isMinimized` row renders caret + name + step line
- `StepGrid.tsx` → `GridContextMenu.tsx` (right-click
  on a blank spot: minimize / restore all tracks; the
  gear menu has the same items)
- `LatchKey.tsx` — split key for Fill and Temp: the body
  does the key's action, the right section toggles the
  latch (its LED means latched only)
- `menuStyles.ts` — menu item class strings shared by
  the track name menu and the grid menu
- `StepButton.tsx` → `stepColors.ts`, `StepBadges.tsx`
- `StepPopover.tsx` → `ProbabilityEditor.tsx`,
  `CycleEditor.tsx`, `FillConditionEditor.tsx`,
  `StepLockEditors.tsx`
- `AccentRow.tsx` shares `TrackEndBar` and `trackUtils`

Supporting files:
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
  output; settings live in `SettingsModal.tsx`
- `TempoController.tsx` — BPM input (clamped 20-300)
- `SettingsPopover.tsx` — Gear icon settings menu with
  Copy share link
- `HelpContext.tsx` / `HelpModal.tsx` — Help dialog
  (shortcuts and gestures), opened by the header
  "?" key (hidden below `sm`), the gear menu's Help item,
  or the `?` key. Its text lives in `helpContent.ts`:
  **update it whenever a shortcut or gesture changes**
- `keyboardUtils.ts` — `shouldIgnoreShortcut` for global
  key handlers: skips form fields and any open modal
  `<dialog>` (Help, Settings). `isPopupOpen` (a menu or
  the step editor) and `isPatternChooserOpen` set the
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
  row goes to the categories
- `data/kits.json` — Kit definitions (id, name, folder path)
- `data/patterns.json` — preset patterns, one binary step
  string per track (`"1010101010101010"`)
- `data/trackPatterns.json` — single-track presets
- `public/kits/{808,electro}/` — .wav samples per kit

## Testing

Tests live in `src/__tests__/` and run via Vitest + jsdom.
CI (`.github/workflows/ci.yml`) runs lint, typecheck,
tests, and a production build on every PR and push to
`main`. Vitest does not typecheck, so run
`npm run typecheck` locally too.

Test areas (not exhaustive; most components have a
matching `<Component>.test.tsx`):
- `configCodec.test.ts` — round-trip, defensive decoding,
  field validation, version status
- `configCodec.golden.test.ts` — backward-compatible
  serialization (golden hashes, base64url safety)
- `types.test.ts` — TRACK_IDS ordering, cellKey/parseCellKey
- `SequencerContext.test.tsx` — state actions, derived
  state, pattern state machine, URL hash import, autosave,
  context memoization
- `computeStep.test.ts` — pure unit tests: swing,
  solo/mute, trig conditions, accent, parameter locks,
  cycle counts, pattern boundary signals
- `computeStep.integration.test.ts` — ref-threading
  wiring between SequencerContext and computeStep
- `audioEngine.test.ts` — timing math, step wrapping
- `trackUtils.test.ts` — computeEffectiveStep, formatPan
- `hooks/` — per-hook tests for useFillMode,
  usePatternMode, useTrackConfig, usePlayback
  (useSelection and useDragPaint tests sit at the top level)
- `helpers/` — `TestWrapper`, compression polyfill,
  `encodeRaw` for building arbitrary share links
- `constants.test.ts` — snapshot of every constant
- `HelpModal.test.tsx`, `HelpContext.test.tsx`,
  `helpContent.test.ts` — help dialog, `?` key, tabs

Run `npm test` after any logic change. Run `npm test --
-u` to update snapshots after intentional format changes.

## Issue Workflow

Issues are tracked on GitHub with priority labels
(`P0-critical` through `P3-low`) and status labels
(`ready`, `needs-spec`, `blocked`).

**Branch naming:** `issue-<number>-<short-kebab-description>`
(e.g., `issue-42-fix-tempo-crash`)

**One PR per issue.** Use `Fixes #<number>` in the PR body
to auto-close the issue on merge. **Never put
`Fixes #<number>` in a commit message pushed directly to
`main`** — it auto-closes the issue before the fix is
verified. Instead, close issues manually with `gh issue
close` after verification.

**Worktrees for concurrent work:**
```bash
git worktree add .worktrees/issue-<N> -b issue-<N>-<desc>
```

## Deployment

Deploys to Cloudflare Pages automatically on push to
`main`. To verify a deployment succeeded:

```bash
gh api repos/memestreak/xox/commits/<SHA>/check-runs \
  --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
```

Dashboard:
https://dash.cloudflare.com/24104e90cc6b2473822a3e91479614cb/pages/view/xox

## iOS Audio

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

## Key Conventions

- State management is local React state only (no external stores)
- AudioContext must be resumed on a user gesture (it is
  created eagerly; see iOS Audio above)
- 12 track IDs: `ac bd sd ch oh cy ht mt lt rs cp cb`
  (`ac` is accent — hidden from UI, affects gain only)
- Patterns use binary step strings per track; tracks can
  have different lengths (1-64), and the pattern length is
  the longest track
- Tailwind CSS v4 for styling. The "Silkscreen" theme
  lives in `globals.css`: color tokens (`bg-panel`,
  `text-ink`, `text-muted`, `bg-accent`, step colors
  `bg-step1`..`bg-step4`) and fonts (`font-display` =
  Barlow Condensed for labels/captions, `font-sans` =
  Barlow, `font-mono` = JetBrains Mono, `font-logo` =
  Orbitron). Shared classes: `ss-key` (raised button),
  `ss-select` (styled native select; Chromium also
  styles the open list), `ss-label`, `ss-cap`,
  `ss-panel`, `ss-menu`, `ss-led`. Use these instead
  of raw `neutral-*`/`orange-*` colors
- Step keys are colored by group of four (808 style):
  `stepColors.ts` maps step index to group
- TypeScript strict mode

## Multi-PR Workflow

When shipping multiple related PRs that touch overlapping
files, **chain branches sequentially** — each branching
from the previous — rather than all from `main`. Merge in
order. This avoids rebase/conflict churn after each merge.

If PRs are truly independent (no file overlap), branching
from `main` is fine.

## Testing Gotchas

- **jsdom lacks `document.elementFromPoint`.** Tests that
  mock it must define the function first:
  ```ts
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
  ```

## Error Boundaries

- Top-level `ErrorBoundary` wraps the entire
  `SequencerProvider` in `Sequencer.tsx`
- `StepGrid.tsx` wraps `StepPopover` in a boundary
- `StatusBanner` shows kit load errors and share-link
  notices (uses `role="alert"`). MIDI unavailability is
  shown in the MIDI tab of `SettingsModal` instead

## Accessibility

- `globals.css` disables animations under
  `@media (prefers-reduced-motion: reduce)`
- `eslint-plugin-jsx-a11y` enforces a11y rules at
  error severity
- `StepPopover` has `aria-modal`, manual focus trap,
  auto-focus, and focus restore
- `TrackNameButton` menu has `role="menu"`,
  `aria-haspopup`, `aria-expanded`, Escape dismiss
- `TransportControls` play/stop has `aria-label` and
  `aria-pressed`
- `Sequencer` has `aria-live="polite"` for transport
  state announcements
- New components must include `aria-label` on
  interactive elements and keyboard navigation

## CSS / Layout Rules

- **Conditional borders cause layout shift.** Never add
  `border` only in one branch of a ternary. Always apply
  `border` unconditionally and toggle the color instead
  (e.g., `border-transparent` when invisible). This
  prevents 1px reflow when state changes.
  The custom lint rule `xox/no-conditional-border`
  (`eslint-rules/`) enforces this.
- **Always-mounted collapsible panels** (e.g., the pattern
  drawer) use `max-h-0`/`max-h-[Npx]` with
  `overflow-hidden` for animation. Don't use `gap` on the
  parent flex container when a collapsed child is present
  — gap still applies to 0-height children. Use `mt-*` on
  the panel (only when open) and on the next sibling
  instead.
