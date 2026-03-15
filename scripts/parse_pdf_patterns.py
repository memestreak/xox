#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "jinja2", "pydantic"]
# ///
"""Extract drum patterns from PDF using Gemini Vision API.

Subcommands:
  extract  Render PDF pages to PNG images
  parse    Send images to Gemini for cell-by-cell extraction
  verify   Generate HTML report for human review
  merge    Merge verified patterns into patterns.json

Usage:
  uv run scripts/parse_pdf_patterns.py extract --pages 9-13
  uv run scripts/parse_pdf_patterns.py parse --pages 9-13
  uv run scripts/parse_pdf_patterns.py verify --pages 9-13
  uv run scripts/parse_pdf_patterns.py merge --dry-run

Requires:
  GEMINI_API_KEY environment variable
  pdftoppm (poppler-utils: apt install poppler-utils)
"""

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
  from google import genai

logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = SCRIPT_DIR / "parsed_patterns"
IMAGES_DIR = OUTPUT_DIR / "images"
PASSES_DIR = OUTPUT_DIR / "passes"
CONSENSUS_DIR = OUTPUT_DIR / "consensus"
PATTERNS_JSON = (
  PROJECT_ROOT / "src" / "app" / "data" / "patterns.json"
)

DEFAULT_PDF = PROJECT_ROOT / "260_drum_machine_patterns_1987.pdf"
DEFAULT_PAGE_START = 9
DEFAULT_PAGE_END = 97
DEFAULT_PASSES = 3
MODEL = "gemini-3.1-pro-preview"

ALL_TRACK_IDS = [
  "ac", "bd", "sd", "ch", "oh", "cy",
  "ht", "mt", "lt", "rs", "cp", "cb",
]

INSTRUMENT_MAP = {
  "AC": "ac", "CY": "cy", "CH": "ch", "OH": "oh",
  "HT": "ht", "MT": "mt", "SD": "sd", "RS": "rs",
  "LT": "lt", "CPS": "cp", "CB": "cb", "BD": "bd",
}

INSTRUMENT_ORDER = [
  "AC", "CY", "CH", "OH", "HT", "MT",
  "SD", "RS", "LT", "CPS", "CB", "BD",
]


class Cell(BaseModel):
  """A single cell in the pattern grid."""

  column: int = Field(description="Column number, 1-indexed")
  filled: bool = Field(
    description="True if the cell is filled (black/hit)"
  )


class InstrumentRow(BaseModel):
  """One instrument's row of cells in a grid."""

  instrument: str = Field(
    description=(
      "Instrument abbreviation: AC, CY, CH, OH, HT, "
      "MT, SD, RS, LT, CPS, CB, or BD"
    )
  )
  cells: list[Cell] = Field(
    description="Cells from left to right, one per column"
  )


class PatternGrid(BaseModel):
  """A single pattern grid extracted from the page."""

  name: str = Field(
    description="Pattern name as printed, e.g. 'Rock: 3'"
  )
  grid_width: int = Field(
    description="Number of columns (16 or 12)"
  )
  rows: list[InstrumentRow] = Field(
    description="Instrument rows from top to bottom"
  )


class PageResponse(BaseModel):
  """All pattern grids found on one page."""

  patterns: list[PatternGrid] = Field(
    description="Pattern grids found on this page"
  )


EXTRACTION_PROMPT = """\
Analyze this drum machine pattern page. It may contain zero
or more drum pattern grids and musical notation. Ignore the
musical notation entirely — only extract the grid patterns.

For each grid pattern found:

1. Read the pattern name exactly as printed above the grid
   (e.g. "Afro-cub: 1", "Rock: 3", "Break: 2").

2. Count the grid columns. There will be either 16 or 12.
   The numbers printed above the grid (1, 3, 5, ...) mark
   the odd-numbered columns.

3. The instrument rows from top to bottom are ALWAYS:
   AC, CY, CH, OH, HT, MT, SD, RS, LT, CPS, CB, BD

4. For EVERY instrument row, examine EVERY cell from column
   1 to column grid_width individually:
   - Black/filled box -> filled: true
   - White/empty box -> filled: false
   - "F" marking (flam) -> filled: true

5. Rows that do NOT have an arrow next to them should have
   ALL cells set to filled: false.

ROW-SPECIFIC GUIDANCE:
- AC (accent, top row): This row uses a DIFFERENT visual
  marker than other rows — triangles, carets, or small
  marks instead of filled boxes. Most patterns have SPARSE
  and IRREGULAR accents. Do NOT assume AC follows any
  repeating pattern. Carefully distinguish the accent
  markers from empty cells.
- BD (bass drum, bottom row) and CB (cowbell, second from
  bottom): These rows are near the grid edge. Verify each
  cell individually — do not let proximity to the border
  cause misreads. Make sure you are reading the correct
  row and not confusing BD with CB.
- Columns 1-4 (leftmost): These are adjacent to the
  instrument labels. Column 1 is the FIRST grid cell to
  the right of the label. Do not confuse the label area
  with grid cells.

CRITICAL RULES — read carefully:
- Examine each cell INDEPENDENTLY. Never assume a pattern.
- Adjacent cells CAN both be filled. Do not merge them.
- Count every column for every row. Do not skip any.

VERIFICATION — do this for every row:
- Count the filled cells you recorded for the row.
- Visually re-count the black boxes in that row of the
  image.
- If the counts do not match, re-examine cell by cell.
- SANITY CHECK: Most rows have 0-8 fills out of 16. If
  you are marking more than 10 cells filled in a single
  row, double-check — rows more than 50% filled are rare.

WRONG: Seeing fills at columns 1,3,5 and assuming the rest
  follows an alternating pattern.
RIGHT: Check column 2 independently. Check column 4
  independently. Each cell is its own decision.

If the page has no pattern grids (just text or notation),
return an empty patterns list.
"""

REPORT_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pattern Extraction Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: monospace; background: #1a1a1a;
         color: #eee; padding: 20px; }
  h1 { margin-bottom: 20px; }
  .page { display: flex; gap: 20px; margin-bottom: 40px;
          border-bottom: 2px solid #444;
          padding-bottom: 20px; }
  .page-image { flex: 0 0 auto; position: sticky;
               top: 20px; align-self: flex-start; }
  .page-image img { max-height: 800px;
                    border: 1px solid #444; }
  .page-patterns { flex: 1; }
  .pattern { margin-bottom: 20px; }
  .pattern h3 { margin-bottom: 8px; color: #8cf; }
  .stats { color: #aaa; font-size: 12px;
           margin-bottom: 4px; }
  table { border-collapse: collapse; }
  td { width: 24px; height: 20px; border: 1px solid #555;
       text-align: center; font-size: 10px; }
  td.filled { background: #4a9eff; }
  td.empty { background: #2a2a2a; }
  td.flagged { background: #ff4; color: #000; }
  .col-header { background: #333; color: #aaa;
                font-size: 9px; }
  .inst-label { background: #333; color: #ccc;
                width: 40px; text-align: right;
                padding-right: 4px; }
  .summary { background: #222; padding: 12px;
             margin: 20px 0; border-radius: 4px; }
  .flagged-warning { color: #ff4; }
  .ground-truth { margin-top: 10px; }
  .gt-match { color: #4f4; }
  .gt-mismatch { color: #f44; }
</style>
</head>
<body>
<h1>Pattern Extraction Report</h1>
<div class="summary">
  Pages: {{ pages|length }} |
  Patterns: {{ total_patterns }} |
  Flagged cells:
  <span class="{% if total_flagged > 0 %}flagged-warning{% endif %}">
    {{ total_flagged }}</span>
  {% if ground_truth_results %}
  | Ground truth:
  {% for gt in ground_truth_results %}
    <span class="{{ 'gt-match' if gt.match else 'gt-mismatch' }}">
      {{ gt.id }}
      ({{ 'OK' if gt.match else gt.diff_count ~ ' diffs' }})
    </span>
  {% endfor %}
  {% endif %}
</div>

{% for page in pages %}
<div class="page" id="page-{{ page.number }}">
  <div class="page-image">
    <h2>Page {{ page.number }}</h2>
    {% if page.image_path %}
    <img src="{{ page.image_path }}"
         alt="Page {{ page.number }}">
    {% else %}
    <p>No image</p>
    {% endif %}
  </div>
  <div class="page-patterns">
    {% if not page.patterns %}
    <p>No patterns on this page.</p>
    {% endif %}
    {% for pattern in page.patterns %}
    <div class="pattern">
      <h3>{{ pattern.name }}
        {% if pattern.grid_width != 16 %}
          ({{ pattern.grid_width }} steps)
        {% endif %}
      </h3>
      <div class="stats">
        Flagged: {{ pattern.flagged_count }}
      </div>
      <table>
        <tr>
          <td class="inst-label"></td>
          {% for col in range(1, pattern.grid_width + 1) %}
          <td class="col-header">{{ col }}</td>
          {% endfor %}
        </tr>
        {% for inst in instrument_order %}
        <tr>
          <td class="inst-label">{{ inst }}</td>
          {% for c in pattern.steps[inst] %}
          <td class="{{ 'filled' if c == '1' else 'empty' }}">
            {{ c }}
          </td>
          {% endfor %}
        </tr>
        {% endfor %}
      </table>
    </div>
    {% endfor %}
  </div>
</div>
{% endfor %}
</body>
</html>
"""


def send_to_gemini(
  client: "genai.Client",
  image_path: Path,
  model: str,
) -> list[PatternGrid]:
  """Send a page image to Gemini and get structured output.

  Args:
    client: Gemini API client.
    image_path: Path to the PNG image.
    model: Gemini model name.

  Returns:
    List of PatternGrid objects extracted from the page.
  """
  from google.genai import types

  image_data = image_path.read_bytes()
  image_part = types.Part.from_bytes(
    data=image_data, mime_type="image/png"
  )

  response = client.models.generate_content(
    model=model,
    contents=[image_part, EXTRACTION_PROMPT],
    config=types.GenerateContentConfig(
      response_mime_type="application/json",
      response_schema=PageResponse,
      thinking_config=types.ThinkingConfig(
        thinking_level="high",
      ),
      media_resolution="MEDIA_RESOLUTION_HIGH",
    ),
  )

  return response.parsed.patterns


def grid_to_steps_dict(grid: PatternGrid) -> dict[str, str]:
  """Convert a PatternGrid to instrument->binary-string dict.

  Args:
    grid: A PatternGrid from Gemini structured output.

  Returns:
    Dict mapping instrument name to binary string.
  """
  steps: dict[str, str] = {}
  for row in grid.rows:
    instrument = row.instrument.upper()
    if (
      instrument in INSTRUMENT_MAP
      or instrument in INSTRUMENT_ORDER
    ):
      steps[instrument] = cells_to_binary_string(row.cells)
  for inst in INSTRUMENT_ORDER:
    if inst not in steps:
      steps[inst] = "0" * grid.grid_width
  return steps


def cells_to_binary_string(cells: list[Cell]) -> str:
  """Convert a list of Cell objects to a binary string.

  Args:
    cells: List of Cell objects sorted by column.

  Returns:
    String of '0' and '1' characters.
  """
  sorted_cells = sorted(cells, key=lambda c: c.column)
  return "".join("1" if c.filled else "0" for c in sorted_cells)


def compute_consensus(
  passes: list[dict[str, str]],
  grid_width: int,
) -> tuple[dict[str, str], int]:
  """Compute majority-vote consensus across passes.

  Args:
    passes: List of dicts mapping instrument name to
      binary string, one dict per pass.
    grid_width: Expected length of each binary string.

  Returns:
    Tuple of (consensus dict, number of flagged cells).
    Consensus dict maps instrument name to binary string.
  """
  consensus: dict[str, str] = {}
  flagged = 0
  for instrument in INSTRUMENT_ORDER:
    chars = []
    for col in range(grid_width):
      votes = sum(
        1
        for p in passes
        if col < len(p.get(instrument, ""))
        and p[instrument][col] == "1"
      )
      majority = votes > len(passes) / 2
      chars.append("1" if majority else "0")
      if votes != 0 and votes != len(passes):
        flagged += 1
    consensus[instrument] = "".join(chars)
  return consensus, flagged


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
  raise ValueError(
    f"Invalid page range: '{pages_str}'. "
    f"Use 'N' or 'N-M'."
  )


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


def normalize_pattern(raw: dict) -> dict | None:
  """Normalize a raw parsed pattern into app format.

  Converts instrument names to lowercase track IDs, validates
  step strings, and generates ID and display name.

  Args:
    raw: Dict with 'name', 'grid_width', and 'steps' keys.
      Steps maps PDF instrument names (e.g. 'BD') to binary
      strings.

  Returns:
    Normalized pattern dict with 'id', 'name', and 'steps'
    keys, or None if the pattern should be skipped.
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
    if (
      len(step_str) != 16
      or not all(c in "01" for c in step_str)
    ):
      logger.warning(
        "Invalid step string for %s in '%s': '%s'",
        pdf_key, name, step_str,
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


def render_page_to_disk(
  pdf_path: Path,
  page_num: int,
  output_path: Path,
) -> None:
  """Render a single PDF page to PNG on disk.

  Args:
    pdf_path: Path to the PDF file.
    page_num: PDF page number to render.
    output_path: Where to write the PNG file.
  """
  with tempfile.TemporaryDirectory() as tmpdir:
    prefix = os.path.join(tmpdir, "page")
    subprocess.run(
      [
        "pdftoppm", "-png",
        "-f", str(page_num),
        "-l", str(page_num),
        "-r", "300",
        str(pdf_path), prefix,
      ],
      check=True,
      capture_output=True,
    )
    pngs = list(Path(tmpdir).glob("*.png"))
    if not pngs:
      raise RuntimeError(
        f"pdftoppm produced no output for page {page_num}"
      )
    shutil.move(str(pngs[0]), str(output_path))


def do_extract(args: argparse.Namespace) -> None:
  """Render PDF pages to PNG images."""
  pdf_path = Path(args.pdf).expanduser()
  if not pdf_path.exists():
    logger.error("PDF not found: %s", pdf_path)
    sys.exit(1)

  start, end = parse_page_range(args.pages)
  IMAGES_DIR.mkdir(parents=True, exist_ok=True)

  for page_num in range(start, end + 1):
    output_path = IMAGES_DIR / f"page_{page_num:03d}.png"
    if output_path.exists():
      print(f"Page {page_num}: image exists, skipping")
      continue
    print(f"Page {page_num}: rendering...")
    render_page_to_disk(pdf_path, page_num, output_path)

  print(f"Done. Images in {IMAGES_DIR}")


def do_parse(args: argparse.Namespace) -> None:
  """Send images to Gemini for pattern extraction."""
  from google import genai

  start, end = parse_page_range(args.pages)
  num_passes = args.passes
  model = args.model

  api_key = os.environ.get("GEMINI_API_KEY")
  if not api_key:
    logger.error("GEMINI_API_KEY environment variable not set")
    sys.exit(1)

  client = genai.Client(api_key=api_key)

  PASSES_DIR.mkdir(parents=True, exist_ok=True)
  CONSENSUS_DIR.mkdir(parents=True, exist_ok=True)

  for page_num in range(start, end + 1):
    image_path = IMAGES_DIR / f"page_{page_num:03d}.png"
    if not image_path.exists():
      print(f"Page {page_num}: no image, run extract first")
      continue

    consensus_path = (
      CONSENSUS_DIR / f"page_{page_num:03d}.json"
    )
    if consensus_path.exists() and not args.force:
      print(f"Page {page_num}: consensus exists, skipping")
      continue

    # Run multiple passes
    all_pass_grids: list[list[PatternGrid]] = []
    for pass_idx in range(1, num_passes + 1):
      pass_path = (
        PASSES_DIR
        / f"page_{page_num:03d}_pass{pass_idx}.json"
      )

      if pass_path.exists() and not args.force:
        print(
          f"Page {page_num} pass {pass_idx}: "
          f"exists, loading"
        )
        raw = json.loads(pass_path.read_text())
        grids = [PatternGrid(**g) for g in raw]
      else:
        print(
          f"Page {page_num} pass {pass_idx}: "
          f"sending to Gemini..."
        )
        try:
          grids = send_to_gemini(client, image_path, model)
        except Exception as e:
          logger.error(
            "Page %d pass %d: ERROR - %s",
            page_num, pass_idx, e,
          )
          grids = []

        # Save raw pass result
        pass_path.write_text(
          json.dumps(
            [g.model_dump() for g in grids], indent=2
          )
          + "\n"
        )
        time.sleep(1)  # Rate limiting

      all_pass_grids.append(grids)

    # Build consensus
    if not all_pass_grids or not all_pass_grids[0]:
      print(f"Page {page_num}: no patterns found")
      consensus_path.write_text(
        json.dumps({"page": page_num, "patterns": []})
        + "\n"
      )
      continue

    # Use first pass as reference for pattern count/names
    reference = all_pass_grids[0]
    consensus_patterns = []
    total_flagged = 0

    for pat_idx, ref_grid in enumerate(reference):
      # Collect this pattern's steps from each pass
      pass_steps: list[dict[str, str]] = []
      for pass_grids in all_pass_grids:
        if pat_idx < len(pass_grids):
          pass_steps.append(
            grid_to_steps_dict(pass_grids[pat_idx])
          )

      if not pass_steps:
        continue

      consensus_steps, flagged = compute_consensus(
        pass_steps, ref_grid.grid_width
      )
      total_flagged += flagged

      consensus_patterns.append({
        "name": ref_grid.name,
        "grid_width": ref_grid.grid_width,
        "steps": consensus_steps,
        "flagged_count": flagged,
      })

    # Save consensus
    consensus_data = {
      "page": page_num,
      "patterns": consensus_patterns,
      "total_flagged": total_flagged,
    }
    consensus_path.write_text(
      json.dumps(consensus_data, indent=2) + "\n"
    )

    names = [p["name"] for p in consensus_patterns]
    flag_msg = (
      f" ({total_flagged} flagged cells)"
      if total_flagged
      else ""
    )
    print(
      f"Page {page_num}: {len(consensus_patterns)} "
      f"patterns{flag_msg} {names}"
    )

  print("Done.")


def do_verify(args: argparse.Namespace) -> None:
  """Generate HTML verification report."""
  from jinja2 import Template

  start, end = parse_page_range(args.pages)

  ground_truth: dict[str, dict] = {}
  if PATTERNS_JSON.exists():
    data = json.loads(PATTERNS_JSON.read_text())
    for p in data["patterns"]:
      ground_truth[p["id"]] = p

  pages_data = []
  total_patterns = 0
  total_flagged = 0
  ground_truth_results = []

  for page_num in range(start, end + 1):
    consensus_path = (
      CONSENSUS_DIR / f"page_{page_num:03d}.json"
    )
    image_path = IMAGES_DIR / f"page_{page_num:03d}.png"

    if not consensus_path.exists():
      continue

    data = json.loads(consensus_path.read_text())
    patterns = data.get("patterns", [])
    total_patterns += len(patterns)
    total_flagged += data.get("total_flagged", 0)

    for pat in patterns:
      normalized = normalize_pattern(pat)
      if normalized and normalized["id"] in ground_truth:
        gt = ground_truth[normalized["id"]]
        diff_count = 0
        for tid in ALL_TRACK_IDS:
          gt_steps = gt["steps"].get(tid, "0" * 16)
          parsed_steps = normalized["steps"].get(
            tid, "0" * 16
          )
          for a, b in zip(gt_steps, parsed_steps):
            if a != b:
              diff_count += 1
        ground_truth_results.append({
          "id": normalized["id"],
          "match": diff_count == 0,
          "diff_count": diff_count,
        })

    rel_image = (
      str(image_path.relative_to(OUTPUT_DIR))
      if image_path.exists()
      else None
    )

    pages_data.append({
      "number": page_num,
      "image_path": rel_image,
      "patterns": patterns,
    })

  template = Template(REPORT_TEMPLATE)
  html = template.render(
    pages=pages_data,
    total_patterns=total_patterns,
    total_flagged=total_flagged,
    ground_truth_results=ground_truth_results,
    instrument_order=INSTRUMENT_ORDER,
  )

  report_path = OUTPUT_DIR / "report.html"
  report_path.write_text(html)
  print(f"Report written to {report_path}")
  print(
    f"  {total_patterns} patterns, "
    f"{total_flagged} flagged cells"
  )
  if ground_truth_results:
    matches = sum(
      1 for g in ground_truth_results if g["match"]
    )
    print(
      f"  Ground truth: {matches}/"
      f"{len(ground_truth_results)} match"
    )


def do_merge(args: argparse.Namespace) -> None:
  """Merge consensus patterns into patterns.json."""
  if not CONSENSUS_DIR.exists():
    logger.error(
      "No consensus directory. Run parse first."
    )
    sys.exit(1)

  consensus_files = sorted(
    CONSENSUS_DIR.glob("page_*.json")
  )
  if not consensus_files:
    logger.error("No consensus files. Run parse first.")
    sys.exit(1)

  parsed: dict[str, dict] = {}
  for cf in consensus_files:
    data = json.loads(cf.read_text())
    for raw in data.get("patterns", []):
      normalized = normalize_pattern(raw)
      if normalized:
        parsed[normalized["id"]] = normalized

  print(
    f"Found {len(parsed)} unique patterns "
    f"from {len(consensus_files)} pages"
  )

  existing_data = json.loads(PATTERNS_JSON.read_text())
  existing = {
    p["id"]: p for p in existing_data["patterns"]
  }

  new_ids = set(parsed) - set(existing)
  updated_ids = set(parsed) & set(existing)

  if args.dry_run:
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

  sorted_patterns = sorted(
    merged.values(), key=lambda p: p["id"]
  )
  output = {"patterns": sorted_patterns}
  PATTERNS_JSON.write_text(
    json.dumps(output, indent=2) + "\n"
  )

  print(
    f"Wrote {len(sorted_patterns)} patterns "
    f"to {PATTERNS_JSON}"
  )
  print(f"  Added: {len(new_ids)}")
  print(f"  Updated: {len(updated_ids)}")
  print(
    f"  Kept: {len(existing) - len(updated_ids)}"
  )


def main() -> None:
  """Entry point."""
  logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
  )

  parser = argparse.ArgumentParser(
    description="Extract drum patterns from PDF"
  )
  parser.add_argument(
    "--pdf",
    default=str(DEFAULT_PDF),
    help=f"Path to PDF (default: {DEFAULT_PDF})",
  )
  parser.add_argument(
    "--pages",
    help="Page range, e.g. '9-13' or '15'",
  )
  sub = parser.add_subparsers(dest="command")

  sub.add_parser(
    "extract",
    help="Render PDF pages to PNG images",
  )

  parse_cmd = sub.add_parser(
    "parse",
    help="Send images to Gemini for extraction",
  )
  parse_cmd.add_argument(
    "--passes",
    type=int,
    default=DEFAULT_PASSES,
    help=f"Number of passes (default: {DEFAULT_PASSES})",
  )
  parse_cmd.add_argument(
    "--force",
    action="store_true",
    help="Re-parse pages with existing results",
  )
  parse_cmd.add_argument(
    "--model",
    default=MODEL,
    help=f"Gemini model to use (default: {MODEL})",
  )

  sub.add_parser(
    "verify",
    help="Generate HTML verification report",
  )

  merge_cmd = sub.add_parser(
    "merge",
    help="Merge patterns into patterns.json",
  )
  merge_cmd.add_argument(
    "--dry-run",
    action="store_true",
    help="Show what would change without writing",
  )

  args = parser.parse_args()
  if not args.command:
    parser.print_help()
    sys.exit(1)

  commands = {
    "extract": do_extract,
    "parse": do_parse,
    "verify": do_verify,
    "merge": do_merge,
  }
  commands[args.command](args)


if __name__ == "__main__":
  main()
