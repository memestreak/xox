# Plan: CV-Based Drum Pattern Grid Parser

## Context

The current script (`scripts/parse_pdf_patterns.py`) sends PDF
page images to Gemini Vision API to read drum pattern grids, but
vision LLMs are unreliable at precisely reading individual cells
in structured grids — they hallucinate patterns instead of
evaluating each cell independently. The PDF has ~89 pages
(9-97), each with 2-3 pattern grids (12 rows × 16 columns).

A computer vision approach using OpenCV will be far more reliable
since the grids are highly structured printed material with clear
filled/empty contrast.

## Approach

Create a new script `scripts/parse_pdf_cv.py` that replaces the
LLM-based grid reading with OpenCV image processing while
reusing the existing normalization, merge, and CLI logic.

### Pipeline per page

1. **Render** — pdftoppm at 300 DPI (reuse existing approach)
2. **Preprocess** — grayscale + binary threshold (Otsu)
3. **Detect grids** — morphological line extraction to find
   regions with both horizontal AND vertical grid lines
   (separates grids from musical notation which only has
   horizontal staff lines)
4. **Find cell boundaries** — horizontal/vertical pixel
   projection on each grid region to locate row and column
   line positions
5. **Classify cells** — dark pixel ratio in each cell interior
   (threshold ~0.2 to catch both solid fills and "F"/flam marks)
6. **Extract pattern name** — OCR via pytesseract on region
   above each grid
7. **Assemble** — map rows to instrument IDs (fixed order:
   AC, CY, CH, OH, HT, MT, SD, RS, LT, CPS, CB, BD),
   pass through `normalize_pattern()`, save as page_NNN.json

### Key design decisions

- **Morphological line detection** over Hough transform —
  simpler, naturally filters out non-grid elements
- **Projection-based cell boundaries** over contour detection —
  more reliable when adjacent filled cells merge visually
- **Dark pixel ratio** over mean intensity for fill detection —
  robust to print density variation, catches "F" marks
- **Fixed row-to-instrument mapping** — all grids use the same
  12-row order; no need to OCR the row labels
- **Adaptive column count** — count detected vertical lines
  rather than assuming 16 (pages 15, 97 have 12-column grids)

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

System requirement: `brew install tesseract` (for pytesseract)

## Script structure

```
scripts/parse_pdf_cv.py

Functions:
  render_page()            — pdftoppm (copied from existing)
  preprocess_image()       — load, grayscale, threshold
  detect_grids()           — morphological line detection
  analyze_grid_structure() — projection to find cell positions
  classify_cells()         — dark pixel ratio per cell
  extract_pattern_name()   — pytesseract OCR
  assemble_pattern()       — map to raw pattern dict
  draw_debug_overlay()     — annotated image for --debug

Reused from parse_pdf_patterns.py (copied, not imported):
  name_to_id()
  clean_name()
  normalize_pattern()
  do_merge()
  INSTRUMENT_MAP, ALL_TRACK_IDS, constants
```

### CLI (mirrors existing script)

```
--pdf PATH     Path to PDF (default: ~/patterns.pdf)
--pages RANGE  Page range, e.g. '9-13' or '15'
--merge        Merge parsed results into patterns.json
--dry-run      With --merge, show changes without writing
--debug        Save annotated debug images to
               scripts/parsed_patterns/debug/
```

## Files to create/modify

- **Create:** `scripts/parse_pdf_cv.py` (new script)
- **No changes** to existing files

## Verification

1. `brew install tesseract` if not present
2. Run on a known page to compare against existing output:
   ```bash
   uv run scripts/parse_pdf_cv.py --pages 9 --debug
   ```
3. Compare output `scripts/parsed_patterns/page_009.json`
   against the existing reference data (Afro-Cub 1-3)
4. Inspect debug image to verify grid detection and cell
   classification visually
5. Run on a few more pages (12-column grids, text-only pages):
   ```bash
   uv run scripts/parse_pdf_cv.py --pages 15 --debug
   uv run scripts/parse_pdf_cv.py --pages 8 --debug
   ```
6. Full run on all pages and merge:
   ```bash
   uv run scripts/parse_pdf_cv.py --pages 9-97
   uv run scripts/parse_pdf_cv.py --merge --dry-run
   ```
