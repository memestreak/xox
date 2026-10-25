# Kit Builder

Interactive CLI tool for curating drum kits from a sample
library. Scans a directory of audio files, auto-maps them
to XOX track slots by category, and lets you search, preview,
and assemble complete kits.

## Usage

```bash
./scripts/kit_builder/build_kit.py                  # default: ~/media/samples
./scripts/kit_builder/build_kit.py /path/to/samples # custom directory
python3 scripts/kit_builder                         # same, via __main__.py
```

## Requirements

- **Python 3.10+** — stdlib only, no pip packages needed
- **ffplay** — for audio preview (part of ffmpeg)
- **ffmpeg** — for .aif/.aiff → .wav conversion at copy time

## How It Works

### 1. Index

On startup the tool recursively scans the samples directory
and indexes every `.wav`, `.aif`, and `.aiff` file.
Classification runs through five stages (first match wins):

1. **Directory name** — case-insensitive match against
   known drum directory names (e.g., `kicks/` → bd,
   `Snares/` → sd, `Hats/` → ch)
2. **Subdirectory name** — matches instrument subdirs
   inside collections (Geist, Elektron, Rample, etc.),
   deepest first, so `geist/percussion/claps/` counts as
   claps
3. **Filename prefix** — `bd_`, `sd_`, `hh_`, `cl_`,
   `808 BD`, `909-sd_`, etc. Also handles double
   prefixes like `pc_bd_`
4. **HR16 abbreviations** — compressed prefixes like
   `DRBASS`, `CLHAT`, `OPNHAT`
5. **Keyword match** — whole words in the filename like
   "kick", "snare", "closed hat". Underscores and digits
   count as word breaks, so `cl_medium_clap_01` matches

| Slot | Label      | Example matches                       |
|------|------------|---------------------------------------|
| bd   | Bass Drum  | `bass_drum/`, `kicks/`, `bd_`, `kick_`, `808 BD` |
| sd   | Snare Drum | `snare/`, `sd_`, `sn_`, `snare_`      |
| ch   | Closed Hat | `closed_hats/`, `hats/`, `hh_`, `ch_` |
| oh   | Open Hat   | `open_hats/`, `oh_`, `hho_`           |
| cy   | Cymbal     | `cymbals/`, `crash/`, `ride/`, `cy_`, hats dirs |
| ht   | High Tom   | tom + word "hi"/"high", `808 HT`      |
| mt   | Mid Tom    | tom + word "mid"/"med"                |
| lt   | Low Tom    | tom + word "lo"/"low"/"floor"         |
| rs   | Rim Shot   | `rim_shots/`, `sticks/`, `rs_`, `ss_` |
| cp   | Clap       | `claps/`, `cl_`, `cp_`, "clap"        |
| cb   | Cowbell    | `cowbell/`, `cb_`, "cowbell"          |

**Toms:** pitch comes from whole words in the filename,
then the folder names ("hit" and "slow" don't count). A
tom with no pitch word is offered in all three tom slots
so you can pick by ear.

**Percussion folders** (`percussion/`, `perc/`) don't map
to a slot on their own: their samples are classified by
subfolder or filename, so shakers, congas and FX stay out
of the clap and cowbell pools. Hat directories also feed
the cy slot.

Unclassified samples are available via search fallback.

### 2. Name the Kit

You're prompted for:
- **Kit name** — display name (e.g., "Dusty Breaks")
- **Kit ID** — auto-slugified, lowercase+hyphens
- **Kit folder** — defaults to the ID

A kit ID or folder that already exists is rejected here,
before you pick any samples.

### 3. Fill Slots

For each of the 11 track slots, 10 samples are presented
spread across different source directories for variety.
All commands are single-keypress (no Enter needed):

- **1-9, 0** — preview a sample (0 = 10th)
- **a** — accept the last previewed sample (with Y/n
  confirmation)
- **n** — deal 10 new samples (no repeats until pool
  exhausted)
- **k** — skip this slot (it gets a short silent file,
  since the app loads all 11)

If no auto-suggestions exist for a slot, a text search
against the full library is offered instead.

### 4. Assemble

Once all slots are filled:
- Every pick is converted with ffmpeg to 44.1 kHz 16-bit
  WAV named `{trackId}.wav` (e.g., `bd.wav`), so browsers
  decode every kit the same way
- The kit is built in a temporary folder and moved to
  `public/kits/{folder}/` only when every file is written;
  if anything fails, nothing is left behind
- A new entry is appended to `src/app/data/kits.json`

### 5. Loop or Exit

After assembly you can build another kit or exit.
Ctrl+C exits cleanly at any point.

## File Structure

```
scripts/kit_builder/
  build_kit.py      CLI entry point + main loop
  kit_types.py      Track IDs, mappings, regex patterns
  sample_index.py   Recursive scanner + auto-classification
  preview.py        ffplay spawn/kill wrapper
  browser.py        Quick-pick UI with single-keypress input
  assembler.py      File copy/convert + kits.json update
  keys.py           Single-keypress terminal input (tty)
  colors.py         ANSI color constants
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

## Tests

```bash
uv run --extra dev pytest scripts/tests/test_kit_builder.py
```
