---
date: 2026-03-19
summary: >
  Implement shift+drag vertical pattern cycling on the
  step grid, allowing users to quickly populate a single
  track with curated beat patterns.
---

# Shift+Drag Pattern Cycling Implementation Plan

> **For agentic workers:** REQUIRED: Use
> subagent-driven-development (if subagents available) or
> executing-plans to implement this plan. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shift+drag gesture that cycles through
curated beat patterns on a single track, with live
preview and audio auditioning.

**Architecture:** Extend `useDragPaint` with a new
"pattern cycling" mode triggered by shift+pointerdown
(mouse) or long-press+drag (touch). A universal set of
patterns in `trackPatterns.json` is cycled by absolute
vertical drag distance. State is mutated for live
preview and restored on cancel.

**Tech Stack:** React 19, TypeScript strict, Vitest,
Next.js 16, Tailwind CSS v4

**Spec:**
`docs/specs/2026-03-19-shift-drag-pattern-cycling-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/types.ts` | Modify | Add `TrackPattern` interface |
| `src/app/data/trackPatterns.json` | Create | Universal pattern array |
| `src/app/SequencerContext.tsx` | Modify | Add `setTrackSteps` action |
| `src/app/useDragPaint.ts` | Modify | Add pattern cycling mode |
| `src/app/StepButton.tsx` | Modify | Set `longPressActiveRef` on long-press |
| `src/app/StepGrid.tsx` | Modify | Wire patterns, ref, popover guard |
| `src/__tests__/trackPatterns.test.ts` | Create | Data integrity tests |
| `src/__tests__/SequencerContext.test.tsx` | Modify | Test `setTrackSteps` |
| `src/__tests__/useDragPaint.test.tsx` | Modify | Test pattern cycling mode |

---

### Task 1: Add `TrackPattern` type

**Files:**
- Modify: `src/app/types.ts`

- [ ] **Step 1: Add the TrackPattern interface**

After the `Pattern` interface (~line 40), add:

```typescript
/**
 * A single per-track beat pattern used by the
 * shift+drag pattern cycling gesture.
 */
export interface TrackPattern {
  id: string;
  name: string;
  steps: string; // 16-char binary string
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS, no errors

- [ ] **Step 3: Commit**

```
git add src/app/types.ts
git commit -m "Add TrackPattern type for pattern cycling"
```

---

### Task 2: Create `trackPatterns.json`

**Files:**
- Create: `src/app/data/trackPatterns.json`
- Create: `src/__tests__/trackPatterns.test.ts`

- [ ] **Step 1: Write the data integrity test**

Create `src/__tests__/trackPatterns.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import data from '../app/data/trackPatterns.json';
import type { TrackPattern } from '../app/types';

const patterns: TrackPattern[] = data.patterns;

describe('trackPatterns.json', () => {
  it('has at least one pattern', () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('every pattern has a 16-char binary steps string',
    () => {
      for (const p of patterns) {
        expect(p.steps).toMatch(/^[01]{16}$/);
      }
    }
  );

  it('every pattern has a unique id', () => {
    const ids = patterns.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pattern has a non-empty name', () => {
    for (const p of patterns) {
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('patterns are ordered by density '
    + '(non-decreasing note count)', () => {
      const counts = patterns.map(
        p => p.steps.split('')
          .filter(c => c === '1').length
      );
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(
          counts[i - 1]
        );
      }
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/trackPatterns.test.ts`
Expected: FAIL (file not found)

- [ ] **Step 3: Create the pattern data file**

Create `src/app/data/trackPatterns.json`:

```json
{
  "patterns": [
    {
      "id": "whole-note",
      "name": "Whole Note",
      "steps": "1000000000000000"
    },
    {
      "id": "half-notes",
      "name": "Half Notes",
      "steps": "1000000010000000"
    },
    {
      "id": "quarter-notes",
      "name": "Quarter Notes",
      "steps": "1000100010001000"
    },
    {
      "id": "dotted-eighth",
      "name": "Dotted Eighth",
      "steps": "1001001001001001"
    },
    {
      "id": "offbeat-quarters",
      "name": "Offbeat Quarters",
      "steps": "0000100000001000"
    },
    {
      "id": "eighth-notes",
      "name": "Eighth Notes",
      "steps": "1010101010101010"
    },
    {
      "id": "offbeat-eighths",
      "name": "Offbeat Eighths",
      "steps": "0101010101010101"
    },
    {
      "id": "shuffle",
      "name": "Shuffle",
      "steps": "1001101001011010"
    },
    {
      "id": "syncopated",
      "name": "Syncopated",
      "steps": "1010011010100110"
    },
    {
      "id": "sixteenth-notes",
      "name": "Sixteenth Notes",
      "steps": "1111111111111111"
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/trackPatterns.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/app/data/trackPatterns.json \
  src/__tests__/trackPatterns.test.ts
git commit -m "Add universal track patterns data file"
```

---

### Task 3: Add `setTrackSteps` action

**Files:**
- Modify: `src/app/SequencerContext.tsx`
- Modify: `src/__tests__/SequencerContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/SequencerContext.test.tsx`, in the
appropriate `describe` block:

```typescript
it('setTrackSteps replaces full step string', () => {
  const { result } = renderHook(
    () => useSequencer(), { wrapper }
  );
  act(() => {
    result.current.actions.setTrackSteps(
      'bd', '1010101010101010'
    );
  });
  expect(
    result.current.state.currentPattern.steps.bd
  ).toBe('1010101010101010');
});

it('setTrackSteps sets selectedPatternId to custom',
  () => {
    const { result } = renderHook(
      () => useSequencer(), { wrapper }
    );
    act(() => {
      result.current.actions.setTrackSteps(
        'bd', '1010101010101010'
      );
    });
    expect(
      result.current.state.selectedPatternId
    ).toBe('custom');
  }
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/SequencerContext.test.tsx -t "setTrackSteps"`
Expected: FAIL (setTrackSteps not defined)

- [ ] **Step 3: Add `setTrackSteps` to the interface**

In `src/app/SequencerContext.tsx`, add to the
`SequencerActions` interface (~line 77):

```typescript
setTrackSteps: (
  trackId: TrackId, steps: string
) => void;
```

- [ ] **Step 4: Implement `setTrackSteps`**

Add after the `setStep` callback (~line 547):

```typescript
const setTrackSteps = useCallback(
  (trackId: TrackId, newSteps: string) => {
    setConfig(prev => {
      if (
        newSteps === prev.steps[trackId]
      ) {
        return prev;
      }
      return {
        ...prev,
        steps: {
          ...prev.steps,
          [trackId]: newSteps,
        },
      };
    });
    setSelectedPatternId('custom');
  },
  []
);
```

- [ ] **Step 5: Expose in the actions object**

Find the actions object in the provider return (~line
920) and add `setTrackSteps` alongside the other step
actions.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/__tests__/SequencerContext.test.tsx -t "setTrackSteps"`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```
git add src/app/SequencerContext.tsx \
  src/__tests__/SequencerContext.test.tsx
git commit -m "Add setTrackSteps action for bulk step updates"
```

---

### Task 4: Add pattern cycling to `useDragPaint`

This is the core task. The hook gains a new mode:
when shift is held (mouse) or long-press ref is set
(touch), vertical drag cycles through patterns instead
of painting cells.

**Files:**
- Modify: `src/app/useDragPaint.ts`
- Modify: `src/__tests__/useDragPaint.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these tests to
`src/__tests__/useDragPaint.test.tsx`:

```typescript
describe('pattern cycling mode', () => {
  const patterns = [
    {
      id: 'quarter', name: 'Quarter',
      steps: '1000100010001000',
    },
    {
      id: 'eighth', name: 'Eighth',
      steps: '1010101010101010',
    },
  ];

  it('shift+drag enters pattern cycling mode', () => {
    const onSetStep = vi.fn();
    const onSetTrackSteps = vi.fn();
    // ... setup with patterns prop
    // shift+pointerdown on bd step 0
    // drag vertically 25px
    // expect onSetTrackSteps called with bd
    //   and a pattern string
  });

  it('position 0 is current state (no-op)', () => {
    // shift+pointerdown, no drag
    // pointerup
    // expect onSetTrackSteps NOT called
  });

  it('position 1 is clear from click onward', () => {
    // shift+pointerdown on step 4
    // drag 25px vertically
    // expect steps 0-3 preserved,
    //   steps 4-15 cleared
  });

  it('absolute distance determines pattern index',
    () => {
      // drag up 25px → position 1 (clear)
      // drag up 45px → position 2 (quarter)
      // drag down 25px → also position 1
    }
  );

  it('wraps around after last pattern', () => {
    // drag far enough to exceed pattern count
    // expect wrap back to position 0
  });

  it('escape cancels and restores original', () => {
    // shift+drag to change pattern
    // press Escape
    // expect onSetTrackSteps called with
    //   original snapshot
  });

  it('click-aligned: pattern starts at click',
    () => {
      // shift+click on step 4, drag to quarter
      // expect steps 4-15 = pattern[0..11]
    }
  );

  it('respects track length', () => {
    // track length = 8, click on step 2
    // drag to apply pattern
    // expect only steps 2-7 changed
  });

  it('blocked when popover is open', () => {
    // set popoverOpenRef.current = true
    // shift+drag
    // expect no onSetTrackSteps calls
  });

  it('touch: long-press ref triggers cycling',
    () => {
      // set longPressActiveRef.current = true
      // pointerdown (touch), drag vertically 15px
      //   (> 10px threshold)
      // expect pattern cycling mode
    }
  );

  it('touch: without long-press ref, normal paint',
    () => {
      // longPressActiveRef.current = false
      // pointerdown (touch), drag
      // expect normal drag-paint behavior
    }
  );
});
```

NOTE: The exact test implementations will need the
same mock DOM helpers (`makeMockDOM`,
`mockElementFromPoint`, `makePointerEvent`) already
present in the test file. Adapt the setup from
existing tests. The key new props to pass to
`useDragPaint` are `patterns`, `onSetTrackSteps`,
`longPressActiveRef`, and `popoverOpenRef`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/useDragPaint.test.tsx -t "pattern cycling"`
Expected: FAIL

- [ ] **Step 3: Extend the hook interface**

In `src/app/useDragPaint.ts`, update
`UseDragPaintOptions`:

```typescript
interface UseDragPaintOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  trackOrder: TrackId[];
  trackLengths: Record<TrackId, number>;
  steps: Record<TrackId, string>;
  onSetStep: (
    trackId: TrackId,
    stepIndex: number,
    value: '0' | '1'
  ) => void;
  // Pattern cycling additions:
  patterns: TrackPattern[];
  onSetTrackSteps: (
    trackId: TrackId, steps: string
  ) => void;
  longPressActiveRef: RefObject<boolean>;
  popoverOpenRef: RefObject<boolean>;
}
```

Import `TrackPattern` from `./types`.

- [ ] **Step 4: Extend `DragState`**

```typescript
interface DragState {
  active: boolean;
  dragged: boolean;
  startX: number;
  startY: number;
  pointerId: number;
  paintValue: '0' | '1';
  lastTrackIdx: number;
  lastStep: number;
  // Pattern cycling state:
  cyclingMode: boolean;
  cycleTrackId: TrackId | null;
  cycleStartStep: number;
  cycleSnapshot: string; // original step string
  cyclePatternIdx: number; // current position
}
```

Initialize the new fields to defaults in the
`useRef` initializer.

- [ ] **Step 5: Implement `applyPatternAtIndex`**

Add a helper inside the hook that computes the new
step string for a given pattern index:

```typescript
const applyPatternAtIndex = useCallback(
  (
    trackId: TrackId,
    startStep: number,
    snapshot: string,
    patternIdx: number
  ): string => {
    const trackLen = trackLengths[trackId];
    const prefix = snapshot.substring(0, startStep);

    if (patternIdx === 0) {
      // Position 0: current state (snapshot)
      return snapshot;
    }
    if (patternIdx === 1) {
      // Position 1: clear from startStep onward
      return prefix
        + '0'.repeat(trackLen - startStep);
    }
    // Position 2+: apply pattern
    const pat = patterns[patternIdx - 2];
    const fill = pat.steps
      .substring(0, trackLen - startStep);
    return prefix + fill;
  },
  [trackLengths, patterns]
);
```

- [ ] **Step 6: Modify `onPointerDown`**

After the existing `drag.active = true` setup, add
cycling mode detection:

```typescript
const isShift = e.pointerType === 'mouse'
  && e.shiftKey;
const isLongPress = e.pointerType !== 'mouse'
  && longPressActiveRef.current;

if (
  (isShift || isLongPress)
  && !popoverOpenRef.current
  && patterns.length > 0
) {
  drag.cyclingMode = true;
  drag.cycleTrackId = trackId;
  drag.cycleStartStep = stepIndex;
  drag.cycleSnapshot = steps[trackId];
  drag.cyclePatternIdx = 0;
  return; // don't set up paint mode
}

drag.cyclingMode = false;
```

- [ ] **Step 7: Modify `onPointerMove`**

Inside the move handler, after the threshold check,
add a branch for cycling mode:

```typescript
if (drag.cyclingMode) {
  const dy = Math.abs(
    e.clientY - drag.startY
  );
  const threshold = e.pointerType === 'mouse'
    ? DRAG_THRESHOLD : 10;
  if (!drag.dragged && dy < threshold) return;
  if (!drag.dragged) {
    drag.dragged = true;
    try {
      container.setPointerCapture(
        drag.pointerId
      );
    } catch { /* */ }
    // Add escape listener
    const escHandler = (ke: KeyboardEvent) => {
      if (ke.key === 'Escape') {
        onSetTrackSteps(
          drag.cycleTrackId!,
          drag.cycleSnapshot
        );
        drag.active = false;
        drag.dragged = false;
        drag.cyclingMode = false;
        document.removeEventListener(
          'keydown', escHandler
        );
      }
    };
    document.addEventListener(
      'keydown', escHandler
    );
    // Store for cleanup
    (drag as DragState & {
      _escHandler?: (e: KeyboardEvent) => void
    })._escHandler = escHandler;
  }

  // Calculate pattern index from distance
  const totalPositions = patterns.length + 2;
  // +2 for position 0 (current) and 1 (clear)
  const rawIdx = Math.floor(dy / 20);
  const idx = rawIdx % totalPositions;

  if (idx !== drag.cyclePatternIdx) {
    drag.cyclePatternIdx = idx;
    const newSteps = applyPatternAtIndex(
      drag.cycleTrackId!,
      drag.cycleStartStep,
      drag.cycleSnapshot,
      idx
    );
    onSetTrackSteps(
      drag.cycleTrackId!, newSteps
    );
  }
  return;
}
```

- [ ] **Step 8: Modify `onPointerUp`**

Add cycling mode cleanup before the existing logic:

```typescript
if (drag.cyclingMode) {
  // Remove escape listener
  const esc = (drag as DragState & {
    _escHandler?: (e: KeyboardEvent) => void
  })._escHandler;
  if (esc) {
    document.removeEventListener(
      'keydown', esc
    );
  }
  // If not dragged, it's a no-op
  //   (position 0 = current)
  // If dragged, state is already mutated
  //   to the selected pattern — leave it.
  drag.active = false;
  drag.dragged = false;
  drag.cyclingMode = false;

  // Release pointer capture
  if (container) {
    try {
      container.releasePointerCapture(
        drag.pointerId
      );
    } catch { /* */ }
  }

  // Suppress click (same as paint mode)
  if (wasDragged && container) {
    container.addEventListener(
      'click',
      (evt) => evt.stopPropagation(),
      { once: true, capture: true }
    );
  }
  return;
}
```

- [ ] **Step 9: Run tests**

Run: `npm test -- src/__tests__/useDragPaint.test.tsx`
Expected: All tests PASS (both existing and new)

- [ ] **Step 10: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 11: Commit**

```
git add src/app/useDragPaint.ts \
  src/__tests__/useDragPaint.test.tsx
git commit -m "Add pattern cycling mode to useDragPaint"
```

---

### Task 5: Wire up StepButton long-press ref

**Files:**
- Modify: `src/app/StepButton.tsx`

- [ ] **Step 1: Add `longPressActiveRef` prop**

Add to `StepButtonProps`:

```typescript
longPressActiveRef?: RefObject<boolean>;
```

- [ ] **Step 2: Set the ref on long-press fire**

Modify the `useLongPress` callback (~line 64):

```typescript
const longPress = useLongPress(
  () => {
    navigator.vibrate?.(10);
    if (longPressActiveRef?.current !== undefined) {
      longPressActiveRef.current = true;
    }
    openPopover();
  },
  {
    threshold: 500,
    cancelOnMovement: 5,
  }
);
```

Note: The popover still opens on long-press+release.
If useDragPaint detects a subsequent drag, the
popover guard in StepGrid will prevent it from
interfering (the popover won't be rendered until
state updates, and by then the drag has started).

- [ ] **Step 3: Clear the ref on pointer up**

Add an `onPointerUp` handler to the button that
clears the ref. Since `useLongPress` already
manages pointer events, add this alongside:

After the `{...longPress()}` spread, the onClick
handler already handles pointerUp timing. Add a
cleanup in the component body:

```typescript
const handlePointerUp = useCallback(() => {
  if (longPressActiveRef?.current !== undefined) {
    longPressActiveRef.current = false;
  }
}, [longPressActiveRef]);
```

Spread `onPointerUp={handlePointerUp}` on the
button element. Note: this needs to coexist with
`useLongPress` event handlers. Since `useLongPress`
spreads its handlers via `{...longPress()}`, and our
handler is set separately, verify there's no
conflict. If `longPress()` returns an
`onPointerUp`, you may need to compose them.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/StepButton.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add src/app/StepButton.tsx
git commit -m "Set longPressActiveRef on StepButton long-press"
```

---

### Task 6: Wire everything in StepGrid

**Files:**
- Modify: `src/app/StepGrid.tsx`

- [ ] **Step 1: Import pattern data and create refs**

At the top of `StepGrid.tsx`:

```typescript
import trackPatternData
  from './data/trackPatterns.json';
import type { TrackPattern } from './types';

const TRACK_PATTERNS: TrackPattern[] =
  trackPatternData.patterns;
```

Inside the component, add refs:

```typescript
const longPressActiveRef = useRef(false);
const popoverOpenRef = useRef(false);
```

Keep `popoverOpenRef` in sync with the `openPopover`
state:

```typescript
popoverOpenRef.current = openPopover !== null;
```

- [ ] **Step 2: Pass new props to `useDragPaint`**

Update the `useDragPaint` call (~line 45):

```typescript
const dragPaint = useDragPaint({
  containerRef: dragContainerRef,
  trackOrder: TRACK_ORDER,
  trackLengths,
  steps: currentPattern.steps,
  onSetStep: setStep,
  patterns: TRACK_PATTERNS,
  onSetTrackSteps: actions.setTrackSteps,
  longPressActiveRef,
  popoverOpenRef,
});
```

Extract `setTrackSteps` from actions at the
destructuring site (~line 38).

- [ ] **Step 3: Pass `longPressActiveRef` to TrackRow**

The ref needs to reach `StepButton`. Pass it through
`TrackRow`:

```typescript
<TrackRow
  ...existing props...
  longPressActiveRef={longPressActiveRef}
/>
```

Update `TrackRow` props to accept and forward
`longPressActiveRef` to each `StepButton`.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add src/app/StepGrid.tsx src/app/TrackRow.tsx
git commit -m "Wire pattern cycling through StepGrid"
```

---

### Task 7: Browser testing

**Files:** None (manual verification)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test mouse shift+drag**

1. Open the app in a browser
2. Ensure at least one track has some active steps
3. Hold Shift, click on a step cell
4. Drag vertically (up or down)
5. Verify: steps after the click point update live
   as you drag through patterns
6. Verify: dragging further cycles through patterns
   in density order
7. Verify: releasing commits the pattern
8. Verify: if playback is running, the pattern is
   audible during preview

- [ ] **Step 3: Test position 0 (no-op)**

1. Hold Shift, click a step
2. Release without dragging
3. Verify: no change to the track

- [ ] **Step 4: Test Escape cancel**

1. Hold Shift, click and drag to apply a pattern
2. Press Escape while still holding mouse
3. Verify: track reverts to original state

- [ ] **Step 5: Test with popover open**

1. Right-click a step to open conditions popover
2. Try shift+drag on another step
3. Verify: nothing happens (popover guard)

- [ ] **Step 6: Test wrapping**

1. Shift+click and drag very far vertically
2. Verify: patterns cycle and wrap back to
   original state

- [ ] **Step 7: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 8: Commit any fixes**

If browser testing revealed issues, fix and commit.

---

## Verification Checklist

- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — production build succeeds
- [ ] Mouse: shift+drag cycles patterns with live
  preview
- [ ] Mouse: shift+click without drag is no-op
- [ ] Mouse: Escape cancels and restores
- [ ] Mouse: popover blocks cycling
- [ ] Mouse: pattern wraps at end of list
- [ ] Touch: long-press+drag cycles patterns
  (if testable)
- [ ] Touch: long-press+release opens popover
  (if testable)
- [ ] Audio: previewed pattern is audible during
  playback
