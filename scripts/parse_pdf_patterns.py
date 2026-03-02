#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "jinja2"]
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
import re
import sys
from pathlib import Path

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


def do_extract(args: argparse.Namespace) -> None:
  """Render PDF pages to PNG images."""
  raise NotImplementedError("Task 3")


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
