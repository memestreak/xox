# Chooser Modal — Style Spec

Reusable design language for modal-based selection widgets in
XOX. Any `<select>` dropdown in the transport bar that outgrows
a simple list should be replaced with a chooser that follows
this spec.

Current implementations:
- **Pattern picker** (issue #26) — categories + grid
- **Drum kit selector** (future) — flat list or categories
  once the kit library grows

## Trigger Button

Replaces the native `<select>`. Sits inside the same
`bg-neutral-900/50` panel used by existing transport controls.

| Property | Value |
|----------|-------|
| Background | `bg-neutral-800` |
| Border | `border border-neutral-700` |
| Padding | `p-1 lg:p-2` |
| Font | `text-sm text-left` |
| Hover | `hover:border-neutral-600` |
| Focus | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500` |
| Corner radius | `rounded` |

Content: current selection name (left-aligned, truncated with
`truncate`) + chevron icon (right-aligned, `w-4 h-4`,
`text-neutral-400`).

The chevron rotates 180 degrees (`rotate-180`) when the modal
is open. No other visual change to the trigger.

```
+----------------------------------+
| Funk 5                        V  |
+----------------------------------+
```

## Modal Overlay

### Backdrop

- `fixed inset-0 z-40 bg-black/60`
- Clicking the backdrop closes the modal.

### Modal Container

- `fixed z-50` centered horizontally and vertically.
- Responsive sizing:
  - Mobile: `inset-x-3 top-20 bottom-6`
  - Desktop: `lg:inset-x-12 lg:top-24 lg:bottom-12`
  - Max width: `max-w-[680px] mx-auto`
- Background: `bg-neutral-900`
- Border: `border border-neutral-700 rounded-xl`
- Shadow: `shadow-2xl`
- Internal padding: `p-4 lg:p-6`

### Close Button (X)

- Positioned `absolute top-3 right-3`
- Icon: 20x20 SVG "x" mark
- Color: `text-neutral-500 hover:text-neutral-300`
- `aria-label="Close"`

## Two-Zone Layout

The modal interior is split into two zones using flexbox:

```
+------------------------------------------+
|  [Zone 1: Navigation — pinned, no scroll]|
|------------------------------------------|
|  [Zone 2: Content — scrolls if needed]   |
|------------------------------------------|
|  [Footer — pinned]                       |
+------------------------------------------+
```

### Zone 1: Navigation (pinned)

For choosers with categories (e.g., patterns), this contains
category pill buttons. For flat lists (e.g., kits with few
items), this zone may be omitted entirely — the content zone
fills the modal.

**Category pills:**

- Container: `flex flex-wrap gap-1.5`
- Label above: `text-[9px] uppercase tracking-[0.1em]
  text-neutral-500 font-bold mb-2`

Each pill:

| State | Classes |
|-------|---------|
| Default | `bg-neutral-800 text-neutral-300` → hover: `bg-neutral-700 text-neutral-100` |
| Selected (viewing) | `bg-orange-600 text-white` |
| Has active item | `bg-neutral-700 text-orange-400 border border-orange-600/40` |

- Padding: `px-3 py-1.5`
- Font: `text-sm font-semibold rounded-lg`
- Clicking selects/deselects (toggle behavior).

### Zone 2: Content (scrollable)

Separated from Zone 1 by a `border-top border-neutral-800`
divider.

- `flex-1 overflow-y-auto`
- Contains the item grid or list.

**Grid layout (for large collections):**

- CSS Grid, columns-first flow (`grid-auto-flow: column`
  with a fixed row count).
- Column width: `minmax(120px, 1fr)`.
- Each item is a button, full name displayed, truncated with
  ellipsis at ~16 characters.

| State | Classes |
|-------|---------|
| Default | `text-neutral-300` → hover: `bg-neutral-800 text-neutral-100` |
| Active (currently selected) | `text-orange-400 bg-neutral-800 font-semibold` |

- Padding: `px-2 py-1.5`
- Font: `text-sm rounded`

**Flat layout (for small collections):**

When there are few items (e.g., 2-10 with no categories),
use a single-column list of larger buttons instead of a grid:

- Full width, `px-3 py-2.5`
- Same color states as the grid items
- Optionally include a subtitle/description line in
  `text-xs text-neutral-500`

### Footer

- Separated by `border-top border-neutral-800`
- Padding: `pt-3 mt-4`
- Left: "Active: {name}" — `text-xs text-neutral-500` with
  the name in `text-orange-400 font-semibold`
- Right: "Esc to close" — `text-[10px] text-neutral-600`

## Behavior

| Action | Result |
|--------|--------|
| Trigger click | Open modal. Pre-select the category (if any) containing the active item. |
| Item click | Apply selection immediately (live preview/auditioning). Modal stays open. |
| Escape | Close modal. |
| Backdrop click | Close modal. |
| X button click | Close modal. |
| Category pill click | Show that category's items. Toggle off if already selected. |

Focus management:
- On open: move focus to the modal container.
- On close: return focus to the trigger button.
- Focus trap: out of scope for v1.

## Space Bar Interaction

The global Space bar handler toggles playback. When a chooser
modal is open, Space on a button inside the modal must NOT
toggle playback. The handler should suppress when
`event.target.closest('[role="dialog"]')` is truthy.

## Accessibility

| Element | Attribute |
|---------|-----------|
| Trigger button | `aria-haspopup="dialog"`, `aria-expanded={isOpen}` |
| Modal container | `role="dialog"`, `aria-label="{chooser name}"` |
| Item buttons | `role="option"`, `aria-selected={isActive}` |

## When to Use This Pattern

Use the chooser modal when:
- The native `<select>` has more than ~10 items, OR
- Items benefit from categorization or richer display, OR
- Live preview/auditioning on selection is desired.

Keep the native `<select>` when:
- There are fewer than ~10 items with no categories, AND
- No live preview behavior is needed.

## Adapting for the Drum Kit Selector

When the kit library grows beyond a handful of entries:

1. Replace the kit `<select>` with a chooser trigger button.
2. If kits have categories (e.g., "Classic", "Electronic",
   "Acoustic"), use the two-zone layout with category pills.
3. If kits remain a flat list, omit Zone 1 and use the flat
   layout in Zone 2.
4. The `onSelect` callback triggers `setKit()` which preloads
   samples — the modal should stay open while samples load,
   with a loading indicator on the selected item if needed.
5. Consider showing a brief loading state (spinner or pulse)
   since kit changes trigger async sample loading, unlike
   pattern changes which are synchronous.
