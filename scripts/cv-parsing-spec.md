# Spec: CV-Based Drum Pattern Grid Parser

## Overview

Replace the Gemini Vision API grid-reading stage of the drum
pattern extraction pipeline with an OpenCV computer vision
approach. The new script `scripts/parse_pdf_cv.py` performs
deterministic, single-pass grid detection and cell
classification on pre-rendered page images.

The existing `parse_pdf_patterns.py` is retained as a reference
implementation and fallback.

## Motivation

Vision LLMs hallucinate grid patterns rather than evaluating
each cell independently. A CV approach is deterministic,
faster, free (no API costs), and reproducible. The PDF's
highly structured printed grids with clear filled/empty
contrast are ideal for classical image processing.

## Input

- Pre-rendered 300 DPI PNG images from
  `scripts/parsed_patterns/images/page_NNN.png`
- Images already exist for pages 1-100 (rendered by the
  existing `extract` subcommand)
- The script does NOT re-render from PDF; it reads existing
  images directly

## Output

### Per-page JSON (`scripts/parsed_patterns/cv/page_NNN.json`)

```json
{
  "page": 9,
  "patterns": [
    {
      "name": "Afro-cub: 1",
      "grid_width": 16,
      "steps": {
        "AC": "0000000000000000",
        "BD": "1000000010100010",
        "SD": "0000000000000000",
        "CH": "1011101010101010",
        "OH": "0000010001000101",
        "CY": "0000000000000000",
        "HT": "0000000000000000",
        "MT": "0000000000000000",
        "LT": "0000000000000000",
        "RS": "0000000000000000",
        "CPS": "0010000000100000",
        "CB": "0000000000000000"
      }
    }
  ]
}
```

- Instrument keys are **uppercase** (matching PDF labels)
- `normalize_pattern()` handles lowercase conversion during
  merge
- 12-column grids are detected and recorded in the output
  but filtered out by `normalize_pattern()` (app only
  supports 16-step patterns)

### Debug output (`scripts/parsed_patterns/debug/page_NNN.png`)

Side-by-side comparison image:
- **Left:** Original page image
- **Right:** Reconstructed grid visualization showing
  detected cell states (filled vs empty) with instrument
  labels and column numbers

Generated only when `--debug` flag is passed.

## CV Pipeline (per page)

### Step 1: Preprocess

1. Load PNG as grayscale via OpenCV
2. Apply Gaussian blur (3x3 kernel) for noise reduction
3. Apply Otsu binary thresholding → black/white image

### Step 2: Detect Grids

1. **Morphological line extraction:**
   - Detect horizontal lines using a wide horizontal kernel
     (e.g. 1×40 at 300 DPI)
   - Detect vertical lines using a tall vertical kernel
     (e.g. 40×1 at 300 DPI)
2. **Grid region identification:**
   - Only regions containing BOTH horizontal AND vertical
     lines are considered grids
   - This naturally filters out musical staff notation
     (horizontal lines only) and other non-grid elements
3. **Grid ordering:**
   - Sort detected grid regions top-to-bottom by their
     y-coordinate

### Step 3: Find Cell Boundaries

1. For each grid region, compute pixel projection profiles
   along both axes
2. Apply Gaussian smoothing to the projection signal to
   handle noise from filled cells bleeding together
3. Detect peaks/valleys in the smoothed projection to locate
   row and column line positions
4. Derive cell boundaries from adjacent line positions
5. **Column count determines grid width:** count of detected
   columns (expected: 16 or 12)

### Step 4: Classify Cells

1. For each cell, extract the interior region (excluding
   grid lines — inset by a few pixels)
2. Calculate dark pixel ratio = (dark pixels) / (total
   pixels in cell interior)
3. **Adaptive threshold per grid:**
   - Compute the dark-pixel ratios for all cells in the grid
   - Cluster into "filled" and "empty" groups (e.g.
     Otsu-like clustering on the ratio distribution)
   - Use the cluster boundary as the fill threshold
   - This handles per-grid variation in print density and
     scan quality
4. Classify: ratio above threshold → filled ("1"), below →
   empty ("0")
5. The accent row (AC, row 0) uses the same threshold as
   other rows. Accent markers (triangles/carets) have
   sufficient dark pixels to be detected.

### Step 5: Extract Pattern Name

1. For each grid, define the name region as the rectangle
   between:
   - **Top:** bottom edge of the previous grid (or top of
     page for the first grid)
   - **Bottom:** top edge of the current grid
   - **Left/Right:** same horizontal extent as the grid
2. Run pytesseract OCR on this region
3. **Fallback:** if OCR returns empty or garbled text (e.g.
   no alphanumeric characters), use
   `"Page {N} Pattern {M}"` and log a warning

### Step 6: Assemble Pattern

1. Map rows to instrument IDs using fixed order:
   `AC, CY, CH, OH, HT, MT, SD, RS, LT, CPS, CB, BD`
   (top to bottom, 12 rows)
2. If the detected grid does not have exactly 12 rows, log
   a warning and **skip the grid entirely**
3. Convert cell classifications to 16-char (or 12-char)
   binary strings per instrument
4. Write per-page JSON to `scripts/parsed_patterns/cv/`

## Functions

```
scripts/parse_pdf_cv.py

New CV functions:
  preprocess_image(path) -> binary_image
    Load, grayscale, Gaussian blur (3x3), Otsu threshold.

  detect_grids(binary_image) -> list[GridRegion]
    Morphological H+V line detection. Returns bounding
    rectangles of grid regions, sorted top-to-bottom.

  find_cell_boundaries(binary_image, grid_region)
      -> (row_positions, col_positions)
    Pixel projection with Gaussian smoothing. Returns
    lists of line positions for rows and columns.

  classify_cells(binary_image, grid_region,
      row_positions, col_positions)
      -> list[list[bool]]
    Dark pixel ratio per cell interior with adaptive
    per-grid threshold. Returns 2D array [row][col].

  extract_pattern_name(image, grid_region,
      prev_grid_region) -> str
    pytesseract OCR on bounded region above grid.
    Falls back to "Page N Pattern M".

  assemble_pattern(name, cells, col_count)
      -> dict
    Maps rows to instruments, builds binary strings.
    Returns None if row count != 12.

  draw_debug_image(original, grids, patterns) -> image
    Side-by-side: original page + reconstructed grids.

Copied from parse_pdf_patterns.py:
  name_to_id(name) -> str
  clean_name(name) -> str
  normalize_pattern(raw_pattern) -> dict | None
  do_merge(parsed, patterns_path, dry_run) -> None
  INSTRUMENT_MAP, ALL_TRACK_IDS, INSTRUMENT_ORDER
```

## CLI Interface

Minimal CLI with two modes (no subcommands):

```
uv run scripts/parse_pdf_cv.py [OPTIONS]

Options:
  --pages RANGE   Page range (e.g. '9-13' or '15')
                  Default: 9-97
  --merge         Merge parsed results into patterns.json
  --dry-run       With --merge, show changes without writing
  --debug         Save side-by-side debug images to
                  scripts/parsed_patterns/debug/
```

**Default mode (no --merge):** Parse specified pages and write
per-page JSON to `scripts/parsed_patterns/cv/`.

**Merge mode (--merge):** Load all per-page JSONs from
`scripts/parsed_patterns/cv/`, normalize, and merge into
`src/app/data/patterns.json`.

## Dependencies

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "opencv-python-headless",
#     "Pillow",
#     "pytesseract",
#     "numpy",
# ]
# ///
```

**System requirement:** `tesseract` (already installed at
`/usr/bin/tesseract` v5.5.0)

**No new project-level dependencies** — the script uses inline
script metadata for uv.

## Output Directory Structure

```
scripts/parsed_patterns/
├── images/          # Existing rendered PNGs (input)
│   ├── page_009.png
│   └── ...
├── cv/              # NEW: CV-parsed per-page JSONs
│   ├── page_009.json
│   └── ...
├── debug/           # Debug side-by-side images
│   ├── page_009.png
│   └── ...
├── passes/          # Existing Gemini passes (untouched)
├── consensus/       # Existing consensus (untouched)
└── report.html      # Existing verify report (untouched)
```

## Testing

### Golden-file integration tests

Save known-good outputs for reference pages and compare
CV pipeline output against them.

**Reference pages:**
- **Page 9** — Standard page with 3 patterns (Afro-Cub 1-3),
  16-column grids. Ground truth exists in patterns.json.
- **Page 15** — Contains 12-column (triplet) grids. Tests
  that 12-col detection works and grids are recorded but
  filtered by normalize.
- **Page 8** — Text-only page with no grids. Tests that
  zero grids are detected (no false positives from text).

**Test structure:**
```
scripts/tests/
├── test_helpers.py       # Existing tests (unchanged)
├── test_cv_pipeline.py   # NEW: golden-file tests
└── golden/               # NEW: reference outputs
    ├── page_009.json
    ├── page_015.json
    └── page_008.json
```

**Test cases:**
1. Parse page 9 → output matches golden/page_009.json
   (exact match on steps, fuzzy match on names)
2. Parse page 15 → detects 12-column grids, grid_width=12
3. Parse page 8 → empty patterns list (no false positives)
4. Compare page 9 output against patterns.json ground truth
   for Afro-Cub 1-3 → cell-level accuracy check

## Acceptance Criteria

### Quantitative

1. **Pages 9-19 accuracy:** For all patterns that have
   ground truth in `patterns.json`, the CV pipeline must
   produce **<2% cell-level error rate** (i.e. fewer than
   2 incorrect cells per 100 cells compared to ground
   truth).

2. **Zero false-positive grids** on text-only pages (pages
   1-8, and any other non-grid pages in the range).

3. **12-column grid detection:** Pages 15 and 97 must have
   their 12-column grids detected with correct grid_width=12
   (even though they are filtered during normalization).

4. **Pattern name extraction:** At least 90% of pattern
   names must be correctly extracted via OCR (matching the
   names in the existing consensus files or PDF visual
   inspection).

### Qualitative

5. **Debug images** for at least 5 diverse pages (simple
   patterns, complex patterns, 12-col grids, text-only
   pages) must be visually reviewed and confirmed correct.

6. **Full range run:** `--pages 9-97` must complete without
   errors (individual grid detection failures logged as
   warnings, not crashes).

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single pass vs consensus | Single pass | CV is deterministic; no need for voting |
| Row count handling | Strict 12, skip others | All valid grids have 12 rows |
| 12-col grids | Detect, record, filter | Preserve data but app needs 16-step |
| Accent detection | Same threshold | Triangle markers have sufficient ink |
| Fill threshold | Adaptive per grid | Handles print density variation |
| Pattern names | pytesseract OCR | Preserves original book names |
| Image source | Reuse existing PNGs | Avoids 310MB duplication |
| Missing names | Fallback to position | Patterns still extracted, renamable |
| Code reuse | Copy functions | Each script self-contained |
| CLI design | Minimal (parse + merge) | Simpler than 4-subcommand design |
| Debug output | Side-by-side comparison | Visual validation without HTML |
| Preprocessing | Gaussian blur + Otsu | Standard noise-reduction pipeline |
| Column detection | Projection + smoothing | Handles merged adjacent fills |
| False grid filter | Require H+V lines | Staff notation has H-lines only |
| Test approach | Golden-file tests | Catches regressions on real data |
| Key casing | Uppercase in page JSON | Matches PDF; normalize converts |
| Script coexistence | Keep both scripts | Gemini script as reference/fallback |

## Files to Create

- `scripts/parse_pdf_cv.py` — Main CV parsing script
- `scripts/tests/test_cv_pipeline.py` — Golden-file tests
- `scripts/tests/golden/page_008.json` — Reference output
- `scripts/tests/golden/page_009.json` — Reference output
- `scripts/tests/golden/page_015.json` — Reference output

## Files Unchanged

- `scripts/parse_pdf_patterns.py` — Retained as-is
- `scripts/tests/test_helpers.py` — Retained as-is
- `src/app/data/patterns.json` — Modified only via --merge
