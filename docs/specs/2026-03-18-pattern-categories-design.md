# Pattern Categories — Design Spec

Issue: #26 — FR: Organize patterns into categories

## Problem

The pattern library contains 127 patterns in a flat `<select>`
dropdown. As the library grows, this becomes hard to browse.
Pattern names already follow a natural grouping convention
(e.g., `funk-1` through `funk-15`) but the UI doesn't reflect
these groupings.

## Solution

Replace the flat `<select>` with a popover-based pattern
picker that organizes patterns into named categories.

## Data Layer

### patterns.json

Add a `category` field to every pattern object. Categories
are derived from the existing ID prefix convention:

| ID prefix(es)                 | Category name |
|-------------------------------|---------------|
| `afro-cub-*`, `afro-cuban-*` | Afro-Cuban    |
| `r-b-*`                      | R&B           |
| `cha-cha-*`                   | Cha-Cha       |
| `boogie-*`                    | Boogie        |
| `bossa-*`                     | Bossa         |
| `charleston-*`                | Charleston    |
| `disco-*`                     | Disco         |
| `funk-*`                      | Funk          |
| `house-*`                     | House         |
| `march-*`                     | March         |
| `paso-*`                      | Paso          |
| `pop-*`                       | Pop           |
| `reggae-*`                    | Reggae        |
| `rock-*`                      | Rock          |
| `samba-*`                     | Samba         |
| `ska-*`                       | Ska           |
| `slow-*`                      | Slow          |
| `tango-*`                     | Tango         |
| `techno-*`                    | Techno        |
| `twist-*`                     | Twist         |

Pattern IDs do not change. The `category` field is additive
and has no effect on `configCodec` or URL sharing. Existing
shared URLs remain valid.

Example before:
```json
{ "id": "funk-5", "name": "Funk 5", "steps": { ... } }
```

Example after:
```json
{
  "id": "funk-5",
  "name": "Funk 5",
  "category": "Funk",
  "steps": { ... }
}
```

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
patterns by their `category` field (falling back to `"Misc"`).
No changes needed.

## Component: PatternPicker

### Trigger Button

Replaces the `<select>` in the Pattern section of
`TransportControls.tsx`. Displays the current pattern name
(or "Custom" if the user has edited steps) with a chevron
indicator. Styled to match the existing kit `<select>`:
`bg-neutral-800`, `border-neutral-700`, same padding and
font size.

### Modal

Opens as a centered modal over a dark backdrop
(`bg-black/60`).

Structure:
```
+------------------------------------------+
|                                      [X] |
|  Category                                |
|  [Afro-Cuban] [Boogie] [Bossa] [Disco]  |
|  [Funk*] [House] [Pop] [R&B] [Reggae]   |
|  [Rock] [Samba] [Ska] [Slow] [Techno]   |
|  [Cha-Cha] [Charleston] [March] [Paso]  |
|  [Tango] [Twist]                         |
|------------------------------------------|
|  Funk 1    Funk 5     Funk 9    Funk 13  |
|  Funk 2    Funk 6     Funk 10   Funk 14  |
|  Funk 3    Funk 7     Funk 11   Funk 15  |
| >Funk 4<   Funk 8     Funk 12           |
|------------------------------------------|
|  Active: Funk 4                Esc close |
+------------------------------------------+
```

#### Category pills

- Wrap across multiple rows using `flex-wrap`.
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

- CSS Grid with `auto-fill`, `minmax(120px, 1fr)`.
- `max-height: 240px` with `overflow-y: auto` for categories
  with many patterns.
- Each pattern is a button. Two states:
  1. **Default**: `text-neutral-300`, transparent background.
     Hover adds `bg-neutral-800`.
  2. **Active** (currently loaded pattern):
     `text-orange-400`, `bg-neutral-800`, `font-weight: 600`.
- Clicking a pattern calls `setPattern()` immediately (live
  auditioning). The modal stays open.

#### Footer

- Left: "Active: {pattern name}" in muted text with the name
  in orange.
- Right: "Esc to close" hint in dark muted text.

### Behavior

- **Open**: On trigger button click. Auto-selects the
  category containing the current pattern.
- **Close**: Escape key, backdrop click, or X button.
- **Does not close** on pattern selection — the user can
  audition multiple patterns.
- **Custom pattern**: When the current pattern is "Custom"
  (user has edited steps manually), no category is
  pre-selected and the footer shows "Active: Custom".

### Accessibility

- Trigger button: `aria-haspopup="dialog"`,
  `aria-expanded={isOpen}`.
- Modal: `role="dialog"`, `aria-label="Pattern picker"`.
- Pattern buttons: `role="option"`,
  `aria-selected={isActive}`.
- Focus management: focus moves to the modal on open, returns
  to trigger on close.

## Integration

### TransportControls.tsx

Replace the pattern `<select>` block (lines 77-104) with:

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

The `categories` value is computed once from `patternsData`
using `getCategorizedPatterns()` at module scope (static
data, no need for `useMemo`).

## Files Changed

| File | Change |
|------|--------|
| `src/app/data/patterns.json` | Add `category` field to all 127 patterns |
| `src/app/types.ts` | Add optional `category` to `Pattern` |
| `src/app/PatternPicker.tsx` | Rewrite to match approved mockup |
| `src/app/TransportControls.tsx` | Replace `<select>` with `PatternPicker` |
| `src/__tests__/patternUtils.test.ts` | Test `getCategorizedPatterns()` |

## Files Not Changed

| File | Reason |
|------|--------|
| `src/app/patternUtils.ts` | Already implements grouping logic correctly |
| `src/app/configCodec.ts` | `category` is not part of serialized config |
| `src/app/SequencerContext.tsx` | `setPattern` API unchanged |

## Out of Scope

- Searchable/filterable patterns (future enhancement)
- User-created custom categories
- Drag-to-reorder categories
- Pattern preview thumbnails (visual step grid)

## Backward Compatibility

Pattern IDs are unchanged. The `category` field is not
included in `SequencerConfig` or the URL codec. Existing
shared URLs decode identically.
