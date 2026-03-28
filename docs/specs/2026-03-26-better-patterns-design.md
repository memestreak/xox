# Better Patterns: Modern Pattern Library & Audition System

## Context

The current XOX pattern library (137 patterns across 17
categories) is sourced from a vintage drum machine pattern
book. The categories (Cha-Cha, Twist, Paso, Boogie) and the
patterns themselves feel dated and are not representative of
how people actually make music today. Additionally, the app
now supports trig conditions (fill mode, cycle ratios,
probability) but none of the existing patterns use them.

This spec covers two things:
1. A pattern audition system for curating new patterns
   interactively
2. A new library of ~170 modern patterns across contemporary
   genres, with trig conditions used where appropriate

## Audition Page

### Architecture

A new route at `/audition` that reuses existing sequencer
infrastructure to let the user preview, edit, and
approve/skip proposed patterns.

**Data flow:**
1. A pattern JSON file is written to
   `/public/patterns/staging.json`
2. The audition page fetches it via `fetch()` on load and
   on explicit reload
3. The page wraps content in `SequencerProvider` and calls
   `setPattern()` to load the staged pattern
4. The user plays back the pattern using existing transport
   controls and views it on the existing `StepGrid`
5. Action buttons: Approve / Edit / Skip

**New files:**
- `src/app/audition/page.tsx` — the audition route

**Reused components:**
- `SequencerProvider` — full audio/state engine
- `StepGrid` — 16-step grid visualization and editing
- `TempoController` — BPM control
- Play/stop button logic from `TransportControls`

### Page Layout

```
+--------------------------------------------------+
| Pattern: "House 03"  Category: "House"           |
+--------------------------------------------------+
| [Play/Stop]  BPM: [120]                         |
+--------------------------------------------------+
|                                                  |
|              StepGrid (16 steps)                 |
|              (all 12 tracks visible)             |
|                                                  |
+--------------------------------------------------+
| [Approve Edited]              [Reload Pattern]   |
+--------------------------------------------------+
```

The Approve Edited button copies the current grid state
(including any edits and trig conditions) as pattern JSON
to the clipboard. Reload re-fetches staging.json.
Approve (unedited) and Skip are handled via chat — no
buttons needed.

### Approve Flow (Unedited)

The user says "approve" in chat. The AI already knows the
staged pattern (it wrote `staging.json`), so it appends
the pattern directly to `src/app/data/approved-patterns.json`.
No UI button needed for this case.

### Approve Flow (Edited)

1. The user edits steps on the StepGrid (always
   interactive) and/or adjusts trig conditions via step
   popovers
2. The user clicks **Approve** on the audition page
3. The page copies the edited pattern JSON to the
   clipboard and shows a toast confirmation
4. The user pastes the JSON into chat so the AI can see
   the changes
5. The AI appends the edited version to
   `approved-patterns.json`

### Skip Flow

The user says "skip" in chat. The AI moves on to the
next pattern. No UI interaction needed.

### Reload

A "Reload Pattern" button re-fetches
`/patterns/staging.json` (with a cache-busting query
param) to pick up the next proposed pattern. If the
staging file hasn't changed since the last load, the
page shows the same pattern — no error state needed,
since the user simply waits for the AI to update it
and reloads again.

## Pattern Library

### Genre Categories and Counts

**Modern Electronic (~50 patterns)**

| Category   | Count | Subgenres / Notes                |
|------------|-------|----------------------------------|
| House      | 8     | Deep, tech, classic, minimal     |
| Techno     | 8     | Berlin, industrial, minimal      |
| Drum & Bass| 6     | Liquid, neuro, jungle            |
| Dubstep    | 4     | Half-time, wobble                |
| Trance     | 4     | Progressive, uplifting           |
| Electro    | 4     | Classic electro, modern          |
| Breakbeat  | 4     | Big beat, breaks                 |
| Garage     | 4     | 2-step, UK garage                |
| IDM        | 4     | Glitchy, experimental            |
| Ambient    | 4     | Sparse, atmospheric              |

**Hip-Hop / Urban (~45 patterns)**

| Category   | Count | Subgenres / Notes                |
|------------|-------|----------------------------------|
| Boom Bap   | 8     | Classic NY, SP-1200 style        |
| Trap       | 8     | Atlanta, melodic trap            |
| Lo-Fi      | 6     | Chill, dusty, jazzy              |
| Drill      | 6     | UK drill, Chicago                |
| R&B        | 6     | Modern, classic                  |
| Reggaeton  | 6     | Dembow, moombahton               |
| Phonk      | 5     | Memphis, drift phonk             |

**Pop / Rock / Indie (~40 patterns)**

| Category          | Count | Subgenres / Notes          |
|-------------------|-------|----------------------------|
| Pop               | 8     | Modern, synth-pop, dance   |
| Rock              | 8     | Classic, alt, stadium      |
| Indie             | 6     | Post-punk, shoegaze        |
| Punk              | 4     | Fast, driving              |
| Metal             | 4     | Double kick, blast beats   |
| New Wave          | 4     | 80s-inspired, angular      |
| Singer-Songwriter | 4     | Brushes, sparse            |
| Country           | 2     | Train beat, shuffle        |

**World / Roots (~35 patterns)**

| Category       | Count | Subgenres / Notes          |
|----------------|-------|----------------------------|
| Afrobeat       | 6     | Fela-style, afro-house     |
| Latin          | 6     | Samba, bossa, salsa        |
| Funk           | 6     | Classic, modern            |
| Reggae         | 4     | One drop, dub              |
| Jazz           | 4     | Swing, bop, fusion         |
| Caribbean      | 4     | Soca, dancehall            |
| Middle Eastern | 3     | Baladi, saidi              |
| Bollywood      | 2     | Film-style grooves         |

**Total: ~170 patterns**

### Pattern Ordering

Within each category, patterns are ordered from simple to
complex:
- Early patterns (01, 02, 03) use plain binary step
  strings only
- Later patterns incorporate trig conditions (fill breaks,
  cycle ratios)
- No naming suffix distinguishes basic from advanced;
  ordering is implicit

### Trig Condition Usage

**Priorities (most to least used):**
1. **Fill mode** — tom fills, crash accents, snare rolls
   that only trigger when fill is active. Keeps the main
   groove clean while providing variation on demand.
2. **Cycle ratios** — percussion hits every Nth cycle
   (e.g., cowbell every 3rd repetition) for longer phrase
   movement and less repetition.
3. **Probability** — used sparingly. Light ghost note
   variation on hi-hats where it serves the genre (e.g.,
   jazz brushes). Not a primary feature.

### Pattern Format

Patterns follow the existing `Pattern` interface from
`src/app/types.ts`:

```typescript
interface Pattern {
  id: string;
  name: string;
  category?: string;
  steps: Record<TrackId, string>;
  trigConditions?: Partial<
    Record<TrackId, Record<number, StepConditions>>
  >;
  parameterLocks?: Partial<
    Record<TrackId, Record<number, StepLocks>>
  >;
}
```

**Naming conventions:**
- Names: `"House 01"` through `"House 08"`
- IDs: full-word kebab-case, e.g. `"house-1"`, `"trap-3"`,
  `"drum-and-bass-2"` (not abbreviated like the old
  `"afro-cub-1"` convention)
- Categories: title case, matching the table headers above

**Track IDs:** `ac bd sd ch oh cy ht mt lt rs cp cb`

### Staging File Format

The staging file uses a `StagingPattern` type (audition-
page only, not added to `types.ts`) that extends `Pattern`
with a `suggestedBpm` field. This field is stripped before
saving to `approved-patterns.json`.

`/public/patterns/staging.json`:

```json
{
  "id": "house-3",
  "name": "House 03",
  "category": "House",
  "suggestedBpm": 124,
  "steps": {
    "ac": "0000000000000000",
    "bd": "1000100010001000",
    "sd": "0000100000001000",
    "ch": "1111111111111111",
    "oh": "0000000000000000",
    "cy": "0000000000000000",
    "ht": "0000000000000000",
    "mt": "0000000000000000",
    "lt": "0000000000000000",
    "rs": "0000000000000000",
    "cp": "0000000000000000",
    "cb": "0000000000000000"
  }
}
```

Example with trig conditions:

```json
{
  "id": "house-7",
  "name": "House 07",
  "category": "House",
  "suggestedBpm": 124,
  "steps": {
    "ac": "0000000000000000",
    "bd": "1000100010001000",
    "sd": "0000100000001000",
    "ch": "1111111111111111",
    "oh": "0001000000010000",
    "cy": "0000000000000000",
    "ht": "0000000000001000",
    "mt": "0000000000000010",
    "lt": "0000000000000001",
    "rs": "0000000010000000",
    "cp": "0000100000001000",
    "cb": "0000000000000000"
  },
  "trigConditions": {
    "ht": {
      "12": { "fill": "fill" }
    },
    "mt": {
      "14": { "fill": "fill" }
    },
    "lt": {
      "15": { "fill": "fill" }
    },
    "rs": {
      "8": { "cycle": { "a": 1, "b": 3 } }
    }
  }
}
```

The `suggestedBpm` field is audition-only guidance; the
audition page sets the BPM to this value when loading a
new pattern.

### Approved Patterns File

`src/app/data/approved-patterns.json`:

```json
{
  "patterns": []
}
```

Approved patterns are appended here. On finalization,
this replaces the contents of `patterns.json`.

## Audition Workflow

**Setup (one-time):**
1. Build the `/audition` page
2. Start the dev server
3. Create empty `approved-patterns.json`

**Curation loop (repeated per pattern):**
1. AI writes pattern to `/public/patterns/staging.json`
2. AI describes the pattern (name, category, character)
3. User reloads audition page, plays pattern
4. User says "approve" or "skip" in chat, or edits on
   the grid and clicks Approve Edited (pastes JSON)
5. AI appends approved pattern to
   `approved-patterns.json` and writes the next staging
   pattern

**Finalization (full replacement):**
1. Replace the entire `patterns` array in `patterns.json`
   with the contents of `approved-patterns.json`. All 137
   old patterns are removed — this is a complete
   replacement, not a merge.
2. Run `npm test -- -u` to update pattern-related snapshots
3. Run `npm run lint` to verify zero lint errors
4. Decide whether to keep or remove the audition page

Categories are worked through in order so the user can
compare patterns within a genre. AI suggests a BPM for
each category since genres have characteristic tempos.

## Verification

1. `npm run build` — audition page builds in static export
2. `npm run lint` — zero lint errors
3. `npm test` — all tests pass (update pattern-related
   snapshots as needed)
4. Manual: navigate to `/audition`, verify staging pattern
   loads and plays back correctly
5. Manual: say "approve" in chat, verify AI appends the
   staged pattern to `approved-patterns.json`
6. Manual: edit steps on the grid, click Approve Edited,
   verify the edited state (not the original staging
   data) is what gets copied to clipboard
7. Final: after replacing `patterns.json`, verify pattern
   picker shows new categories and patterns play correctly
