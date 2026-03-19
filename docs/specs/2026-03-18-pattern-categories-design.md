# Pattern Categories — Design Spec

Issue: #26 — FR: Organize patterns into categories

## Problem

The pattern library contains 127 patterns in a flat `<select>`
dropdown. As the library grows, this becomes hard to browse.
Pattern names already follow a natural grouping convention
(e.g., `funk-1` through `funk-15`) but the UI doesn't reflect
these groupings.

## Solution

Replace the flat `<select>` with a centered-modal pattern
picker that organizes patterns into named categories with pill
buttons across the top and a pattern grid below.

## Data Layer

### patterns.json

Add a `category` field to every pattern object. The category
is assigned **explicitly per pattern** in the JSON, not derived
at runtime from ID prefixes. This avoids edge cases with
inconsistent ID formats (bare IDs like `charleston`, `tango`;
zero-padded IDs like `house-01`, `techno-01`; and gaps like
`march-2` with no `march-1`).

Single-pattern categories (Charleston, House, March, Tango,
Techno) are merged into an "Other" group.

Complete category assignments:

| Patterns | Category |
|----------|----------|
| `afro-cub-1` through `afro-cub-9`, `afro-cuban-1` | Afro-Cuban |
| `boogie-1` through `boogie-3` | Boogie |
| `bossa-1` through `bossa-6` | Bossa |
| `cha-cha-1` through `cha-cha-3` | Cha-Cha |
| `disco-1` through `disco-12` | Disco |
| `funk-1` through `funk-15` | Funk |
| `paso-1` through `paso-2` | Paso |
| `pop-1` through `pop-12` | Pop |
| `r-b-1` through `r-b-12` | R&B |
| `reggae-1` through `reggae-6`, `reggae-10` through `reggae-12` (9 total; 7-9 do not exist in data) | Reggae |
| `rock-1` through `rock-14` | Rock |
| `samba-1` through `samba-6` | Samba |
| `ska-1` through `ska-3` | Ska |
| `slow-1` through `slow-12` | Slow |
| `twist-1` through `twist-3` | Twist |
| `charleston`, `house-01`, `march-2`, `tango`, `techno-01` | Other |

This yields **16 categories** (15 named + Other).

Category pills are sorted **alphabetically**, with "Other"
pinned to the end.

Pattern IDs do not change. The `category` field is additive and
has no effect on `configCodec` or URL sharing. Existing shared
URLs remain valid.

### Name normalization

Rename all `afro-cub-*` pattern display names from "Afro-Cub N"
to "Afro-Cuban N" for consistency within the merged category.
IDs remain unchanged.

To avoid a naming collision with the existing `afro-cuban-1`
(already named "Afro-Cuban 1"), renumber as follows:

| ID | Old name | New name |
|----|----------|----------|
| `afro-cub-1` | Afro-Cub 1 | Afro-Cuban 1 |
| `afro-cub-2` | Afro-Cub 2 | Afro-Cuban 2 |
| ... | ... | ... |
| `afro-cub-9` | Afro-Cub 9 | Afro-Cuban 9 |
| `afro-cuban-1` | Afro-Cuban 1 | Afro-Cuban 10 |

The existing `afro-cuban-1` is renumbered to 10 since it
appears after the `afro-cub-*` patterns in the source data.

### Pattern type (types.ts)

Add an optional `category` field:

```typescript
export interface Pattern {
  id: string;
  name: string;
  category?: string;
  steps: Record<TrackId, string>;
  trigConditions?: Partial<
    Record<TrackId, Record<number, StepConditions>>
  >;
}
```

### patternUtils.ts

Already implements `getCategorizedPatterns()` which groups
patterns by their `category` field, falling back to `"Misc"`.

Changes needed:
1. Change the fallback from `"Misc"` to `"Other"` for
   consistency with the category naming in `patterns.json`.
2. Sort the returned categories alphabetically, with "Other"
   pinned to the end.

## Component: PatternPicker

> **Note:** The existing `PatternPicker.tsx` in the repo is a
> throwaway draft that uses a full-screen accordion design. It
> will be **completely rewritten** to match the approved modal
> design below. Do not carry forward any of its structure.

### Trigger Button

Replaces the `<select>` in the Pattern section of
`TransportControls.tsx`. Displays the current pattern name
(or "Custom" if the user has edited steps) with a chevron
indicator. Styled to match the existing kit `<select>`:
`bg-neutral-800`, `border-neutral-700`, same padding and
font size.

The chevron rotates 180 degrees when the modal is open. No
other visual change to the trigger button while open.

### Modal

Opens as a centered modal over a dark backdrop
(`bg-black/60`).

Structure:
```
+------------------------------------------+
|                                      [X] |
|  Category                                |
|  [Afro-Cuban] [Boogie] [Bossa] [Cha-Cha]|
|  [Disco] [Funk*] [Paso] [Pop] [R&B]     |
|  [Reggae] [Rock] [Samba] [Ska] [Slow]   |
|  [Twist] [Other]                         |
|------------------------------------------|
|  Funk 1    Funk 4     Funk 7    Funk 10  |
|  Funk 2    Funk 5     Funk 8    Funk 11  |
|  Funk 3    Funk 6     Funk 9    Funk 12  |
|            >Funk 13<   Funk 14   Funk 15 |
|------------------------------------------|
|  Active: Funk 13               Esc close |
+------------------------------------------+
```

#### Layout: two-panel pinned structure

The modal interior is split into two zones:

1. **Top zone (pinned)**: Category pills. Always visible
   regardless of viewport height or grid content.
2. **Bottom zone (scrollable)**: Pattern grid. Scrolls
   independently if content exceeds available height.

This ensures category navigation is always accessible, even
on small mobile screens where pills may wrap to 4-5 rows.

#### Category pills

- Wrap across multiple rows using `flex-wrap`.
- Sorted alphabetically, "Other" pinned last.
- Three visual states:
  1. **Default**: `bg-neutral-800`, `text-neutral-300`.
     Hover brightens.
  2. **Selected** (currently viewing): `bg-orange-600`,
     `text-white`.
  3. **Has active pattern** (but not selected):
     `bg-neutral-700`, `text-orange-400`,
     `border-orange-600/40`.
- Clicking a pill selects that category and populates the
  pattern grid below. Clicking the already-selected pill
  deselects it (grid shows placeholder text).

#### Pattern grid

- CSS Grid with `grid-auto-flow: column` and a fixed row
  count to achieve **columns-first** (newspaper) flow.
  Patterns fill vertically then wrap to the next column.
- Column width: `minmax(120px, 1fr)`.
- Pattern names show the **full name** (e.g., "Funk 5", not
  just "5"), truncated with ellipsis at ~16 characters.
- Each pattern is a button. Two states:
  1. **Default**: `text-neutral-300`, transparent background.
     Hover adds `bg-neutral-800`.
  2. **Active** (currently loaded pattern):
     `text-orange-400`, `bg-neutral-800`, `font-weight: 600`.
- Clicking a pattern calls `setPattern()` **immediately**
  (live auditioning). The modal **stays open** so the user
  can audition multiple patterns without reopening.
- Pattern change is instant (no quantization to next bar).

#### Footer

- Left: "Active: {pattern name}" in muted text with the name
  in orange.
- Right: "Esc to close" hint in dark muted text.

### Behavior

- **Open**: On trigger button click. Auto-selects the
  category containing the current pattern.
- **Close**: Escape key, backdrop click, or X button. No
  separate "Done" button — these three affordances are
  sufficient.
- **Does not close** on pattern selection.
- **Custom pattern**: When the current pattern is "Custom"
  (user has edited steps manually), no category is
  pre-selected and the footer shows "Active: Custom". The
  grid area shows placeholder text ("Select a category").
- **URL imports**: Always show "Custom" — no attempt to match
  imported steps against known presets.

### Space bar interaction

The global Space bar handler in `SequencerContext.tsx`
toggles playback. It currently suppresses this when the
active element is an `INPUT`, `TEXTAREA`, or `SELECT`. When
the PatternPicker modal is open, Space on a pattern button
would both activate the button and toggle playback.

Fix: extend the Space handler to also suppress when the
active element is a `BUTTON` inside an open `[role="dialog"]`
element (or check for `closest('[role="dialog"]')`). This
prevents double-action when clicking pattern buttons via
keyboard.

### Accessibility

- Trigger button: `aria-haspopup="dialog"`,
  `aria-expanded={isOpen}`.
- Modal: `role="dialog"`, `aria-label="Pattern picker"`.
- Pattern buttons: `role="option"`,
  `aria-selected={isActive}`.
- Focus management: focus moves to the modal on open, returns
  to trigger on close.
- Focus trap (Tab cycling within the modal) is **out of scope
  for v1**. The modal can be dismissed via Escape, which is
  the primary keyboard affordance. A focus trap can be added
  in a follow-up if needed.

## Integration

### TransportControls.tsx

Replace the pattern `<select>` block (the `<div>` wrapping
the "Pattern" label and `<select id="pattern-select">`) with:

```tsx
<div className="bg-neutral-900/50 p-2 border
  border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
  <span className="text-[8px] lg:text-[10px] uppercase
    tracking-widest text-neutral-500 mb-1 block font-bold">
    Pattern
  </span>
  <PatternPicker
    categories={categories}
    currentPattern={currentPattern}
    onSelect={setPattern}
  />
</div>
```

New imports needed:
- `import PatternPicker from './PatternPicker';`
- `import { getCategorizedPatterns } from './patternUtils';`

The `categories` value is computed once from `patternsData`
using `getCategorizedPatterns()` at module scope (static
data, no need for `useMemo`). The `patternsData` import
already exists in this file.

## Testing

### patternUtils.test.ts

- `getCategorizedPatterns()` groups patterns correctly by
  `category` field
- Fallback to "Other" for patterns without a category
- Categories are sorted alphabetically with "Other" last
- All 127 patterns are accounted for across categories

### PatternPicker.test.tsx (new)

- Renders trigger button with current pattern name
- Shows "Custom" when `currentPattern.id === 'custom'`
- Opens modal on trigger click
- Renders all category pills in alphabetical order
- Clicking a category shows its patterns in the grid
- Active pattern is highlighted (`text-orange-400`,
  `aria-selected`)
- Category containing the active pattern shows the
  "has-active" visual state (`text-orange-400`,
  `border-orange-600/40`) when a different category is
  selected
- Clicking a pattern calls `onSelect` with the pattern
  object
- Modal stays open after pattern selection
- Escape key closes the modal
- Backdrop click closes the modal
- X button closes the modal
- No category pre-selected when current pattern is Custom
- Auto-selects category of current pattern on open

## Files Changed

| File | Change |
|------|--------|
| `src/app/data/patterns.json` | Add `category` field to all 127 patterns; rename Afro-Cub N to Afro-Cuban N; renumber afro-cuban-1 to Afro-Cuban 10 |
| `src/app/types.ts` | Add optional `category` to `Pattern` |
| `src/app/patternUtils.ts` | Change fallback from "Misc" to "Other"; sort categories alphabetically with "Other" last |
| `src/app/PatternPicker.tsx` | Complete rewrite to match approved modal design (existing draft is throwaway) |
| `src/app/TransportControls.tsx` | Replace `<select>` with `PatternPicker`; add imports for `PatternPicker` and `getCategorizedPatterns` |
| `src/app/SequencerContext.tsx` | Extend Space bar handler to suppress inside `[role="dialog"]` |
| `src/__tests__/patternUtils.test.ts` | Test grouping, sorting, "Other" bucket, fallback |
| `src/__tests__/PatternPicker.test.tsx` | Component render + interaction tests |

## Files Not Changed

| File | Reason |
|------|--------|
| `src/app/configCodec.ts` | `category` is not part of serialized config |

## Out of Scope

- Searchable/filterable patterns
- User-created custom categories
- Drag-to-reorder categories
- Pattern preview thumbnails (visual step grid)
- Quantized pattern switching (change on next bar)
- Matching imported URL steps to known presets
- Focus trap (Tab cycling) within the modal
- Backfilling missing reggae patterns (7-9)

## Backward Compatibility

Pattern IDs are unchanged. The `category` field is not
included in `SequencerConfig` or the URL codec. Existing
shared URLs decode identically. Display name changes
(Afro-Cub → Afro-Cuban) affect only the UI label, not
the pattern ID used in codec lookups.
