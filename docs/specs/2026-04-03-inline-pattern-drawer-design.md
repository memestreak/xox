# Inline Pattern Drawer

**Date:** 2026-04-03
**Status:** Approved

## Context

The pattern picker is currently a centered modal dialog that
blocks interaction with the rest of the app. This forces
users to choose between browsing patterns and interacting
with the sequencer — they can't watch the step grid animate,
change the pattern mode, or tweak other controls while
auditioning patterns. The goal is to replace the modal with
an inline drawer that keeps the full app accessible.

## Design

### Layout

The pattern drawer is a flex child inserted between the
header (`<TransportControls>`) and the scroll container
(step grid) in `Sequencer.tsx`. When closed, it collapses
to zero height (always mounted, CSS-driven). When open, it
expands in-place, pushing the step grid down. The grid's
scrollable area naturally shrinks to accommodate.

```
┌─────────────────────────────────┐
│ Header Row 1 (logo, BPM, play) │
│ Header Row 2 (controls, pattern)│
├─────────────────────────────────┤
│ Pattern Drawer (when open)      │  ← NEW
│  ┌ Category pills ────────────┐ │
│  │ [Afro-Cuban] [Funk] [House]│ │
│  ├────────────────────────────┤ │
│  │ Pattern grid (scrollable)  │ │
│  │ Bossa Nova  Mambo  Songo   │ │
│  └────────────────────────────┘ │
├─────────────────────────────────┤
│ Step Grid (scrollable)          │
│  AC ○○○○●○○○○○○○●○○○           │
│  BD ●○○●○○●○○○●○○○○○           │
│  SD ○○○○●○○○○○○○●○○○           │
│  ...                            │
└─────────────────────────────────┘
```

No z-index layering, portals, or fixed positioning. The
drawer is a normal document-flow element.

### Trigger

The existing pattern name button in the header toggles
the drawer open/closed. Visual states:

- **Closed:** Neutral background (`bg-neutral-800`),
  displays pattern name (e.g., "Bossa Nova").
- **Open:** Orange background (`bg-orange-600`), displays
  pattern name with an upward chevron indicator (▲).

### Drawer Content

Two zones, matching the current modal layout:

1. **Category pills (pinned top):** Horizontal flex-wrap
   row of category buttons. Selected category highlighted
   in orange. Clicking a selected category deselects it.
   Active pattern's category gets a subtle ring indicator.

2. **Pattern grid (scrollable):** CSS grid with
   `gridAutoFlow: 'column'`, same as today. Only shown
   when a category is selected. Active pattern highlighted
   in orange.

The modal's footer ("Active: X / Esc to close") is removed
— the active pattern name is already visible in the trigger
button, and Escape is a standard dismissal pattern that
doesn't need a hint in an inline context.

### Drawer Stays Open After Selection

Selecting a pattern does NOT close the drawer. The user
can audition multiple patterns in a row, matching the
current modal behavior. The drawer is explicitly closed
via the trigger button or Escape.

### Custom Pattern Behavior

When the user edits a step while the drawer is open
(making the pattern "Custom"), the active-pattern
highlight disappears from the pattern grid (since no
preset matches). The drawer stays open on the same
category — no auto-close or category deselection.

### Height Management

- Fixed max height: `max-h-[200px]`.
- The pattern grid scrolls internally within this
  constraint.
- Category pills are always visible at the top of the
  drawer (not scrolled).

### Dismiss

The drawer closes via:
1. Clicking the pattern button again (toggle).
2. Pressing Escape.

No backdrop needed since the drawer is inline and doesn't
overlay anything.

**Escape priority:** When both the drawer and a StepPopover
are open, Escape closes both simultaneously. This is
acceptable — both register document-level Escape handlers
and both fire. No stopPropagation needed.

### Animation

CSS transition on the drawer wrapper:
- Property: `max-height` and `opacity`.
- Duration: **100ms** ease-out.
- Open: transition from `max-h-0 opacity-0` to
  `max-h-[200px] opacity-100`.
- Close: reverse.
- `overflow: hidden` on the wrapper during transition
  to prevent content flash.
- Use `motion-safe:` Tailwind prefix so reduced-motion
  users get instant open/close (consistent with existing
  `motion-safe:` usage on StepButton).

### Mount Strategy

The drawer is **always mounted** in the DOM (not
conditionally rendered). CSS `max-height: 0` +
`overflow: hidden` collapses it when closed. Add
`aria-hidden="true"` when collapsed so screen readers
ignore the hidden content.

### Focus Management

- On open: focus moves to the drawer container (same as
  current modal behavior with `tabIndex={-1}`).
- On close: focus returns to the pattern trigger button
  (via `triggerRef`).
- Space key suppression preserved on the drawer's
  `onKeyDown` (prevents global play/stop toggle while
  interacting with drawer buttons).

### Accessibility

- `role="region"` with `aria-label="Pattern browser"`.
- `aria-hidden="true"` when drawer is collapsed.
- Pattern button: `aria-expanded={isOpen}`. Remove
  `aria-haspopup="dialog"` (no longer a dialog).
- Category/pattern buttons retain existing roles and
  aria attributes.

## Architecture

**Render-prop pattern.** `PatternPicker` keeps ownership
of its internal state (`isOpen`, `selectedCategory`) and
exposes two rendered pieces — the trigger button and the
drawer content — via a render-prop (children function).
`Sequencer.tsx` controls where each piece lands in the
layout without owning the drawer state.

```tsx
// Conceptual API
<PatternPicker
  categories={categories}
  currentPattern={currentPattern}
  onSelect={setPattern}
>
  {({ trigger, drawer }) => (
    <>
      <TransportControls
        patternTrigger={trigger}
        ...
      />
      {drawer}
      <ScrollContainer>
        <StepGrid ... />
      </ScrollContainer>
    </>
  )}
</PatternPicker>
```

**Why render-prop over prop-drilling:** The open/close
state is an internal concern of PatternPicker. Lifting it
to Sequencer would scatter pattern-picker logic across
components for no benefit. The render-prop keeps state
co-located while letting the parent control layout
placement.

**TransportControls change:** Instead of importing and
rendering PatternPicker directly, it receives the trigger
element as a prop (`patternTrigger: ReactNode`) and places
it in the Pattern box area.

## Files to Modify

- **`src/app/PatternPicker.tsx`** — Refactor to render-prop
  pattern. Replace modal markup (backdrop, fixed
  positioning, z-index, footer) with inline drawer markup
  (CSS transition wrapper, `aria-hidden`, `role="region"`).
  Export children-function API returning `{ trigger,
  drawer }`. Remove `aria-haspopup="dialog"` from trigger.
- **`src/app/Sequencer.tsx`** — Wrap layout in
  `<PatternPicker>` render-prop. Place `trigger` inside
  `TransportControls` and `drawer` between header and
  scroll container.
- **`src/app/TransportControls.tsx`** — Accept
  `patternTrigger: ReactNode` prop instead of rendering
  PatternPicker directly. Place it in the Pattern box.
- **`src/__tests__/PatternPicker.test.tsx`** — Rewrite
  modal-specific assertions: remove `role="dialog"`
  queries, backdrop-click tests, and fixed-positioning
  assumptions. Add drawer-specific tests: `aria-hidden`
  toggling, `aria-expanded` on trigger, CSS transition
  classes, region role.
- **`src/__tests__/TransportControls.test.tsx`** — Update
  integration test that checks for `role="dialog"`.

## What This Does NOT Change

- Pattern selection logic (`setPattern`, pattern modes,
  temp mode) — untouched.
- Pattern data model, categorization, or utilities —
  untouched.
- Step grid rendering or interaction — untouched.
- Mobile behavior — same inline drawer at all screen
  sizes.
- Keyboard shortcut handling — same Space suppression.

## Verification

1. Toggle drawer open/close via pattern button — confirm
   smooth 100ms animation.
2. Confirm `prefers-reduced-motion` is respected (instant
   open/close when enabled).
3. Select a category, click a pattern — confirm it loads
   and plays correctly.
4. Select multiple patterns in a row — confirm drawer
   stays open.
5. Edit a step while drawer is open — confirm pattern
   becomes "Custom", highlight disappears from grid,
   drawer stays open on same category.
6. While drawer is open: confirm all header controls
   (BPM, play/stop, kit, mode, fill, settings) remain
   interactive.
7. While drawer is open and playing: confirm step grid
   is visible below and running light animates.
8. Open both drawer and StepPopover, press Escape —
   confirm both close.
9. Press Escape with only drawer open — confirm drawer
   closes and focus returns to pattern button.
10. Check `aria-hidden` toggles correctly with drawer
    state.
11. Open drawer on mobile viewport — confirm it works,
    grid is still partially visible below.
12. Run `npm test` — all existing tests pass.
13. Run `npm run lint` — zero lint errors.
14. Run `npm run build` — static export succeeds.
