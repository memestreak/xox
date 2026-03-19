# 64-Step Support with Page Navigation

**Issue:** #29 — FR: Support up to 64 steps with page navigation
**Date:** 2026-03-19
**Status:** Approved

## Summary

Extend the sequencer from a fixed 16-step display to a
configurable length of 1-64 steps. Steps are displayed 16
at a time across pages, with page navigation dots in the
transport bar's Pattern section.

## Decisions

- **Step count control:** Existing Steps dropdown in
  GlobalControls, range extended from 1-16 to 1-64.
- **Page dots:** Inline right of the pattern button in the
  Pattern section (section widened from 1fr to 1.5fr).
  Always visible, even with a single page.
- **Auto-follow toggle:** Small "F" button above the page
  dots. On by default. When active, the visible page tracks
  the playhead during playback.
- **Preset patterns:** Padded with zeros when step count
  increases beyond 16.
- **Dot count:** Dynamic — one dot per page
  (`ceil(patternLength / 16)`).
- **Partial pages:** Last page shows 16 buttons; steps
  beyond `patternLength` are dimmed (same treatment as
  existing per-track length dimming).
- **Persistence:** `currentPage` and `autoFollow` are
  session-only state — not saved to URL hash.
- **Backward compatibility:** Not required. Existing URLs
  may break.

## Architecture: Approach 1 — Page State in Sequencer

Page state (`currentPage`, `autoFollow`) lives in the
`Sequencer` component, the common ancestor of
`TransportControls` and `StepGrid`. No new context needed.

### State & Data Flow

```
Sequencer (owns currentPage, autoFollow)
├── TransportControls
│   └── Pattern section
│       └── PageIndicator (dots + follow toggle)
└── StepGrid (receives pageOffset, calls setPage)
    ├── TrackRow × 11 (renders steps[offset..offset+16])
    └── RunningLight (dots shifted by pageOffset)
```

Derived values:
- `pageCount = Math.ceil(patternLength / 16)`
- `pageOffset = currentPage * 16`

Auto-follow runs in StepGrid's existing rAF loop. When
`autoFollow` is true and playing, `currentPage` updates
when `Math.floor(displayStep / 16) !== currentPage`.

### SequencerContext Change

Bump `setPatternLength` clamp from `Math.min(16, length)`
to `Math.min(64, length)`. The existing expansion logic
in `setPatternLength` (lines 576-605) already handles
step-string padding when track lengths grow — no further
changes needed, but the expansion path must be tested
with lengths beyond 16.

## UI Components

### PageIndicator (new)

Rendered inside the Pattern section of TransportControls.

Props: `currentPage`, `pageCount`, `autoFollow`,
`setPage`, `setAutoFollow`.

Contains:
- Follow toggle button ("F", orange when active,
  `aria-pressed`)
- Row of clickable dots (one per page, `aria-label`)

### TrackRow (modified)

New prop: `pageOffset`.

Step loop renders `steps[pageOffset..pageOffset+16]`.
Always 16 buttons. Step indices passed to `onToggleStep`
adjusted by `pageOffset`. Dimming adds:
`pageOffset + i >= patternLength`.

**Drag handle with paging:**

Visual position changes from `(trackLength / 16) * 100`
to `clamp((trackLength - pageOffset) / 16, 0, 1) * 100`.
When `trackLength <= pageOffset`, the handle is at 0%
(pinned left). When `trackLength >= pageOffset + 16`, it
is at 100% (pinned right / hidden).

`lengthFromPointer` changes its divisor from
`rect.width / patternLength` to `rect.width / 16` (page
size), then adds `pageOffset` to the computed raw step:
`Math.max(1, Math.min(patternLength, raw + pageOffset))`.

### RunningLight (modified)

New prop: `pageOffset`. Dot at position `i` represents
global step `pageOffset + i`. The highlight condition
changes from `i === currentStep` to
`pageOffset + i === currentStep`. The dimming condition
changes from `i >= patternLength` to
`pageOffset + i >= patternLength`.

### StepGrid (modified)

Receives `currentPage`, `pageOffset`, `autoFollow`,
`setPage` from parent. The rAF loop checks page
boundaries and calls `setPage` when auto-follow is
active. `autoFollow` is mirrored to a `useRef` inside
StepGrid (like `fillActiveRef` in SequencerContext) so
the rAF closure always reads the current value without
restarting the animation loop.

`useDragPaint` receives a new `pageOffset` parameter.
Step indices from pointer positions are offset by
`pageOffset` before calling `onSetStep`.

Passes `pageOffset` to TrackRow and RunningLight.

### TransportControls (modified)

Pattern section grid column: `1fr` → `1.5fr`.
`PageIndicator` is rendered by `Sequencer` as a sibling
passed into TransportControls (or the Pattern section
directly), avoiding re-render of the memoized
TransportControls on every page change. The exact
threading (render prop, slot prop, or direct sibling)
is an implementation detail — the key constraint is
that page-state changes must not trigger a full
TransportControls re-render.

### GlobalControls (modified)

Steps dropdown range: `{ length: 16 }` → `{ length: 64 }`.

## Edge Cases

**Reducing step count while on a later page:**
`currentPage` clamps to `pageCount - 1` when
`patternLength` changes.

**Per-track length + paging:**
Track-level dimming works as today. On page 2+, a track
with `trackLength: 8` has all steps dimmed since
`pageOffset + i >= trackLength`.

**Pattern loading:**
Preset patterns (16-char strings) pad with zeros for
steps beyond 16. `validateSteps` in configCodec already
handles this.

## Testing

### Unit Tests

- `StepGrid` / `TrackRow`: correct steps render for each
  page offset
- `PageIndicator`: dot count matches `pageCount`, click
  updates `currentPage`, follow toggle works
- `RunningLight`: dots shift by page offset
- `GlobalControls`: dropdown goes to 64
- `SequencerContext`: `setPatternLength` accepts up to 64,
  page clamps when length reduces

### Integration Tests

- Set steps to 32, verify page 2 shows empty steps
- Toggle steps on page 2, switch back to page 1, verify
  page 1 unchanged
- Reduce step count while on later page, verify clamping

### Browser Verification

- Playback across page boundaries with auto-follow
- Partial last page (e.g., 24 steps) dimming
- Mobile layout with wider pattern section
