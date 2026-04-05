# Kit Builder

Interactive CLI tool for curating drum kits from a sample
library. Scans a directory of audio files, auto-maps them
to XOX track slots by category, and lets you search, preview,
and assemble complete kits.

## Usage

```bash
npm run kit:build                       # default: /m/media/samples
npm run kit:build -- /path/to/samples   # custom samples directory

# Or directly:
./scripts/kit_builder/run [/path/to/samples]
```

## Requirements

- **Python 3.10+** — stdlib only, no pip packages needed
- **ffplay** — for audio preview (part of ffmpeg)
- **ffmpeg** — for .aif/.aiff → .wav conversion at copy time

## How It Works

### 1. Index

On startup the tool recursively scans the samples directory
and indexes every `.wav`, `.aif`, and `.aiff` file. Each
sample is auto-classified into one of the 11 track slots
based on its directory path and filename:

| Slot | Label      | Matched from                          |
|------|------------|---------------------------------------|
| bd   | Bass Drum  | `bass_drum/`, prefix `bd_`            |
| sd   | Snare Drum | `snare/`, prefix `sn_` or `sd_`       |
| ch   | Closed Hat | `closed_hats/`, prefix `hh_ch_`/`hh_` |
| oh   | Open Hat   | `open_hats/`, prefix `hh_oh_`         |
| cy   | Cymbal     | `percussion/` with "cy" in name       |
| ht   | High Tom   | `toms/` with "hi" in name             |
| mt   | Mid Tom    | `toms/` with "mid" in name (fallback) |
| lt   | Low Tom    | `toms/` with "lo" or "floor" in name  |
| rs   | Rim Shot   | `rim_shots/`                          |
| cp   | Clap       | `percussion/` with "clap" in name     |
| cb   | Cowbell    | `percussion/` with "cowbell" in name  |

Geist, Elektron, and Rample collections are mapped by their
internal subdirectory names (e.g., `Kick/` → bd, `Snare/` →
sd, `HiHat/` → ch).

Unclassified samples are still available via "Browse all".

### 2. Name the Kit

You're prompted for:
- **Kit name** — display name (e.g., "Dusty Breaks")
- **Kit ID** — auto-slugified, lowercase+hyphens
- **Kit folder** — defaults to the ID

### 3. Fill Slots

For each of the 11 track slots:
- Choose **s)uggested**, **a)ll**, or **k)ip**
- Type a search term to filter by substring match
- Results are paginated (20 per page); `n` for next page
- `p3` to preview sample #3, `3` to select it
- On selection the sample **auto-plays via ffplay** and
  you confirm (Y/n) or keep browsing

### 4. Assemble

Once all slots are filled:
- `.wav` files are copied directly to `public/kits/{folder}/`
- `.aif`/`.aiff` files are converted to `.wav` via ffmpeg
- Each file is renamed to `{trackId}.wav` (e.g., `bd.wav`)
- A new entry is appended to `src/app/data/kits.json`

### 5. Loop or Exit

After assembly you can build another kit or exit.
Ctrl+C exits cleanly at any point.

## File Structure

```
scripts/kit_builder/
  __main__.py       Package entry point (python3 -m)
  run               Executable entry point (shebang)
  build_kit.py      CLI flow + main loop
  types.py          Track IDs, mappings, dataclasses
  sample_index.py   Recursive scanner + auto-classification
  preview.py        ffplay spawn/kill wrapper
  browser.py        Interactive search prompts per slot
  assembler.py      File copy/convert + kits.json update
```

## Sample Library Layout

The tool works best with a library organized by drum type:

```
samples/
  bass_drum/
  snare/
  closed_hats/
  open_hats/
  toms/
  rim_shots/
  percussion/
  curated_samples/   (files prefixed bd_, sn_, hh_, etc.)
  geist/             (subdirs named Kick/, Snare/, etc.)
  elektron_kits/
```

Any directory structure works — unrecognized samples are
accessible through "Browse all".
