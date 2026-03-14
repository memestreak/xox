# Mobile Responsive Design for XOX Drum Sequencer

## Context

XOX has zero mobile responsiveness. The fixed 192px sidebar,
rigid 16-column grid, and hardcoded dimensions make the app
unusable on screens below ~800px. This spec defines a
mobile-first responsive layout that makes the full sequencer
functional on phones and tablets while preserving the existing
desktop experience.

## Requirements

1. Full sequencer editing on phone screens (375px+)
2. All 11 tracks accessible with tappable step buttons
3. Mute/solo controls available per track
4. Volume control available via separate mixer panel
5. Playback controls (play/stop, BPM) always visible
6. Kit and pattern selection always accessible
7. Desktop layout unchanged above 1024px breakpoint

## Design

### Breakpoint Strategy

Single breakpoint at **1024px** (`lg` in Tailwind):
- `>= 1024px`: Current desktop layout (no changes)
- `< 1024px`: Mobile layout described below

This captures phones, small tablets, and tablets in portrait.
The 1024px threshold ensures all touch-only devices get
touch-optimized controls.

### Mobile Layout: Sticky Header

The header becomes sticky and compact, containing all
top-level controls in two rows:

**Row 1:** XOX logo (left), BPM input + play/stop button
(right)

**Row 2:** Kit selector (left half), Pattern selector
(right half) in a 2-column grid

The kit/pattern selectors collapse from the current large
card-style dropdowns into compact inline selects. Total
sticky height: ~80px.

### Mobile Layout: Track Grid (2x8)

Each track renders as:

```
[Track Name]                    [M] [S]
[step1][step2]...[step8]    <- row 1 (beats 1-2)
[step9][step10]...[step16]  <- row 2 (beats 3-4)
```

- Track name and M/S buttons appear in a flex row above
  the step grid
- 16 steps split into two rows of 8
- Each step button is `flex-1` within the 8-column grid,
  yielding ~35-40px tap targets on a 375px screen
- Gap between steps: 3px (`gap-0.75` or custom)
- Step height: 32px (reduced from desktop's 48px)
- Beat-group border marking: apply left border where
  `positionInRow % 4 === 0` (positions 0 and 4 in each
  row, corresponding to step indices 0, 4, 8, 12). This
  produces the same visual grouping as the desktop layout.
- The volume knob is removed from inline display

All 11 tracks scroll vertically beneath the sticky header.

### Mobile Layout: Running Light

The step indicator adapts to 2x8. On mobile, the running
light dots appear in two rows of 8, matching the step grid
layout. The `w-48` track-info spacer `div` in the running
light row is hidden on mobile (via `hidden lg:block`).

### Mobile Layout: Mixer Panel

Volume controls move to a dedicated mixer panel toggled by
a "Mixer" button below the track list:

**Mixer toggle button:** Full-width, `bg-neutral-800`
with `border border-neutral-700`, rounded-lg, centered
"MIXER" text in 10px uppercase bold, neutral-400 color.
Appears after the last track, outside the grid section's
rounded container.

- Each track row shows: name, M/S buttons, horizontal
  volume slider
- Slider replaces the SVG knob for better touch UX
- M/S buttons are duplicated here (larger, ~26px) for
  easier access

**Back to Sequencer button:** Full-width, `bg-orange-600`,
rounded-lg, centered "BACK TO SEQUENCER" text in white,
10px uppercase bold. Appears at the bottom of the mixer
panel.

**Playback during mixer view:** Audio playback continues
uninterrupted. The running light and step highlighting
are not visible while the mixer is open (audio-only
feedback). This is acceptable since the mixer is for
quick volume/mute adjustments.

Implementation: conditional rendering via React state
(`showMixer`), not a separate route. The mixer panel
replaces the grid in the DOM when active.

### Mobile Layout: Padding & Spacing

- Main container padding: `p-3` (reduced from `p-8`)
- Grid section padding: `p-3` (reduced from `p-6`)
- Track vertical spacing: `space-y-2` (reduced from
  `space-y-4`)
- `max-w-4xl` constraint removed on mobile (full width)

### Touch Targets

Most interactive elements target 44px minimum (WCAG), with
documented exceptions for the dense step grid:

- Step buttons: ~35px wide x 32px tall. Below the 44px
  guideline, but acceptable because adjacent misses still
  toggle a valid step (no dead zones in the grid).
- M/S buttons: 22px rendered size with 11px padding on
  each side for a 44px effective touch target.
- Play/stop button: same size as desktop (well above 44px)
- Volume sliders (mixer): full-width with 16px thumb,
  44px effective target via padding

### Viewport Configuration

Add a `viewport` export to `layout.tsx` (Next.js App Router
uses exports, not raw meta tags):

```typescript
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

This enables `viewport-fit=cover` for safe area inset
support on notched phones.

### Safe Area Insets

The sticky header must account for the notch/dynamic
island on iOS. Apply safe-area-aware padding:

```
padding-top: env(safe-area-inset-top)
padding-left: env(safe-area-inset-left)
padding-right: env(safe-area-inset-right)
```

In Tailwind, use `pt-[env(safe-area-inset-top)]` or add
a small utility in `globals.css` if needed.

## Files to Modify

- `src/app/Sequencer.tsx` — main layout changes, mobile
  grid, mixer panel, responsive classes
- `src/app/layout.tsx` — viewport meta tag
- `src/app/TempoController.tsx` — responsive sizing
- `src/app/globals.css` — safe area inset utilities if
  needed. Note: `grid-cols-8` is available in Tailwind v4
  out of the box (no custom utility needed).

## Files to Create

- None anticipated. All changes are responsive variants
  within existing components.

## Out of Scope

- Desktop layout changes
- New components or pages
- Landscape-specific optimizations
- PWA / offline support
- Touch gestures (swipe, pinch-to-zoom)

## Verification

1. Run `npm run dev` and open on desktop — confirm no
   visual changes at widths >= 1024px
2. Open Chrome DevTools responsive mode at 375px (iPhone
   SE) — verify:
   - Sticky header with BPM + play/stop visible
   - Kit/pattern selectors accessible
   - All 11 tracks visible via scroll
   - Step buttons tappable (2x8 grid)
   - M/S buttons functional per track
   - Mixer panel opens/closes
   - Volume sliders work in mixer
   - Running light animates in 2x8 during playback
3. Test at 768px (iPad portrait) — same mobile layout
4. Test at 1024px — should show desktop layout
5. Run `npm run lint` — zero errors
6. Run `npm run build` — successful static export
