#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "opencv-python-headless",
#     "Pillow",
#     "pytesseract",
#     "numpy",
#     "google-genai",
# ]
# ///
"""Extract drum patterns from PDF page images using OpenCV.

Reads pre-rendered 300 DPI PNG images from parsed_patterns/images/
and uses computer vision to detect grids, classify cells, and
extract pattern names via OCR.

Usage:
  uv run scripts/parse_pdf_cv.py --pages 9-13
  uv run scripts/parse_pdf_cv.py --pages 9 --debug
  uv run scripts/parse_pdf_cv.py --merge --dry-run

Requires:
  tesseract (apt install tesseract-ocr)
  Pre-rendered images in scripts/parsed_patterns/images/
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
  from google import genai

import cv2
import numpy as np
import pytesseract
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = SCRIPT_DIR / "parsed_patterns"
IMAGES_DIR = OUTPUT_DIR / "images"
CV_DIR = OUTPUT_DIR / "cv"
DEBUG_DIR = OUTPUT_DIR / "debug"
PATTERNS_JSON = PROJECT_ROOT / "src" / "app" / "data" / "patterns.json"

DEFAULT_PAGE_START = 9
DEFAULT_PAGE_END = 97
NAMES_DIR = OUTPUT_DIR / "names"
GEMINI_MODEL = "gemini-2.5-flash"

NAMES_PROMPT = """\
List ONLY the pattern names printed on this drum machine page.
Each page has 0-3 pattern names like "Afro-cub: 1", "Rock: 3",
"Blues: 4", etc. Return them in order from top to bottom.

Return a JSON array of strings, e.g.:
["Afro-cub: 1", "Afro-cub: 2", "Afro-cub: 3"]

If there are no pattern names, return [].
"""

ALL_TRACK_IDS = [
  "ac",
  "bd",
  "sd",
  "ch",
  "oh",
  "cy",
  "ht",
  "mt",
  "lt",
  "rs",
  "cp",
  "cb",
]

INSTRUMENT_MAP: dict[str, str] = {
  "AC": "ac",
  "CY": "cy",
  "CH": "ch",
  "OH": "oh",
  "HT": "ht",
  "MT": "mt",
  "SD": "sd",
  "RS": "rs",
  "LT": "lt",
  "CPS": "cp",
  "CB": "cb",
  "BD": "bd",
}

INSTRUMENT_ORDER = [
  "AC",
  "CY",
  "CH",
  "OH",
  "HT",
  "MT",
  "SD",
  "RS",
  "LT",
  "CPS",
  "CB",
  "BD",
]


def extract_names_gemini(
  client: "genai.Client",
  image_path: Path,
) -> list[str]:
  """Extract pattern names from a page image via Gemini.

  Uses a cheap, fast model call to read only the pattern
  names (not the grid data). Returns names in page order.

  Args:
    client: Gemini API client.
    image_path: Path to the page PNG.

  Returns:
    List of pattern name strings, top-to-bottom.
  """
  from google.genai import types

  image_data = image_path.read_bytes()
  image_part = types.Part.from_bytes(
    data=image_data, mime_type="image/png"
  )

  response = client.models.generate_content(
    model=GEMINI_MODEL,
    contents=[image_part, NAMES_PROMPT],
    config=types.GenerateContentConfig(
      response_mime_type="application/json",
    ),
  )

  try:
    names = json.loads(response.text)
    if isinstance(names, list):
      return [str(n) for n in names]
  except (json.JSONDecodeError, TypeError):
    logger.warning("Failed to parse Gemini names response")
  return []


def get_names_for_page(
  client: "genai.Client",
  page_num: int,
  force: bool = False,
) -> list[str]:
  """Get pattern names for a page, with caching.

  Caches results in NAMES_DIR to avoid redundant API calls.

  Args:
    client: Gemini API client.
    page_num: Page number.
    force: Re-fetch even if cached.

  Returns:
    List of pattern names.
  """
  NAMES_DIR.mkdir(parents=True, exist_ok=True)
  cache_path = NAMES_DIR / f"page_{page_num:03d}.json"

  if cache_path.exists() and not force:
    cached: list[str] = json.loads(cache_path.read_text())
    return cached

  image_path = IMAGES_DIR / f"page_{page_num:03d}.png"
  if not image_path.exists():
    return []

  names = extract_names_gemini(client, image_path)
  cache_path.write_text(json.dumps(names, indent=2) + "\n")
  time.sleep(0.5)  # Rate limiting
  return names


@dataclass
class GridRegion:
  """Bounding rectangle of a detected grid."""

  x: int
  y: int
  w: int
  h: int


# ── Copied helper functions ─────────────────────────────


def parse_page_range(
  pages_str: str | None,
  default_start: int = DEFAULT_PAGE_START,
  default_end: int = DEFAULT_PAGE_END,
) -> tuple[int, int]:
  """Parse a page range string like '9-13' or '15'.

  Args:
    pages_str: Page range string, or None for defaults.
    default_start: Default start page.
    default_end: Default end page.

  Returns:
    Tuple of (start, end) page numbers (inclusive).

  Raises:
    ValueError: If pages_str is not a valid range.
  """
  if pages_str is None:
    return default_start, default_end
  match = re.match(r"^(\d+)-(\d+)$", pages_str)
  if match:
    return int(match.group(1)), int(match.group(2))
  match = re.match(r"^(\d+)$", pages_str)
  if match:
    page = int(match.group(1))
    return page, page
  raise ValueError(f"Invalid page range: '{pages_str}'. Use 'N' or 'N-M'.")


def name_to_id(name: str) -> str:
  """Convert pattern name to an ID slug.

  Args:
    name: Pattern name as printed, e.g. 'Afro-cub: 1'.

  Returns:
    Lowercase slug, e.g. 'afro-cub-1'.
  """
  s = name.lower()
  s = re.sub(r":\s*", "-", s)
  s = re.sub(r"[^a-z0-9\-]", "-", s)
  s = re.sub(r"-+", "-", s)
  s = s.strip("-")
  return s


def clean_name(name: str) -> str:
  """Clean up pattern name for display.

  Args:
    name: Pattern name as printed, e.g. 'Afro-cub: 1'.

  Returns:
    Cleaned display name, e.g. 'Afro-Cub 1'.
  """
  s = re.sub(r":\s*", " ", name)
  s = re.sub(r"\s+", " ", s).strip()
  parts = s.split(" ")
  titled = []
  for part in parts:
    subparts = part.split("-")
    titled.append("-".join(w.capitalize() for w in subparts))
  return " ".join(titled)


def normalize_pattern(raw: dict[str, Any]) -> dict[str, Any] | None:
  """Normalize a raw parsed pattern into app format.

  Args:
    raw: Dict with 'name', 'grid_width', and 'steps'.

  Returns:
    Normalized pattern dict or None if skipped.
  """
  name = raw.get("name", "")
  grid_width = raw.get("grid_width", 0)

  if grid_width != 16:
    return None

  if "break" in name.lower():
    return None

  pattern_id = name_to_id(name)
  if not pattern_id:
    return None

  display_name = clean_name(name)

  steps: dict[str, str] = {}
  raw_steps = raw.get("steps", {})
  for pdf_key, track_id in INSTRUMENT_MAP.items():
    step_str = raw_steps.get(pdf_key, "0" * 16)
    if len(step_str) != 16 or not all(c in "01" for c in step_str):
      logger.warning(
        "Invalid step string for %s in '%s': '%s'",
        pdf_key,
        name,
        step_str,
      )
      step_str = "0" * 16
    steps[track_id] = step_str

  for tid in ALL_TRACK_IDS:
    if tid not in steps:
      steps[tid] = "0" * 16

  return {
    "id": pattern_id,
    "name": display_name,
    "steps": steps,
  }


def do_merge(dry_run: bool) -> None:
  """Merge CV-parsed patterns into patterns.json.

  Args:
    dry_run: If True, show changes without writing.
  """
  if not CV_DIR.exists():
    logger.error("No cv directory. Run parse first.")
    sys.exit(1)

  cv_files = sorted(CV_DIR.glob("page_*.json"))
  if not cv_files:
    logger.error("No CV output files. Run parse first.")
    sys.exit(1)

  parsed: dict[str, dict[str, Any]] = {}
  for cf in cv_files:
    data = json.loads(cf.read_text())
    for raw in data.get("patterns", []):
      normalized = normalize_pattern(raw)
      if normalized:
        parsed[normalized["id"]] = normalized

  print(f"Found {len(parsed)} unique patterns from {len(cv_files)} pages")

  existing_data = json.loads(PATTERNS_JSON.read_text())
  existing = {p["id"]: p for p in existing_data["patterns"]}

  new_ids = set(parsed) - set(existing)
  updated_ids = set(parsed) & set(existing)

  if dry_run:
    print("\n--- Dry Run ---")
    print(f"Would add {len(new_ids)} new patterns")
    print(f"Would update {len(updated_ids)} existing")
    if new_ids:
      print(f"\nNew: {sorted(new_ids)}")
    if updated_ids:
      print(f"\nUpdated: {sorted(updated_ids)}")
    return

  merged = dict(existing)
  merged.update(parsed)

  sorted_patterns = sorted(merged.values(), key=lambda p: p["id"])
  output = {"patterns": sorted_patterns}
  PATTERNS_JSON.write_text(json.dumps(output, indent=2) + "\n")

  print(f"Wrote {len(sorted_patterns)} patterns to {PATTERNS_JSON}")
  print(f"  Added: {len(new_ids)}")
  print(f"  Updated: {len(updated_ids)}")
  print(f"  Kept: {len(existing) - len(updated_ids)}")


# ── CV pipeline functions ───────────────────────────────


def preprocess_image(
  path: Path,
) -> tuple[NDArray, NDArray]:
  """Load image, convert to binary via Gaussian blur + Otsu.

  Args:
    path: Path to the PNG image file.

  Returns:
    Tuple of (grayscale image, binary thresholded image).
    In the binary image, foreground (ink) is white (255).
  """
  gray = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
  if gray is None:
    raise FileNotFoundError(f"Cannot load image: {path}")
  blurred = cv2.GaussianBlur(gray, (3, 3), 0)
  _, binary = cv2.threshold(
    blurred,
    0,
    255,
    cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
  )
  return gray, binary


def detect_grids(binary: NDArray) -> list[GridRegion]:
  """Detect grid regions via vertical line density.

  Pattern grids have many closely-spaced vertical lines
  (17 for 16-col, 13 for 12-col). Musical staff notation
  has only a few bar lines. We use the vertical line image,
  dilate horizontally to merge dense V-lines into blocks,
  then filter by the number of V-lines found within.

  Args:
    binary: Binary image (foreground=255, background=0).

  Returns:
    List of GridRegion bounding boxes, sorted top-to-bottom.
  """
  h, w = binary.shape

  # Detect vertical lines (must be tall enough to span
  # several grid rows, filtering out short marks)
  v_kernel_len = max(h // 40, 30)
  v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_len))
  v_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)

  # Dilate V-lines horizontally to merge dense clusters
  # into solid blocks (grid regions), but NOT vertically
  # so notation and grid below stay separate.
  h_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 8, 1))
  dilated = cv2.dilate(v_lines, h_dilate, iterations=1)

  # Small vertical dilation to fill gaps within a grid
  v_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5))
  dilated = cv2.dilate(dilated, v_dilate, iterations=1)

  contours, _ = cv2.findContours(
    dilated,
    cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_SIMPLE,
  )

  grids: list[GridRegion] = []
  for contour in contours:
    x, y, cw, ch = cv2.boundingRect(contour)

    # Filter: must be wide enough (at least 30% of page)
    if cw < w * 0.3:
      continue

    # Filter: must be tall enough
    if ch < h * 0.03:
      continue

    # Count distinct vertical lines via projection
    roi_v = v_lines[y : y + ch, x : x + cw]
    v_proj = np.sum(roi_v, axis=0)
    v_threshold = np.max(v_proj) * 0.3 if np.max(v_proj) > 0 else 1
    v_peaks = _count_runs(v_proj > v_threshold)

    # A valid grid has 13+ vertical lines (12-col)
    # or 17+ (16-col). Require at least 10.
    if v_peaks < 10:
      continue

    grids.append(GridRegion(x=x, y=y, w=cw, h=ch))

  grids.sort(key=lambda g: g.y)
  return grids


def _count_runs(mask: NDArray) -> int:
  """Count the number of True runs in a 1D boolean array.

  Args:
    mask: 1D boolean array.

  Returns:
    Number of contiguous True runs.
  """
  count = 0
  in_run = False
  for val in mask:
    if val and not in_run:
      count += 1
      in_run = True
    elif not val:
      in_run = False
  return count


def find_cell_boundaries(
  binary: NDArray,
  grid: GridRegion,
) -> tuple[list[int], list[int]]:
  """Find row and column line positions via projection.

  Uses morphologically extracted lines projected onto axes.
  Horizontal lines must span most of the grid width;
  vertical lines must span most of the grid height.

  Args:
    binary: Binary image (foreground=255).
    grid: Bounding box of the grid region.

  Returns:
    Tuple of (row_positions, col_positions) as pixel
    coordinates relative to the full image.
  """
  roi = binary[grid.y : grid.y + grid.h, grid.x : grid.x + grid.w]

  # Horizontal lines: must span most of the grid width
  h_kernel_len = max(grid.w // 2, 40)
  h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_len, 1))
  h_lines = cv2.morphologyEx(roi, cv2.MORPH_OPEN, h_kernel)

  # Vertical lines: must span a good fraction of grid height
  v_kernel_len = max(grid.h // 4, 20)
  v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_len))
  v_lines = cv2.morphologyEx(roi, cv2.MORPH_OPEN, v_kernel)

  # Project onto axes
  h_proj = np.sum(h_lines, axis=1, dtype=np.float64)
  v_proj = np.sum(v_lines, axis=0, dtype=np.float64)

  row_positions = _find_peaks(h_proj, grid.y)
  col_positions = _find_peaks(v_proj, grid.x)

  # Filter to evenly-spaced lines (removes noise peaks)
  row_positions = _filter_even_spacing(row_positions)
  col_positions = _filter_even_spacing(col_positions)

  return row_positions, col_positions


def _filter_even_spacing(
  positions: list[int],
) -> list[int]:
  """Filter line positions to keep evenly-spaced ones.

  Computes the median spacing between adjacent positions,
  then keeps only positions that are consistent with that
  spacing (within 50% tolerance).

  Args:
    positions: Sorted list of line positions.

  Returns:
    Filtered list of evenly-spaced positions.
  """
  if len(positions) < 4:
    return positions

  # Compute gaps between adjacent positions
  gaps = [positions[i + 1] - positions[i] for i in range(len(positions) - 1)]
  median_gap = float(np.median(gaps))

  if median_gap < 1:
    return positions

  # Keep positions whose gaps to neighbors are close
  # to the median
  tolerance = median_gap * 0.5
  filtered = [positions[0]]
  for i in range(1, len(positions)):
    gap = positions[i] - filtered[-1]
    # Accept if gap is close to median or a multiple
    remainder = gap % median_gap
    near_multiple = (
      remainder < tolerance or (median_gap - remainder) < tolerance
    )
    if near_multiple and gap > median_gap * 0.5:
      filtered.append(positions[i])

  return filtered


def _find_peaks(
  projection: NDArray,
  offset: int,
) -> list[int]:
  """Find peak positions in a 1D projection signal.

  Peaks correspond to grid line positions. Uses thresholding
  and run-center detection.

  Args:
    projection: 1D array of projected pixel sums.
    offset: Pixel offset to add (grid x or y coordinate).

  Returns:
    List of peak positions in image coordinates.
  """
  if len(projection) == 0:
    return []

  max_val = np.max(projection)
  if max_val == 0:
    return []

  threshold = max_val * 0.3
  above = projection > threshold

  # Find runs of above-threshold values and take centers
  peaks: list[int] = []
  in_run = False
  run_start = 0
  for i, val in enumerate(above):
    if val and not in_run:
      run_start = i
      in_run = True
    elif not val and in_run:
      center = (run_start + i) // 2
      peaks.append(center + offset)
      in_run = False
  if in_run:
    center = (run_start + len(above)) // 2
    peaks.append(center + offset)

  return peaks


def classify_cells(
  binary: NDArray,
  row_positions: list[int],
  col_positions: list[int],
) -> list[list[bool]]:
  """Classify each cell as filled or empty.

  Uses dark pixel ratio with adaptive per-grid thresholding.

  Args:
    binary: Binary image (foreground=255).
    row_positions: Y-coordinates of horizontal grid lines.
    col_positions: X-coordinates of vertical grid lines.

  Returns:
    2D list of booleans [row][col], True = filled.
  """
  n_rows = len(row_positions) - 1
  n_cols = len(col_positions) - 1

  if n_rows <= 0 or n_cols <= 0:
    return []

  # Compute dark pixel ratio for every cell
  ratios: list[list[float]] = []
  inset = 4  # pixels to inset from grid lines
  for r in range(n_rows):
    row_ratios: list[float] = []
    y1 = row_positions[r] + inset
    y2 = row_positions[r + 1] - inset
    for c in range(n_cols):
      x1 = col_positions[c] + inset
      x2 = col_positions[c + 1] - inset
      if y2 <= y1 or x2 <= x1:
        row_ratios.append(0.0)
        continue
      cell = binary[y1:y2, x1:x2]
      total = cell.size
      dark = cv2.countNonZero(cell)
      ratio = dark / total if total > 0 else 0.0
      row_ratios.append(ratio)
    ratios.append(row_ratios)

  # Adaptive threshold via largest-gap clustering
  all_ratios = sorted(r for row in ratios for r in row)
  threshold = _adaptive_threshold(all_ratios)

  # Classify
  result: list[list[bool]] = []
  for row in ratios:
    result.append([r > threshold for r in row])
  return result


def _adaptive_threshold(
  sorted_ratios: list[float],
) -> float:
  """Find adaptive fill threshold via largest-gap method.

  Sorts all dark-pixel ratios and finds the largest gap
  between adjacent values. The threshold is the midpoint
  of that gap.

  Args:
    sorted_ratios: Sorted list of dark pixel ratios.

  Returns:
    Threshold value for filled/empty classification.
  """
  if len(sorted_ratios) < 2:
    return 0.15

  # If max ratio is very low, everything is empty
  if sorted_ratios[-1] < 0.08:
    return 0.15

  max_gap = 0.0
  gap_mid = 0.15
  for i in range(len(sorted_ratios) - 1):
    gap = sorted_ratios[i + 1] - sorted_ratios[i]
    if gap > max_gap:
      max_gap = gap
      gap_mid = (sorted_ratios[i] + sorted_ratios[i + 1]) / 2

  # If gap is too small, use a reasonable default
  if max_gap < 0.05:
    return 0.15

  return gap_mid


def extract_pattern_name(
  gray: NDArray,
  grid: GridRegion,
  prev_valid_grid: GridRegion | None,
  page_num: int,
  pattern_idx: int,
) -> str:
  """Extract pattern name via OCR.

  The name appears in the region between the previous
  pattern grid (or page top) and the current grid. This
  region contains the pattern name and musical notation.
  We OCR the left portion where the name is printed.

  Args:
    gray: Grayscale image.
    grid: Current grid bounding box.
    prev_valid_grid: Previous valid (12-row) grid, or None.
    page_num: Page number for fallback name.
    pattern_idx: Pattern index (1-based) for fallback.

  Returns:
    Extracted or fallback pattern name.
  """
  img_h, img_w = gray.shape

  # Scan between previous pattern grid bottom and
  # current grid top
  name_top = prev_valid_grid.y + prev_valid_grid.h if prev_valid_grid else 0
  name_bottom = grid.y
  left = 0
  right = min(img_w, grid.x + grid.w // 2)

  if name_bottom - name_top < 10 or right - left < 10:
    return f"Page {page_num} Pattern {pattern_idx}"

  roi = gray[name_top:name_bottom, left:right]

  # Threshold to clean up for OCR
  _, roi_bin = cv2.threshold(
    roi,
    0,
    255,
    cv2.THRESH_BINARY + cv2.THRESH_OTSU,
  )

  try:
    # PSM 6: assume a uniform block of text
    text = pytesseract.image_to_string(roi_bin, config="--psm 6").strip()
  except pytesseract.TesseractError:
    text = ""

  # Find the best line with a pattern-name-like structure
  # Names look like "Afro-cub: 1", "Rock: 3"
  lines = text.split("\n")
  best_line = ""
  best_score = 0
  for line in lines:
    line = line.strip()
    line = re.sub(r"[|{}\[\]\\=+_><]", "", line)
    line = line.strip()
    if not line:
      continue
    alpha = sum(1 for c in line if c.isalpha())
    digit = sum(1 for c in line if c.isdigit())
    # Prefer lines with both alpha and digits (like names)
    score = alpha + digit * 2
    if score > best_score:
      best_score = score
      best_line = line

  if best_score < 3:
    return f"Page {page_num} Pattern {pattern_idx}"

  best_line = re.sub(r"\s+", " ", best_line).strip()

  # Fix common OCR substitutions
  best_line = re.sub(r"(?i)\bAftro\b", "Afro", best_line)
  best_line = re.sub(r"(?i)\bCub\.\b", "Cub:", best_line)

  return best_line


def assemble_pattern(
  name: str,
  cells: list[list[bool]],
  col_count: int,
) -> dict[str, Any] | None:
  """Map classified cells to instrument pattern dict.

  Args:
    name: Pattern name.
    cells: 2D boolean grid [row][col].
    col_count: Number of columns (grid width).

  Returns:
    Pattern dict with name, grid_width, steps, or None
    if row count is not approximately 12.
  """
  n_rows = len(cells)
  if n_rows < 10 or n_rows > 16:
    logger.warning(
      "Skipping '%s': expected ~12 rows, got %d",
      name,
      n_rows,
    )
    return None

  if n_rows != 12:
    logger.warning(
      "Adjusting '%s': expected 12 rows, got %d",
      name,
      n_rows,
    )
    if n_rows > 12:
      cells = cells[:12]
    else:
      for _ in range(12 - n_rows):
        cells.append([False] * col_count)
    n_rows = 12

  steps: dict[str, str] = {}
  for row_idx, instrument in enumerate(INSTRUMENT_ORDER):
    row = cells[row_idx] if row_idx < len(cells) else []
    bits = "".join("1" if c else "0" for c in row)
    # Pad or truncate to col_count
    bits = bits[:col_count].ljust(col_count, "0")
    steps[instrument] = bits

  return {
    "name": name,
    "grid_width": col_count,
    "steps": steps,
  }


def draw_debug_image(
  gray: NDArray,
  grids: list[GridRegion],
  patterns: list[dict[str, Any]],
  row_data: list[tuple[list[int], list[int]]],
) -> NDArray:
  """Draw side-by-side debug comparison image.

  Left side: original page image.
  Right side: reconstructed grid visualization.

  Args:
    gray: Original grayscale image.
    grids: Detected grid regions.
    patterns: Assembled pattern dicts.
    row_data: List of (row_positions, col_positions) per
      grid.

  Returns:
    BGR color image with side-by-side layout.
  """
  h, w = gray.shape
  canvas_w = w * 2
  canvas = np.full((h, canvas_w, 3), 240, dtype=np.uint8)

  # Left side: original image
  gray_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
  canvas[:, :w] = gray_bgr

  # Draw separator line
  cv2.line(canvas, (w, 0), (w, h), (100, 100, 100), 2)

  # Right side: reconstructed grids
  cell_w = 20
  cell_h = 16
  label_w = 40
  header_h = 16

  for grid_idx, (grid, pattern) in enumerate(zip(grids, patterns)):
    if pattern is None:
      continue

    steps = pattern["steps"]
    col_count = pattern["grid_width"]
    name = pattern["name"]

    # Position the reconstructed grid aligned with the
    # original grid's vertical position
    base_x = w + 20
    base_y = grid.y + 10

    # Draw pattern name
    cv2.putText(
      canvas,
      name,
      (base_x, base_y - 5),
      cv2.FONT_HERSHEY_SIMPLEX,
      0.5,
      (0, 0, 0),
      1,
    )

    # Draw column headers
    for c in range(col_count):
      cx = base_x + label_w + c * cell_w + cell_w // 2
      cv2.putText(
        canvas,
        str(c + 1),
        (cx - 4, base_y + header_h - 2),
        cv2.FONT_HERSHEY_PLAIN,
        0.6,
        (120, 120, 120),
        1,
      )

    # Draw cells
    for r_idx, instrument in enumerate(INSTRUMENT_ORDER):
      row_y = base_y + header_h + r_idx * cell_h

      # Instrument label
      cv2.putText(
        canvas,
        instrument,
        (base_x, row_y + cell_h - 3),
        cv2.FONT_HERSHEY_PLAIN,
        0.7,
        (80, 80, 80),
        1,
      )

      step_str = steps.get(instrument, "0" * col_count)
      for c_idx in range(col_count):
        cx = base_x + label_w + c_idx * cell_w
        cy = row_y
        filled = c_idx < len(step_str) and step_str[c_idx] == "1"
        color = (200, 120, 50) if filled else (220, 220, 220)
        cv2.rectangle(
          canvas,
          (cx, cy),
          (cx + cell_w - 1, cy + cell_h - 1),
          color,
          -1,
        )
        cv2.rectangle(
          canvas,
          (cx, cy),
          (cx + cell_w - 1, cy + cell_h - 1),
          (150, 150, 150),
          1,
        )

  return canvas


def process_page(
  page_num: int,
  debug: bool,
) -> dict[str, Any]:
  """Process a single page image through the CV pipeline.

  Args:
    page_num: Page number to process.
    debug: Whether to save debug images.

  Returns:
    Page result dict with 'page' and 'patterns' keys.
  """
  image_path = IMAGES_DIR / f"page_{page_num:03d}.png"
  if not image_path.exists():
    logger.warning("Page %d: no image at %s", page_num, image_path)
    return {"page": page_num, "patterns": []}

  gray, binary = preprocess_image(image_path)
  grids = detect_grids(binary)

  if not grids:
    logger.info("Page %d: no grids detected", page_num)
    if debug:
      _save_debug_no_grids(gray, page_num)
    return {"page": page_num, "patterns": []}

  patterns: list[dict[str, Any]] = []
  row_col_data: list[tuple[list[int], list[int]]] = []
  valid_pattern_idx = 0
  prev_valid_grid: GridRegion | None = None

  for grid_idx, grid in enumerate(grids):
    row_positions, col_positions = find_cell_boundaries(binary, grid)

    n_rows = len(row_positions) - 1
    n_cols = len(col_positions) - 1

    if n_rows < 1 or n_cols < 1:
      logger.warning(
        "Page %d grid %d: could not find cell boundaries (rows=%d, cols=%d)",
        page_num,
        grid_idx + 1,
        n_rows,
        n_cols,
      )
      continue

    cells = classify_cells(binary, row_positions, col_positions)

    pattern = assemble_pattern("", cells, n_cols)
    if pattern is None:
      # Not a 12-row grid (likely music notation)
      continue

    valid_pattern_idx += 1

    name = extract_pattern_name(
      gray,
      grid,
      prev_valid_grid,
      page_num,
      valid_pattern_idx,
    )
    pattern["name"] = name

    patterns.append(pattern)
    row_col_data.append((row_positions, col_positions))
    prev_valid_grid = grid

  if debug:
    # For debug drawing, we need the grid regions that
    # correspond to valid patterns. Rebuild this list.
    valid_grids: list[GridRegion] = []
    vi = 0
    for grid_idx, grid in enumerate(grids):
      rp, cp = find_cell_boundaries(binary, grid)
      n_rows = len(rp) - 1
      if n_rows == 12 and vi < len(patterns):
        valid_grids.append(grid)
        vi += 1

    debug_img = draw_debug_image(
      gray,
      valid_grids,
      patterns,
      row_col_data,
    )
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    debug_path = DEBUG_DIR / f"page_{page_num:03d}.png"
    cv2.imwrite(str(debug_path), debug_img)
    logger.info("Page %d: debug image saved", page_num)

  return {"page": page_num, "patterns": patterns}


def _save_debug_no_grids(
  gray: NDArray,
  page_num: int,
) -> None:
  """Save debug image for a page with no detected grids.

  Args:
    gray: Grayscale image.
    page_num: Page number.
  """
  DEBUG_DIR.mkdir(parents=True, exist_ok=True)
  h, w = gray.shape
  canvas = np.full((h, w * 2, 3), 240, dtype=np.uint8)
  gray_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
  canvas[:, :w] = gray_bgr
  cv2.line(canvas, (w, 0), (w, h), (100, 100, 100), 2)
  cv2.putText(
    canvas,
    "No grids detected",
    (w + 20, h // 2),
    cv2.FONT_HERSHEY_SIMPLEX,
    1.0,
    (0, 0, 200),
    2,
  )
  debug_path = DEBUG_DIR / f"page_{page_num:03d}.png"
  cv2.imwrite(str(debug_path), canvas)


def main() -> None:
  """Entry point."""
  logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
  )

  parser = argparse.ArgumentParser(
    description="Extract drum patterns from page images using OpenCV"
  )
  parser.add_argument(
    "--pages",
    help="Page range, e.g. '9-13' or '15'",
  )
  parser.add_argument(
    "--merge",
    action="store_true",
    help="Merge parsed results into patterns.json",
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="With --merge, show changes without writing",
  )
  parser.add_argument(
    "--debug",
    action="store_true",
    help="Save side-by-side debug images",
  )
  parser.add_argument(
    "--gemini-names",
    action="store_true",
    help="Use Gemini to extract pattern names (requires GEMINI_API_KEY)",
  )
  parser.add_argument(
    "--force-names",
    action="store_true",
    help="Re-fetch Gemini names even if cached",
  )

  args = parser.parse_args()

  if args.merge:
    do_merge(args.dry_run)
    return

  # Set up Gemini client if needed
  gemini_client = None
  if args.gemini_names:
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
      logger.error("GEMINI_API_KEY environment variable not set")
      sys.exit(1)
    gemini_client = genai.Client(api_key=api_key)

  start, end = parse_page_range(args.pages)
  CV_DIR.mkdir(parents=True, exist_ok=True)

  total_patterns = 0
  for page_num in range(start, end + 1):
    result = process_page(page_num, args.debug)

    # Override names with Gemini if requested
    if gemini_client and result["patterns"]:
      gemini_names = get_names_for_page(
        gemini_client, page_num, args.force_names
      )
      # Match by position — both are top-to-bottom ordered
      for i, pat in enumerate(result["patterns"]):
        if i < len(gemini_names):
          pat["name"] = gemini_names[i]

    n_patterns = len(result["patterns"])
    total_patterns += n_patterns

    # Save per-page JSON
    out_path = CV_DIR / f"page_{page_num:03d}.json"
    out_path.write_text(json.dumps(result, indent=2) + "\n")

    if n_patterns > 0:
      names = [p["name"] for p in result["patterns"]]
      widths = [p["grid_width"] for p in result["patterns"]]
      print(
        f"Page {page_num}: {n_patterns} patterns "
        f"{names} (cols: {widths})"
      )
    else:
      print(f"Page {page_num}: no patterns")

  print(f"\nDone. {total_patterns} total patterns.")


if __name__ == "__main__":
  main()
