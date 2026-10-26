# Load Sample from File: Design

Status: approved in brainstorming (2026-10-26).

## Context

This is the first slice of the custom kit samples design
(`docs/specs/2026-10-25-custom-kit-samples-design.md` on the
`custom-kit-samples` branch). That spec covers loading
samples, drag-and-drop, Export kit, and `import_kit.py`.
This slice builds only in-app loading from the track name
menu. The rest comes in later PRs and must fit on top of
this one without rework.

## Decisions

| Topic | Decision |
|---|---|
| Who sees it | Everyone, on the live site |
| Entry point | Track name menu (right-click or Ctrl/Cmd-click) |
| After load | Silent swap; no automatic preview |
| Persistence | Memory only: gone on reload |
| Kit change | Choosing another kit clears all custom samples |
| Reset | Keeps custom samples (like master volume) |
| Share links | Unchanged; custom audio is not included |
| Accent (`ac`) | No sample; no menu item (it has no name button) |
| Small screens | Menu only exists at `lg` row size today; unchanged |

Out of this slice (later PRs, per the parent spec):
drag-and-drop onto rows, Export kit, `zipStore.ts`,
`kitExport.ts`, `import_kit.py`, the share-link note.

## 1. User-facing behavior

### Menu

The track name menu (`TrackNameButton`) gains, above the
divider before **Clear track**:

- **Load sample from file...** Opens the browser file
  picker. Accepts `audio/*,.wav,.aif,.aiff`. The menu
  closes when the item is chosen.
- **Reset to kit sample**, shown only when the track has a
  custom sample. Restores the current kit's sound.

Choosing a file swaps the track's sound silently: no
preview plays. If playback is running, the next scheduled
hit uses the new sample. Cancelling the picker changes
nothing.

### Marker

A track with a custom sample shows a small amber dot after
its name: on the full row at both sizes (`sm` and `lg`
name buttons) and on the minimized row. Hovering the dot
shows the original file name (e.g. `cl_03-smack_1.wav`)
through a native `title`. The dot is
`<span role="img" aria-label="Custom sample:
cl_03-smack_1.wav">`.

### Clearing

- Choosing a different kit clears every custom sample and
  every dot. This includes a kit change from a share link.
- Reloading the page clears them (memory only).
- Reset (`clearAll`) does **not** clear them.

### Errors

A file the browser can't decode (e.g. `.aif` in Chrome) is
refused with a `StatusBanner` message:
"Can't play <file name> in this browser. Try a WAV, or open
XOX in Safari." The track keeps its previous sound (kit or
earlier custom sample) and its marker state. The same
text also appears for a corrupt WAV; that is intended,
since the advice still applies.

A load that finishes after the kit has changed is
discarded, so a stale sample never lands on the new kit.

### Help

`helpContent.ts` documents both menu items (required by
CLAUDE.md).

## 2. Architecture

### `AudioEngine.ts`

- New `customBuffers: Map<TrackId, AudioBuffer>` beside
  `buffers`.
- `playSound` uses `customBuffers.get(id)` if present,
  else `buffers.get(id)`.
- `decodeSample(file: File): Promise<AudioBuffer>` calls
  `init()`, reads `file.arrayBuffer()`, and decodes with
  `ctx.decodeAudioData`. Rejects on failure.
- `setCustomSample(id, buffer)`, `clearCustomSample(id)`,
  `clearCustomSamples()`.
- `preloadKit` is unchanged; it never touches
  `customBuffers`.

### `hooks/useCustomSamples.ts`

- Args: `kitId`.
- State: `customSamples: Partial<Record<TrackId, string>>`
  mapping track to original file name. (The parent spec
  keeps the `File` for Export; that PR can widen the
  stored value then.)
- `loadSample(track, file)`: decode, then if the kit has
  not changed since the load started, call
  `setCustomSample` and record the name. On decode failure,
  report the error message above and change nothing.
- `resetSample(track)`: `clearCustomSample` and drop the
  name.
- On `kitId` change: `clearCustomSamples()` and clear the
  state. A kit-generation ref, incremented in that
  effect, guards in-flight loads: a load records the
  generation when it starts and is dropped if it
  differs when decoding ends. The effect also runs on
  mount (twice under StrictMode); that is harmless since
  nothing is loaded yet.
- Both actions are stable callbacks (read refs, not state)
  so memoized rows skip renders.
- No `reset()`: deliberately excluded from `clearAll`,
  like `useMasterVolume`. CLAUDE.md documents the
  exception and the hook in the hooks list.

### `SequencerContext.tsx`

- Composes `useCustomSamples`. Exposes
  `state.customSamples` and `actions.loadSample`,
  `actions.resetSample`.
- `useCustomSamples` owns `sampleError: string | null`
  and a stable `dismissSampleError`, exposed as
  `state.sampleError` and `actions.dismissSampleError`.
  It does not reuse `usePlayback`'s `loadError`, which
  the kit loader clears on every kit change. A
  successful load clears `sampleError`.
- `Sequencer.tsx` shows one message in `StatusBanner`, in
  this order: `loadError`, then `sampleError`, then
  `importNotice`, with the matching dismiss action.

### Track rows

- `StepGrid` reads `state.customSamples`,
  `actions.loadSample` and `actions.resetSample` from
  `useSequencer()` and passes them to each `TrackRow`
  (as `customSampleName`, `onLoadSample`,
  `onResetSample`, bound to the row's track the same way
  existing per-track callbacks are).
- `TrackRow` passes them to `TrackNameButton`, and the
  name to `MinimizedTrackRow` for its marker.
- `TrackNameButton` (lg only) renders a hidden
  `<input type="file">` (ref) as a sibling of the name
  button, outside the `menuOpen && ...` block, so it
  stays mounted after the menu closes. The menu item
  calls `input.click()` in its click handler (a user
  gesture, so the picker opens in all browsers), then
  closes the menu. The input's `onChange` passes the
  first file to `onLoadSample` and clears `value` so the
  same file can be chosen again.
- The dot (a shared `CustomSampleDot` component) sits
  beside the name button, not inside it, so the `lg`
  button's `w-14 truncate` doesn't clip it and the
  existing `<Tooltip tooltipKey="track-…">` is unchanged.
  It is a small `bg-accent` circle using theme tokens; no
  conditional borders (`xox/no-conditional-border`).
- New interactive elements get `aria-label`s and keyboard
  access (jsx-a11y is at error severity). Menu arrow-key
  navigation already picks up new `role="menuitem"`
  buttons.

## 3. Testing

Vitest:
- `AudioEngine`: custom buffer preferred over kit buffer;
  cleared custom slot falls back to the kit; `preloadKit`
  leaves custom buffers alone.
- `useCustomSamples`: load sets name and buffer; decode
  failure reports the error and keeps the previous state;
  per-track reset; kit change clears all; a load that
  finishes after a kit change is discarded; a successful
  load clears `sampleError`.
- `SequencerContext.test.tsx`: `clearAll` keeps custom
  samples; banner precedence in `Sequencer`.
- `TrackRow`/`StepGrid`: minimized row shows the dot;
  props reach the name button.
- `TrackNameButton`: Load item present; Reset item only
  when custom; file input change calls `onLoadSample`;
  dot with its `title` and `aria-label`; the file input
  is still mounted after the menu closes.
- `helpContent`: new entries.

Browser (per CLAUDE.md, UI change):
- Right-click OH, load a WAV, confirm the dot and that
  playback and preview use the new sample.
- Load an undecodable file, confirm the banner and that
  the old sound remains.
- Reset to kit sample; switch kits and confirm the dot
  clears.
