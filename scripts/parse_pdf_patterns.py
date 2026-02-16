#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai"]
# ///
"""Parse drum machine patterns from a PDF using Gemini Vision API.

Usage:
    # Parse all pages (or resume from where you left off)
    python scripts/parse_pdf_patterns.py

    # Parse a specific page range (PDF page numbers)
    python scripts/parse_pdf_patterns.py --pages 9-13

    # Merge all parsed results into patterns.json
    python scripts/parse_pdf_patterns.py --merge

    # Dry-run merge (show what would be added)
    python scripts/parse_pdf_patterns.py --merge --dry-run

Requires:
    uv (https://docs.astral.sh/uv/) — deps are inline, just run the script
    export GEMINI_API_KEY=...
    pdftoppm (from poppler, e.g. `brew install poppler`)
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from pydantic import BaseModel, Field

class InstrumentPattern(BaseModel):
    # Mapping to IDs like 'BD', 'SD', 'CH'
    instrument_id: str = Field(description="The short ID of the instrument")
    # String of 0s and 1s
    hits: str = Field(description="The sequence of hits, e.g., '10001000'")

class DrumPattern(BaseModel):
    name: str = Field(description="The name of the pattern")
    grid_width: int = Field(description="Number of steps in the pattern (usually 16)")
    instruments: list[InstrumentPattern] = Field(description="The patterns for each instrument")

class PatternResponse(BaseModel):
    """Container model to avoid issues with returning top-level lists."""
    patterns: list[DrumPattern]


SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = SCRIPT_DIR / "parsed_patterns"
PATTERNS_JSON = PROJECT_ROOT / "src" / "app" / "data" / "patterns.json"

DEFAULT_PDF = Path.home() / "patterns.pdf"
DEFAULT_PAGE_START = 9
DEFAULT_PAGE_END = 97
MODEL = "gemini-3-pro-preview"

ALL_TRACK_IDS = ["ac", "bd", "sd", "ch", "oh", "cy", "ht", "mt", "lt", "rs", "cp", "cb"]

# Map from PDF instrument labels to our track IDs
INSTRUMENT_MAP = {
    "AC": "ac", "CY": "cy", "CH": "ch", "OH": "oh",
    "HT": "ht", "MT": "mt", "SD": "sd", "RS": "rs",
    "LT": "lt", "CPS": "cp", "CB": "cb", "BD": "bd",
}

EXTRACTION_PROMPT = """\
Analyze this drum machine pattern page and convert each pattern grid into an
accurate JSON representation. The page can contain zero or more drum pattern
grids and musical notation. Ignore the musical notation. We only
care about the grid patterns.

For each grid pattern:
1. Read the pattern name exactly as printed (e.g., "Afro-cub: 1", "Rock: 3", "Break: 2")
2. Count the grid columns: There will be either 16 or 12 columns. The numbers
   above (1, 3, 5...) mark the odd-numbered columns.
3. For each grid row, generate a string encoding of "0"s and "1"s that indicates
   which cells are filled (black=1) or empty (white=0). Evaluate each cell
   individually - do not assume patterns like alternating fills. Adjacent boxes
   can both be filled.

The instrument rows from top to bottom are:
AC, CY, CH, OH, HT, MT, SD, RS, LT, CPS, CB, BD

Rows without arrows should be all zeros. "F" cells (flam) should be treated as "1".

COMMON MISTAKES TO AVOID:
- ⚠️ CRITICAL: Do NOT assume ANY patterns. Each cell must be evaluated independently.
- Do NOT skip a row's cells - count every single column from 1 to grid_width
  independently.
- Multiple consecutive boxes CAN be filled (e.g., 1110 is valid)
- Always verify: count the 1s in your string against the visual black boxes

WRONG: Seeing boxes at 1,3,5,7 → assuming "1010101010..."
RIGHT: Check EVERY single cell: is column 2 filled? is column 4 filled? etc.

Return ONLY a JSON array for each pattern. For example:
[
  {
    "name": "Afro-cub: 1",
    "grid_width": 16,
    "steps": {
      "AC": "0000000000000000",
      "CY": "0000000000000000",
      "CH": "1011101010101010",
      "OH": "0000000000000000",
      "HT": "0000000000000000",
      "MT": "0000000000000000",
      "SD": "0000000000000000",
      "RS": "0001001000001000",
      "LT": "0000000000000000",
      "CPS": "0000000000000000",
      "CB": "0000000000000000",
      "BD": "1000000010100010"
    }
  }
]

Rules:
- Each step string must have exactly `grid_width` characters of only "0" and "1"
- If a page has no pattern grids (just text/notation), return: []
- Be precise — count each box carefully from left to right.
- NEVER extrapolate a pattern
- Treat each cell as independent - the fact that cells 1,3,5 are filled tells
  you NOTHING about cells 7,9,11.

Verification:
- After encoding each row, count your 1s and verify it matches the number of
  black boxes you see.

You've gotten this wrong repeatedly. Please check you results.
"""


def render_page(pdf_path: Path, page_num: int) -> bytes:
    """Render a single PDF page to PNG and return the bytes."""
    with tempfile.TemporaryDirectory() as tmpdir:
        prefix = os.path.join(tmpdir, "page")
        subprocess.run(
            ["pdftoppm", "-png", "-f", str(page_num), "-l", str(page_num),
             "-r", "300", str(pdf_path), prefix],
            check=True, capture_output=True,
        )
        # pdftoppm names output like page-09.png or page-9.png
        pngs = list(Path(tmpdir).glob("*.png"))
        if not pngs:
            raise RuntimeError(f"pdftoppm produced no output for page {page_num}")
        return pngs[0].read_bytes()

def extract_patterns_from_image(client, image_data: bytes) -> list[dict]:
    """Send image to Gemini with valid configuration parameters."""
    from google.genai import types

    image_part = types.Part.from_bytes(data=image_data, mime_type="image/png")

    response = client.models.generate_content(
        model="gemini-3-pro-preview",
        contents=[
            image_part,
            EXTRACTION_PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PatternResponse,
        ),
    )

    # Convert from structured response to dicts for normalize_pattern
    parsed = response.parsed
    patterns = []
    for p in parsed.patterns:
        steps = {inst.instrument_id: inst.hits for inst in p.instruments}
        patterns.append({
            "name": p.name,
            "grid_width": p.grid_width,
            "steps": steps,
        })
    return patterns

# def extract_patterns_from_image(client, image_data: bytes) -> list[dict]:
#     """Send image to Gemini and parse the returned JSON array of patterns."""
#     from google.genai import types

#     response = client.models.generate_content(
#       model=MODEL,
#       contents=[
#             types.Part.from_bytes(data=image_data, mime_type="image/png"),
#             EXTRACTION_PROMPT,
#         ],
#       config=types.GenerateContentConfig(
#         # Increase resolution for better grid parsing
#         media_resolution="high",
#         # Ensure deep reasoning for complex patterns
#         thinking_level="high",
#         response_mime_type="application/json",
#         response_schema=PatternSchema,
#       ),
#     )

#     # response = client.models.generate_content(
#     #     model=MODEL,
#     #     contents=[
#     #         types.Part.from_bytes(data=image_data, mime_type="image/png"),
#     #         EXTRACTION_PROMPT,
#     #     ],
#     # )
#     text = response.text
#     # Extract JSON from response (may be wrapped in markdown code fences)
#     json_match = re.search(r"\[.*\]", text, re.DOTALL)
#     if not json_match:
#         raise ValueError(f"No JSON array found in response:\n{text}")
#     return json.loads(json_match.group())


def name_to_id(name: str) -> str:
    """Convert pattern name to an ID slug.

    'Afro-cub: 1' -> 'afro-cub-1'
    'Rock: 3' -> 'rock-3'
    'New Wave: 1' -> 'new-wave-1'
    """
    s = name.lower()
    s = re.sub(r":\s*", "-", s)   # 'afro-cub: 1' -> 'afro-cub-1'
    s = re.sub(r"[^a-z0-9\-]", "-", s)  # replace non-alphanum with hyphen
    s = re.sub(r"-+", "-", s)     # collapse multiple hyphens
    s = s.strip("-")
    return s


def clean_name(name: str) -> str:
    """Clean up pattern name for display.

    'Afro-cub: 1' -> 'Afro-Cub 1'
    """
    s = re.sub(r":\s*", " ", name)  # drop colon
    s = re.sub(r"\s+", " ", s).strip()
    # Title-case each word, preserving hyphens
    parts = s.split(" ")
    titled = []
    for part in parts:
        subparts = part.split("-")
        titled.append("-".join(w.capitalize() for w in subparts))
    return " ".join(titled)


def normalize_pattern(raw: dict) -> dict | None:
    """Normalize a raw parsed pattern into our app format.

    Returns None if the pattern should be skipped.
    """
    name = raw.get("name", "")
    grid_width = raw.get("grid_width", 0)

    # Skip non-16-step patterns
    if grid_width != 16:
        return None

    # Skip break patterns
    if "break" in name.lower():
        return None

    pattern_id = name_to_id(name)
    if not pattern_id:
        return None

    display_name = clean_name(name)

    # Build steps dict with lowercase track IDs
    steps = {}
    raw_steps = raw.get("steps", {})
    for pdf_key, track_id in INSTRUMENT_MAP.items():
        step_str = raw_steps.get(pdf_key, "0" * 16)
        # Validate
        if len(step_str) != 16 or not all(c in "01" for c in step_str):
            print(f"  WARNING: Invalid step string for {pdf_key} in '{name}': '{step_str}', using zeros")
            step_str = "0" * 16
        steps[track_id] = step_str

    # Ensure all 12 tracks present
    for tid in ALL_TRACK_IDS:
        if tid not in steps:
            steps[tid] = "0" * 16

    return {
        "id": pattern_id,
        "name": display_name,
        "steps": steps,
    }


def process_page(client, pdf_path: Path, page_num: int) -> list[dict]:
    """Process a single PDF page and return normalized patterns."""
    output_file = OUTPUT_DIR / f"page_{page_num:03d}.json"
    error_file = OUTPUT_DIR / f"page_{page_num:03d}.error"

    if output_file.exists():
        print(f"Page {page_num}: already done, skipping")
        return json.loads(output_file.read_text())

    print(f"Page {page_num}: rendering...")
    image_data = render_page(pdf_path, page_num)

    print(f"Page {page_num}: sending to the model...")
    try:
        raw_patterns = extract_patterns_from_image(client, image_data)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Page {page_num}: ERROR - {e}")
        error_file.write_text(str(e))
        return []

    # Normalize and filter
    patterns = []
    for raw in raw_patterns:
        normalized = normalize_pattern(raw)
        if normalized:
            patterns.append(normalized)

    # Save
    output_file.write_text(json.dumps(patterns, indent=2) + "\n")

    names = [p["name"] for p in patterns]
    skipped = len(raw_patterns) - len(patterns)
    skip_msg = f" (skipped {skipped})" if skipped else ""
    print(f"Page {page_num}: {len(patterns)} patterns{skip_msg} {names}")

    return patterns


def do_parse(args):
    """Parse PDF pages into individual JSON files."""
    from google import genai

    pdf_path = Path(args.pdf).expanduser()
    if not pdf_path.exists():
        print(f"ERROR: PDF not found at {pdf_path}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

    if args.pages:
        match = re.match(r"(\d+)-(\d+)", args.pages)
        if match:
            start, end = int(match.group(1)), int(match.group(2))
        else:
            start = end = int(args.pages)
    else:
        start, end = DEFAULT_PAGE_START, DEFAULT_PAGE_END

    total_patterns = 0
    for page_num in range(start, end + 1):
        patterns = process_page(client, pdf_path, page_num)
        total_patterns += len(patterns)
        time.sleep(1)  # Rate limiting

    print(f"\nDone! {total_patterns} patterns from pages {start}-{end}")


def do_merge(args):
    """Merge all parsed page results into patterns.json."""
    if not OUTPUT_DIR.exists():
        print("ERROR: No parsed_patterns directory found. Run parsing first.")
        sys.exit(1)

    page_files = sorted(OUTPUT_DIR.glob("page_*.json"))
    if not page_files:
        print("ERROR: No parsed page files found. Run parsing first.")
        sys.exit(1)

    # Collect all parsed patterns, dedup by ID (later pages win)
    parsed = {}
    for pf in page_files:
        for pattern in json.loads(pf.read_text()):
            parsed[pattern["id"]] = pattern

    print(f"Found {len(parsed)} unique patterns from {len(page_files)} page files")

    # Read existing patterns.json
    existing_data = json.loads(PATTERNS_JSON.read_text())
    existing_patterns = {p["id"]: p for p in existing_data["patterns"]}

    # Figure out what's new vs updated
    new_ids = set(parsed.keys()) - set(existing_patterns.keys())
    updated_ids = set(parsed.keys()) & set(existing_patterns.keys())

    if args.dry_run:
        print(f"\n--- Dry Run ---")
        print(f"Would add {len(new_ids)} new patterns")
        print(f"Would update {len(updated_ids)} existing patterns")
        if new_ids:
            print(f"\nNew: {sorted(new_ids)}")
        if updated_ids:
            print(f"\nUpdated: {sorted(updated_ids)}")
        return

    # Merge: parsed patterns override existing ones
    merged = dict(existing_patterns)
    merged.update(parsed)

    # Sort by ID for consistent ordering
    sorted_patterns = sorted(merged.values(), key=lambda p: p["id"])

    output = {"patterns": sorted_patterns}
    PATTERNS_JSON.write_text(json.dumps(output, indent=2) + "\n")

    print(f"Wrote {len(sorted_patterns)} patterns to {PATTERNS_JSON}")
    print(f"  Added: {len(new_ids)}")
    print(f"  Updated: {len(updated_ids)}")
    print(f"  Kept: {len(existing_patterns) - len(updated_ids)}")


def main():
    parser = argparse.ArgumentParser(description="Parse drum patterns from PDF using Gemini Vision")
    parser.add_argument("--pdf", default=str(DEFAULT_PDF),
                        help=f"Path to PDF (default: {DEFAULT_PDF})")
    parser.add_argument("--pages", help="Page range to parse, e.g. '9-13' or '15'")
    parser.add_argument("--merge", action="store_true",
                        help="Merge parsed results into patterns.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="With --merge, show what would change without writing")
    args = parser.parse_args()

    if args.merge:
        do_merge(args)
    else:
        do_parse(args)


if __name__ == "__main__":
    main()
