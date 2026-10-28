# Export Kit and import_kit.py: Design

Status: draft (2026-10-28). Tracks #179.

## Context

Second slice of the custom kit samples design
(`docs/specs/2026-10-25-custom-kit-samples-design.md` on the
`custom-kit-samples` branch). The first slice
(`2026-10-26-load-sample-menu-design.md`, #176) loads WAV
files onto tracks from the track name menu; #177 made the
amber dot toggle a custom sample on and off.

This slice closes the loop for building kits:

```
1. Track menu > Load sample from file...  (per track)
2. Audition; click the dot to compare with the kit sample
3. Gear menu > Export kit...  ->  boom-bap-custom.zip
4. scripts/kit_builder/import_kit.py ~/Downloads/boom-bap-custom.zip
   -> public/kits/boom-bap-custom/  +  kits.json entry
5. git add / commit
```

Drag-and-drop loading comes last (section 6), after Export
and `import_kit.py` ship: the track menu stays the main way
in.

### Changes from the parent spec

| Topic | Parent spec | This spec |
|---|---|---|
| Drag-and-drop | Built with loading | Last step, a separate PR (section 6) |
| File types in zip | Original extension (`.wav`, `.aif`) | Always `.wav` (load is WAV only) |
| `base` | Kit the samples were loaded on | Kit current at export time |
| Toggled-off slot | n/a | Exports the kit sample ("export what you hear") |
| All-silent slot | Import error | Kept, only capped (the kit builder writes silent files for skipped slots) |
| Export errors | `StatusBanner` | Inline in the dialog |

## 1. User-facing behavior

### Export kit dialog

- The gear menu gains **Export kit...** under Copy share
  link. It opens a modal `<dialog>` (like `SettingsModal`).
- **Name**: default "<current kit name> custom", e.g.
  "Electro custom".
- **ID**: derived from the name with the kit builder's slug
  rule `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase, runs of other
  characters become one `-`, trimmed). Editable; once the
  user edits it, it stops following the name. An invalid ID
  shows a short hint and disables Export.
- A summary lists what goes in: per slot, the loaded file
  name for custom slots that are on, otherwise "kit". With
  no custom slots on, it says the export is a copy of the
  current kit (still allowed).
- **Export** downloads `<id>.zip` and closes the dialog. If
  fetching a kit sample fails, the dialog stays open and
  shows the error; nothing downloads.
- Esc and **Cancel** close it. While it's open, global
  shortcuts are off (`keyboardUtils` already skips open
  modal dialogs).

### Share link note

**Copy share link** shows "Link copied. Custom samples
aren't included." when any track has a custom sample (on or
off), instead of the usual confirmation.

### Help

`helpContent.ts` gains no gesture rows (the export is a
menu item, not a shortcut), so it is unchanged. The
README for `kit_builder` documents `import_kit.py`.

## 2. Export format

Uncompressed (store) zip, entries at the top level:

- `kit.json`
- `bd.wav sd.wav ch.wav oh.wav cy.wav ht.wav mt.wav lt.wav
  rs.wav cp.wav cb.wav` (all 11 slots). A custom slot that is
  on carries its original file bytes; every other slot is
  the current kit's `/kits/<folder>/<slot>.wav`.

`kit.json`:

```json
{
  "format": 1,
  "id": "electro-custom",
  "name": "Electro custom",
  "base": "electro",
  "sources": { "cp": "cl_03-smack_1.wav" }
}
```

`sources` lists the exported custom slots by original file
name; slots not in it came from `base`.

## 3. `import_kit.py`

Usage: `scripts/kit_builder/import_kit.py ZIP [--replace]`.
Stdlib plus ffmpeg, like the rest of `kit_builder`. The repo
is untouched until every step passes.

1. **Read the zip.** It must hold `kit.json` and exactly
   `<slot>.wav` for all 11 slots. Refuse a missing slot, a
   folder entry, a `..` or absolute path, any extra entry,
   or an entry over 20 MB.
2. **Check `kit.json`.** `format` is 1, `id` matches the slug
   rule, `name` is non-empty, `sources` (optional) maps slot
   IDs to strings. If the ID is in `kits.json` or
   `public/kits/<id>/` exists, stop unless `--replace`;
   `--replace` overwrites the folder and keeps the kit's
   position and entry in `kits.json` (name updated).
3. **Convert** each slot with `assembler._convert` (44.1 kHz,
   16-bit PCM, metadata stripped, channels kept).
4. **Trim** each converted file (`assembler.trim_wav`, plain
   Python with `wave` + `array`):
   - drop audio before the first frame within 50 dB of the
     file's peak, keeping 1 ms before it
   - cut after the last frame within 50 dB of peak
   - cap length: bd 2.0 s, sd 1.2 s, ch 0.5 s, oh 1.5 s,
     cy 3.0 s, ht/mt/lt 1.5 s, rs 0.6 s, cp 1.0 s, cb 0.8 s
   - 20 ms linear fade-out, at most a quarter of what's left
   - an all-silent file is only capped
5. **Verify** 11 files, each 44.1 kHz, 16-bit, 1 or 2
   channels, at least one frame, within its cap.
   Steps 3-5 run in a temp folder under `public/kits/`
   (as `assemble_kit` does), removed on any failure.
6. **Install** the folder at `public/kits/<id>/` and add
   `{id, name, folder: id}` to `src/app/data/kits.json`.
7. **Report** per slot: source (`base` or the file name from
   `sources`) and new length; then print
   `git add public/kits/<id> src/app/data/kits.json`.

It does not commit, push or run tests.

`assemble_kit` (the interactive builder) also runs
`trim_wav` on each picked sample, so every new kit gets the
same treatment. Existing kits are not re-processed.

## 4. App architecture

- **`zipStore.ts`**: pure store-only zip writer: local file
  headers, central directory, end record, CRC-32. Input
  `{ name, data: Uint8Array }[]`, output `Uint8Array`.
  No new dependency.
- **`kitExport.ts`**: `slugify(name)`, `isValidKitId(id)`,
  `exportSlots(customSamples, disabledSamples)` (which slot
  uses what) and `buildKitZip({ kit, id, name, custom,
  fetchKitSample })` returning the zip bytes. The fetcher is
  injected so tests need no network.
- **`ExportKitDialog.tsx`**: the dialog; reads
  `state.customSamples`, `state.disabledSamples` and
  `state.currentKit` through `useSequencer()`, downloads via
  an object URL.
- **`SettingsPopover.tsx`**: the menu item and the share-link
  note.
- **`scripts/kit_builder/import_kit.py`** (executable, with
  the `run`-style `sys.path` setup the other scripts use)
  and `assembler.trim_wav` + `assembler.SLOT_CAPS`.

## 5. Testing

Vitest:
- `zipStore`: entries, sizes, CRC-32 against known values,
  readable by a minimal reader in the test
- `kitExport`: slug rule, default name, slot selection with
  custom on/off, `kit.json` fields, fetch failure
- `ExportKitDialog`: defaults, ID follows name until edited,
  invalid ID disables Export, summary, error shown
- `SettingsPopover`: menu item opens the dialog; share-link
  note only with custom samples

pytest (`scripts/tests/test_import_kit.py`, ffmpeg mocked
or skipped when missing):
- each refusal in step 1 and 2, ID clash with and without
  `--replace`
- `trim_wav` on synthetic audio: lead, tail, cap, fade,
  silent file untouched
- verify step; nothing left behind on failure

Browser (Playwright on inky): load a WAV onto a track,
export, run `import_kit.py` on the download into a scratch
copy of the repo, confirm the kit shows in the Kit menu and
plays.

## 6. Later: drag-and-drop

Built after this slice ships, as its own PR. A second way
into the same `loadSample(track, file)` path; the track menu
stays.

### Behavior

- Dragging files over a track row (full, phone or minimized)
  highlights that row; leaving it or dropping clears the
  highlight. Only drags that carry files react, so step
  painting and text drags are untouched.
- Dropping loads the first file onto that track, through
  the same WAV and 20 MB checks as the menu. A refused file
  shows the usual `StatusBanner` message and the track keeps
  its sound.
- A drop is a new load, so a toggled-off track comes back
  on with the new sample (same as the menu).
- Dropping anywhere else on the page does nothing (the
  browser doesn't navigate to the file).
- The accent row takes no drops.
- Help gains a row: "Drop a WAV on a track: load it as the
  track's sample".

### Architecture

- `TrackRow` gets HTML drag handlers (`dragenter`,
  `dragover`, `dragleave`, `drop`) on the row wrapper,
  separate from the pointer events `useDragPaint` uses. A
  depth counter keeps the highlight steady while the drag
  moves over child elements.
- Highlight with an outline or ring, never a conditional
  border (`xox/no-conditional-border`).
- `Sequencer` (or `StepGrid`) calls `preventDefault` on
  `dragover`/`drop` for the page so a stray drop doesn't
  open the file.

### Testing

- Vitest: drop calls `onLoadSample` with the first file;
  non-file drags are ignored; highlight on enter, cleared
  on leave and drop; minimized rows accept drops.
- Browser on inky: drag a WAV from Finder onto a row; on
  Playwright, dispatch the drag events with a `DataTransfer`.

## Out of scope

Importing zips in the app, saving custom
samples across reloads, custom audio in share links,
loudness normalization, re-trimming existing kits.
