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
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pydantic import BaseModel, Field

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
MODEL = "gemini-2.5-pro"

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
  raise NotImplementedError("Task 5")


def do_verify(args: argparse.Namespace) -> None:
  """Generate HTML verification report."""
  raise NotImplementedError("Task 7")


def do_merge(args: argparse.Namespace) -> None:
  """Merge consensus patterns into patterns.json."""
  raise NotImplementedError("Task 6")


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
