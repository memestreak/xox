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

One line: bump `setPatternLength` clamp from
`Math.min(16, length)` to `Math.min(64, length)`.

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

The drag handle for track length accounts for
`pageOffset` — dragging on page 2 sets lengths in the
17-32 range.

### RunningLight (modified)

New prop: `pageOffset`. Dot at position `i` represents
global step `pageOffset + i`.

### StepGrid (modified)

Receives `currentPage`, `pageOffset`, `setPage` from
parent. rAF loop checks page boundaries and calls
`setPage` when auto-follow is active. Passes `pageOffset`
to TrackRow and RunningLight.

### TransportControls (modified)

Pattern section grid column: `1fr` → `1.5fr`. Renders
`PageIndicator` inline after the pattern button.

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
