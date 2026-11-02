# PDF Pattern Extraction — Design

## Problem

Extract ~260 drum patterns from "260 Drum Machine Patterns"
(1987 PDF) into the app's `patterns.json` format with 100%
accuracy.

### Prior attempts and why they failed

- **Gemini Vision API** (`scripts/parse_pdf_patterns.py`):
  LLM hallucinates grid patterns. When asked to output binary
  strings like `"1010101010101010"`, the autoregressive
  decoder falls into pattern completion instead of inspecting
  each cell. Adjacent filled cells get merged. Row
  configurations get ignored.
- **OpenCV pipeline** (`cv-parsing-plan.md`): Implemented and
  tested but produced inaccurate results. Cell boundary
  detection and classification were unreliable.

### Root cause

Asking an LLM to output a 16-character binary string invites
pattern completion. The model sees the first few cells and
extrapolates rather than checking each cell independently.

## Approach: Structured Cell-by-Cell LLM Extraction

Force the LLM to make 192 independent boolean decisions per
grid (12 rows × 16 columns) via structured output, rather
than generating binary strings. Run 3 passes and take
majority vote. Provide visual verification tooling for human
review to reach 100% accuracy.

## Pipeline Architecture

Five modular stages. Each reads/writes files so any stage
can be re-run independently. A single script with
subcommands.

```
scripts/parse_pdf_patterns.py (rewritten)

Subcommands:
  extract   Render PDF pages to PNG images
  parse     Send images to Gemini, cell-by-cell output
  verify    Generate visual report for human review
  merge     Merge verified patterns into patterns.json
```

Every subcommand accepts `--pages 9-13` or `--pages 15`.

### File layout

```
scripts/parsed_patterns/
  images/                # extract output
    page_009.png
    page_010.png
  passes/                # parse output (per-pass raw)
    page_009_pass1.json
    page_009_pass2.json
    page_009_pass3.json
  consensus/             # parse output (majority vote)
    page_009.json
  report.html            # verify output
```

## Phase 1: Extract

Render PDF pages to PNG using `pdftoppm` at 300 DPI. Reuses
the existing `render_page()` logic but saves to disk instead
of returning bytes.

```bash
uv run scripts/parse_pdf_patterns.py extract --pages 9-13
```

Output: one PNG per page in `scripts/parsed_patterns/images/`.

## Phase 2: Parse

Send each page image to Gemini Vision API with a structured
output schema that forces cell-by-cell boolean decisions.

### Structured output schema

```python
class Cell(BaseModel):
  column: int        # 1-16
  filled: bool       # True = black/hit, False = white/rest

class InstrumentRow(BaseModel):
  instrument: str    # "AC", "CY", "CH", etc.
  cells: list[Cell]  # exactly grid_width entries

class PatternGrid(BaseModel):
  name: str          # e.g. "Afro-cub: 1"
  grid_width: int    # 16 or 12
  rows: list[InstrumentRow]  # exactly 12 rows

class PageResponse(BaseModel):
  patterns: list[PatternGrid]
```

The key difference from the previous approach: each cell is
a separate `{"column": N, "filled": true/false}` decision.
The model cannot autocomplete a binary string because it
must emit each boolean independently.

### Multi-pass consensus

Run 3 independent passes per page (same image, same prompt,
separate API calls). For each cell:

- 3/3 agree → high confidence, use the value
- 2/3 agree → medium confidence, use majority, flag cell
- (impossible with 3 passes, but 0/3 would be flagged)

Derive binary strings programmatically from consensus
booleans. Save both the per-pass raw results and the final
consensus.

### Prompt design

The extraction prompt will:
1. Instruct the model to examine each cell individually
2. Warn against pattern assumption/extrapolation
3. Require verification (count filled cells per row)
4. Specify the fixed instrument row order
5. Handle edge cases: "F" = filled, no-arrow rows = all zeros

```bash
uv run scripts/parse_pdf_patterns.py parse --pages 9-13
# Resumes: skips pages with existing 3-pass consensus
# --force to re-parse
```

### Cost estimate

~89 pages × 3 passes = ~267 API calls to Gemini. At Gemini
Pro pricing with image input, roughly $3-8 total.

## Phase 3: Verify

Generate an HTML report for human review. For each page:

- Show the original page image (left side)
- Show parsed pattern grids rendered as HTML tables (right)
- Highlight flagged cells (where passes disagreed) in yellow
- Show confidence stats (total cells, high/medium/flagged)

```bash
uv run scripts/parse_pdf_patterns.py verify --pages 9-13
# Opens report.html in browser
```

### Validation against known patterns

The 9 hand-verified patterns in `patterns.json` serve as
ground truth. The verify step compares parsed results for
those patterns (afro-cub-1, pop-4 through pop-9, house-01,
techno-01) and reports any cell-level differences.

## Phase 4: Merge

Reuses existing merge logic from the current script:

- Read all consensus JSON files
- Normalize (name → ID, clean display name, map instruments)
- Skip non-16-step and break patterns
- Deduplicate by ID (later pages win)
- Merge with existing patterns.json (parsed versions win)
- Sort by ID

```bash
uv run scripts/parse_pdf_patterns.py merge --dry-run
uv run scripts/parse_pdf_patterns.py merge
```

## Key design decisions

- **Gemini API** over Claude API — user preference, existing
  script already uses Gemini, structured output support
- **Cell-by-cell booleans** over binary strings — prevents
  autoregressive pattern completion hallucination
- **3 passes with majority vote** over single pass — catches
  random errors, provides confidence signal
- **HTML report** for verification — efficient for reviewing
  ~260 patterns visually, highlights only uncertain cells
- **Modular subcommands** over monolithic script — each stage
  can be re-run independently, supports page-specific testing
- **File-based intermediate results** over in-memory — enables
  resume, re-run of individual stages, debugging

## Dependencies

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "pydantic", "jinja2"]
# ///
```

System: `poppler-utils` (for pdftoppm)

## Verification plan

1. Run extract + parse on page 9 (Afro-Cub 1-3, known good)
2. Compare parsed output against hand-verified `afro-cub-1`
   in patterns.json — must match exactly
3. Run on pages 9-13, review HTML report
4. Run full range (pages 7-97), review flagged cells
5. Merge with --dry-run, spot-check counts
6. Merge, rebuild app (`npm run build`), test in browser
