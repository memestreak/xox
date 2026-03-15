# PDF Pattern Extraction — Handoff

**Date:** 2026-03-02
**Branch:** main
**HEAD:** 6b752d4

## What Was Built

A complete pipeline for extracting drum patterns from the
"260 Drum Machine Patterns" PDF using Gemini Vision API with
structured cell-by-cell output and multi-pass consensus.

### Script: `scripts/parse_pdf_patterns.py` (927 lines)

Four subcommands:

```bash
# 1. Render PDF pages to 300 DPI PNG
uv run scripts/parse_pdf_patterns.py --pages 9-13 extract

# 2. Send to Gemini for cell-by-cell extraction (3 passes)
uv run scripts/parse_pdf_patterns.py --pages 9-13 parse

# 3. Generate HTML verification report
uv run scripts/parse_pdf_patterns.py --pages 9-13 verify

# 4. Merge into patterns.json
uv run scripts/parse_pdf_patterns.py merge --dry-run
uv run scripts/parse_pdf_patterns.py merge
```

Global flags go BEFORE the subcommand name (`--pages 9`
before `extract`). Parse-specific flags (`--passes`,
`--force`, `--model`) go after.

### Tests: `scripts/tests/test_helpers.py` (24 tests, all passing)

```bash
uv run --with pytest --with google-genai \
  pytest scripts/tests/test_helpers.py -v
```

### File layout

```
scripts/parsed_patterns/        # .gitignore'd
  images/page_009.png           # extract output
  passes/page_009_pass{1,2,3}.json  # per-pass raw output
  consensus/page_009.json       # majority-vote result
  report.html                   # verify output
```

### Commits (oldest first)

```
6bfeb14 Scaffold pattern extraction script with CLI
e40c23e Remove unused imports from scaffold
542ab34 Add helper functions with tests
f7e1220 Implement extract subcommand
1c41b57 Add Pydantic models and consensus logic
d829284 Implement parse subcommand with Gemini API
77d3835 Add normalize_pattern and merge subcommand
6b752d4 Add verify subcommand with HTML report
```

## Design Documents

- `docs/plans/2026-03-02-pdf-pattern-extraction-design.md`
  — architecture and rationale
- `docs/plans/2026-03-02-pdf-pattern-extraction-impl.md`
  — step-by-step implementation plan (8 tasks)

## Critical Finding: Accuracy Is Not Sufficient

The pipeline is mechanically complete and working, but
**Gemini 2.5 Pro is not reading the grids accurately**.

### Test results on page 9 (Afro-cub 1, 2, 3)

3 passes, 79 flagged cells out of 576 total (14%
disagreement rate). 0/1 ground truth patterns matched.

Afro-cub 1 comparison against hand-verified ground truth:

```
Row   Ground truth         3-pass consensus
CH    1011101010101010     1111011011010110
RS    0001001000001000     0000000000000000
SD    0000000000000000     0000100100001000
BD    1000000010100010     1001000011100000
```

### What's going wrong

1. **RS/SD confusion**: The model puts RS hits into the SD
   row. It may be misreading which row is which despite the
   fixed instrument order.

2. **CH pattern still hallucinated**: Despite structured
   cell-by-cell output, the CH row is significantly wrong.
   The model seems to struggle with densely-filled rows.

3. **High inter-pass disagreement**: 79 flagged cells means
   the model is not consistent across runs, suggesting it's
   guessing rather than confidently reading.

### The structured output helped but didn't solve it

The cell-by-cell Pydantic schema (each cell is an
independent `{"column": N, "filled": true/false}` decision)
prevents binary-string autocomplete. But the model still
can't accurately identify which cells are filled vs empty
in the 300 DPI grid images. The problem is upstream of the
output format — it's the vision model's grid-reading
capability itself.

## Next Steps to Consider

1. **Try a different model**: `gemini-2.5-flash` with
   `thinking_level="high"` and `media_resolution="high"`
   might do better. The `--model` flag already supports
   this.

2. **Try Claude Vision**: Claude's vision capabilities may
   handle grid reading differently. Would require swapping
   the API call in `send_to_gemini` (schema would need
   adaptation for Anthropic's structured output format).

3. **Increase DPI**: Try 400-600 DPI rendering. The grid
   cells are small at 300 DPI and the model may not have
   enough visual resolution.

4. **Row-by-row cropping**: Instead of sending the full
   page, crop each individual grid row and ask the model
   to read just 16 cells. This reduces the task complexity
   dramatically.

5. **Hybrid CV + simple thresholding**: Use OpenCV to
   detect grid lines (not cells) to find exact cell
   boundaries, then use dark-pixel-ratio thresholding per
   cell. This approach was planned in `cv-parsing-plan.md`
   but the previous implementation may have used contour
   detection (which fails on adjacent filled cells) rather
   than line detection.

6. **Manual transcription with verification tooling**: The
   HTML report already shows side-by-side grids. Could add
   an editable mode for manual correction.

## Environment Notes

- `GEMINI_API_KEY` is available in the environment
- `pdftoppm` (poppler-utils) is installed
- The script uses `uv run` with inline PEP 723 deps:
  `google-genai`, `jinja2`, `pydantic`
- Page 9 images and results are cached in
  `scripts/parsed_patterns/`
- Pattern pages span PDF pages 9-97 (book pages 7-95)
- 9 hand-verified patterns exist in
  `src/app/data/patterns.json` for ground truth comparison
