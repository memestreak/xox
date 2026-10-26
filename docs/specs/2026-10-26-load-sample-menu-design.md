# Load Sample from File: Design

Status: approved in brainstorming and grilling
(2026-10-26).

## Context

This is the first slice of the custom kit samples design
(`docs/specs/2026-10-25-custom-kit-samples-design.md` on the
`custom-kit-samples` branch). That spec covers loading
samples, drag-and-drop, Export kit, and `import_kit.py`.
This slice builds only in-app loading from the track name
menu. The rest comes in later PRs and must fit on top of
this one without rework.

Direction: today this is a kit-building tool for the
developer. Long term it should also serve every user
("use my own snare"), with samples saved across reloads.
This slice stays memory-only but stores each sample's
original `File` so Export and persistence can be added
without changing the stored shape.

### Changes from the parent spec

| Topic | Parent spec | This spec |
|---|---|---|
| File types | WAV and AIFF | WAV only |
| Kit change | Clears custom samples | Keeps them |
| Bulk clear | None | Grid menu "Reset all samples to kit" |
| Size limit | Import only (20 MB) | Also at load (20 MB) |

The drag-and-drop and Export slices follow this spec where
they differ. Export's `base` field becomes the kit that is
current at export time.

## Decisions

| Topic | Decision |
|---|---|
| Who sees it | Everyone, on the live site |
| Entry point | Track name menu (right-click or Ctrl/Cmd-click) |
| After load | Silent swap; no automatic preview |
| File types | WAV only, checked in code, not just the picker |
| Size limit | Refuse files over 20 MB before decoding |
| Persistence | Memory only: gone on reload |
| Kit change | Custom samples stay; other tracks follow the kit |
| Reset (`clearAll`) | Keeps custom samples (like master volume) |
| Share links | Unchanged; custom audio is not included |
| Marker | Amber dot with the file name on hover; nothing else |
| Accent (`ac`) | No sample; no menu item (it has no name button) |
| Small screens | Menu only exists at `lg` row size today; unchanged |

Out of this slice (later PRs): drag-and-drop onto rows,
Export kit, `zipStore.ts`, `kitExport.ts`, `import_kit.py`,
the share-link note, saving samples across reloads.

## 1. User-facing behavior

### Track name menu

The track name menu (`TrackNameButton`) gains, above the
divider before **Clear track**:

- **Load sample from file...** Opens the browser file
  picker, filtered to WAV files. The menu closes when the
  item is chosen.
- **Reset to kit sample**, shown only when the track has a
  custom sample. Restores the current kit's sound.

Choosing a file swaps the track's sound silently: no
preview plays. If playback is running, the next scheduled
hit uses the new sample. Cancelling the picker changes
nothing. Loading onto a track that already has a custom
sample replaces it. Loading a sample does not mark the
preset modified (it is not part of `SequencerConfig`).

### Grid menu

`GridContextMenu` gains **Reset all samples to kit**,
shown only when at least one track has a custom sample.
It clears every custom sample and every dot.

### Marker

A track with a custom sample shows a small amber dot after
its name: on the full row at both sizes (`sm` and `lg`
name buttons) and on the minimized row. Hovering the dot
shows the original file name (e.g. `cl_03-smack_1.wav`)
through a native `title`. The dot is
`<span role="img" aria-label="Custom sample:
cl_03-smack_1.wav">`. There is no other marker (no kit
label count, no name restyle).

### Lifetime

- Changing kits keeps every custom sample; the other
  tracks switch to the new kit. **Reset to kit sample**
  then restores the new kit's sound. This includes a kit
  change from a share link.
- Reloading the page clears them (memory only).
- Reset (`clearAll`) does **not** clear them.
- Only the two reset menu items clear them in-session.

### Errors

Each refusal shows a `StatusBanner` message and leaves the
track's previous sound (kit or earlier custom sample) and
marker unchanged:

- Not a WAV: "Only WAV samples are supported (got
  loop.aif)."
- Over 20 MB: "big_loop.wav is too large (34 MB). Samples
  must be under 20 MB." Checked before reading the file.
- Decode failure: "Couldn't read kick.wav. It may be
  damaged or use an unusual WAV encoding."

If two loads for the same track overlap, the one started
last wins; an earlier one that finishes later is dropped.

### Help

`helpContent.ts` documents the three new menu items
(required by CLAUDE.md).

## 2. Architecture

### `sampleFiles.ts` (new, pure)

- `SAMPLE_EXTENSIONS = ['.wav']` and
  `SAMPLE_MIME_TYPES = ['audio/wav', 'audio/x-wav',
  'audio/wave', 'audio/vnd.wave']`.
- `SAMPLE_ACCEPT`: the picker's `accept` string, built
  from both lists.
- `isSupportedSampleFile(file)`: true if the name ends in
  a listed extension (case-insensitive) or the MIME type
  is listed.
- `checkSampleFile(file): string | null`: the type error
  or the size error message above, else `null`.
- `MAX_SAMPLE_FILE_BYTES = 20 * 1024 * 1024` lives in
  `constants.ts` (snapshot test updated).

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

- No args (independent of the kit).
- State: `customSamples: Partial<Record<TrackId, File>>`,
  the original file per track (name for the marker, bytes
  for later Export and persistence).
- `loadSample(track, file)`: run `checkSampleFile`; on an
  error, set `sampleError` and stop. Otherwise decode;
  on failure set the decode error. On success, if this is
  still the latest load for the track (per-track counter
  in a ref), call `setCustomSample`, store the file, and
  clear `sampleError`.
- `resetSample(track)`: `clearCustomSample` and drop the
  entry; bumps the track's counter so an in-flight load
  can't re-add it.
- `resetAllSamples()`: `clearCustomSamples()`, clear the
  state, bump every counter.
- `sampleError: string | null` and `dismissSampleError`.
- All actions are stable callbacks (read refs, not state)
  so memoized rows skip renders.
- No `reset()`: deliberately excluded from `clearAll`,
  like `useMasterVolume`. CLAUDE.md documents the
  exception and adds the hook to the hooks list.

### `SequencerContext.tsx`

- Composes `useCustomSamples`. Exposes
  `state.customSamples`, `state.sampleError`, and
  `actions.loadSample`, `actions.resetSample`,
  `actions.resetAllSamples`, `actions.dismissSampleError`.
- `sampleError` does not reuse `usePlayback`'s
  `loadError`, which the kit loader clears on every kit
  change.
- `Sequencer.tsx` shows one message in `StatusBanner`, in
  this order: `loadError`, then `sampleError`, then
  `importNotice`, with the matching dismiss action.

### Track rows

- `StepGrid` reads `state.customSamples`,
  `actions.loadSample` and `actions.resetSample` from
  `useSequencer()` and passes them to each `TrackRow`
  (as `customSampleName`, `onLoadSample`,
  `onResetSample`, bound to the row's track the same way
  existing per-track callbacks are). It passes
  `hasCustomSamples` and `resetAllSamples` to
  `GridContextMenu`.
- `TrackRow` passes them to `TrackNameButton`, and the
  name to `MinimizedTrackRow` for its marker.
- `TrackNameButton` (lg only) renders a hidden
  `<input type="file" accept={SAMPLE_ACCEPT}>` (ref) as a
  sibling of the name button, outside the
  `menuOpen && ...` block, so it stays mounted after the
  menu closes. The menu item calls `input.click()` in its
  click handler (a user gesture, so the picker opens in
  all browsers), then closes the menu. The input's
  `onChange` passes the first file to `onLoadSample` and
  clears `value` so the same file can be chosen again.
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
- `sampleFiles`: extension and MIME matching
  (case-insensitive), non-WAV rejected, size limit
  boundary, `SAMPLE_ACCEPT` contents.
- `AudioEngine`: custom buffer preferred over kit buffer;
  cleared custom slot falls back to the kit; `preloadKit`
  leaves custom buffers alone.
- `useCustomSamples`: load stores the file and sets the
  buffer; type, size and decode errors each set their
  message and keep the previous state; per-track reset;
  reset all; overlapping loads keep the last started; a
  reset during a load wins; a successful load clears
  `sampleError`.
- `SequencerContext.test.tsx`: `clearAll` keeps custom
  samples; a kit change keeps them; banner precedence in
  `Sequencer`.
- `TrackRow`/`StepGrid`: minimized row shows the dot;
  props reach the name button.
- `TrackNameButton`: Load item present; Reset item only
  when custom; file input change calls `onLoadSample`;
  dot with its `title` and `aria-label`; the file input
  is still mounted after the menu closes.
- `GridContextMenu`: Reset all item only when a track is
  custom; calls `resetAllSamples`.
- `helpContent`: new entries.

Browser (per CLAUDE.md, UI change):
- Right-click OH, load a WAV, confirm the dot and that
  playback and preview use the new sample.
- Switch kits; confirm OH keeps the custom sample and its
  dot while other tracks change.
- Pick a non-WAV and a corrupt WAV; confirm the banners
  and that the old sound remains.
- Reset to kit sample on one track; load two tracks and
  use Reset all samples to kit.
