# PDF Pattern Parsing — Handoff

## What's Done

`scripts/parse_pdf_patterns.py` is created and tested. It converts the
PDF into the app's `patterns.json` format using the Claude Vision API.

## Next Steps

### 1. Parse the PDF (~5 min active, runs unattended)

```bash
export ANTHROPIC_API_KEY=sk-...

# Test with a small range first
uv run --with anthropic scripts/parse_pdf_patterns.py --pages 9-13

# Then parse everything (pages 9–97)
uv run --with anthropic scripts/parse_pdf_patterns.py
```

- Each page takes ~5–10 seconds (render + API call + 1s delay).
- Full run is ~89 pages, roughly 10–15 minutes.
- Results land in `scripts/parsed_patterns/page_NNN.json` (one file per page).
- **Resumable** — if you stop and re-run, it skips already-processed pages.
- Errors are saved as `page_NNN.error` files; the script continues past them.
- Cost: ~$1–2 total (Claude Sonnet).

### 2. Review parsed results

```bash
# See what would be merged
uv run --with anthropic scripts/parse_pdf_patterns.py \
  --merge --dry-run
```

This shows how many new/updated patterns were found. Spot-check a few
`scripts/parsed_patterns/page_NNN.json` files against the PDF to
confirm accuracy.

### 3. Merge into patterns.json

```bash
uv run --with anthropic scripts/parse_pdf_patterns.py --merge
```

This reads all page files, deduplicates by ID, merges with the
existing 9 hand-parsed patterns, and writes
`src/app/data/patterns.json`.

### 4. Validate the app still works

```bash
npm run build   # Confirm JSON is valid and app compiles
npm run dev     # Load the app, try selecting and playing new patterns
```

## What to Watch For

- **12-step and break patterns are filtered out** — the script only
  keeps 16-step (4/4 time) patterns. This is intentional.
- **Existing patterns are preserved** — `house-01`, `techno-01`,
  etc. stay unless a PDF pattern has the same ID (the PDF version wins
  in that case).
- **`afro-cub-1`** exists in both the hand-parsed data and the
  PDF. After merge, compare the two to verify the vision parsing
  matched.
- If a page comes back with bad JSON, its `.error` file will contain
  the raw Claude response. You can re-run just that page with `--pages
  N`.

## File Layout

```
scripts/
  parse_pdf_patterns.py       # The script
  parsed_patterns/             # Created at runtime
    page_009.json              # Parsed patterns from PDF page 9
    page_010.json
    ...
    page_NNN.error             # Raw response if parsing failed
src/app/data/
  patterns.json                # Updated by --merge
```
