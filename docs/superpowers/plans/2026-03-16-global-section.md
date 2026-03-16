# Global Section Implementation Plan

> **For agentic workers:** REQUIRED: Use
> superpowers:subagent-driven-development (if subagents
> available) or superpowers:executing-plans to implement
> this plan. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Add a Global controls section (Steps, Swing,
Clear) to the left of Kit and Pattern in the header.

**Architecture:** New `GlobalControls` component in
a 3-column grid. `clearAll` and `setSwing` actions in
SequencerContext. Swing timing applied as per-sound
offset in `handleStep`. `swing` field added to
`SequencerConfig` and configCodec.

**Tech Stack:** React, TypeScript, Tailwind CSS v4,
Vitest, Web Audio API

**Spec:**
`docs/superpowers/specs/2026-03-16-global-section-design.md`

---

## Chunk 1: Data Layer

### Task 1: Add `swing` to SequencerConfig

**Files:**
- Modify: `src/app/types.ts:62-70`
- Modify: `src/app/configCodec.ts:24-46`

- [ ] **Step 1: Add `swing` field to SequencerConfig**

In `src/app/types.ts`, add `swing` to the interface:

```typescript
export interface SequencerConfig {
  version: number;
  kitId: string;
  bpm: number;
  patternLength: number;
  trackLengths: Record<TrackId, number>;
  steps: Record<TrackId, string>;
  mixer: Record<TrackId, TrackMixerState>;
  swing: number;
}
```

- [ ] **Step 2: Add `swing` to `defaultConfig()`**

In `src/app/configCodec.ts`, add `swing: 0` to the
return object of `defaultConfig()` (after `mixer`):

```typescript
  return {
    version: CONFIG_VERSION,
    kitId: kitsData.kits[0].id,
    bpm: DEFAULT_BPM,
    patternLength: DEFAULT_PATTERN_LENGTH,
    trackLengths,
    steps: firstPattern.steps as Record<TrackId, string>,
    mixer,
    swing: 0,
  };
```

- [ ] **Step 3: Add `validateSwing` and wire into `validateConfig`**

Add after the `validatePatternLength` function:

```typescript
const SWING_MIN = 0;
const SWING_MAX = 100;
const DEFAULT_SWING = 0;

function validateSwing(value: unknown): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return DEFAULT_SWING;
  }
  return Math.max(
    SWING_MIN,
    Math.min(SWING_MAX, Math.round(value))
  );
}
```

In `validateConfig`, add after `const mixer = ...`:

```typescript
  const swing = validateSwing(obj.swing);
```

And add `swing` to the return object:

```typescript
  return {
    version: CONFIG_VERSION,
    kitId, bpm, patternLength,
    trackLengths, steps, mixer, swing,
  };
```

- [ ] **Step 4: Fix any TypeScript errors**

Run: `npx tsc --noEmit`

The compiler will flag anywhere
`SequencerConfig` is constructed without `swing`.
Fix each site by adding `swing: 0` (or the
appropriate value).

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All existing tests pass. Some may need
`swing: 0` added to config objects.

- [ ] **Step 6: Commit**

```
git add src/app/types.ts src/app/configCodec.ts
git commit -m "Add swing field to SequencerConfig"
```

### Task 2: configCodec swing tests

**Files:**
- Modify: `src/__tests__/configCodec.test.ts`

- [ ] **Step 1: Write failing tests for swing**

Add to `configCodec.test.ts`:

```typescript
describe('swing serialization', () => {
  it('config with swing round-trips', async () => {
    const config = makeConfig({ swing: 50 });
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
    expect(decoded.swing).toBe(50);
  });

  it('missing swing defaults to 0', async () => {
    const config = defaultConfig();
    const { swing: _, ...noSwing } = config;
    const hash = await encodeRaw(noSwing);
    const decoded = await decodeConfig(hash);
    expect(decoded.swing).toBe(0);
  });

  it('swing clamped to 0-100', async () => {
    const below = await encodeRaw({
      ...defaultConfig(), swing: -10,
    });
    expect((await decodeConfig(below)).swing).toBe(0);

    const above = await encodeRaw({
      ...defaultConfig(), swing: 200,
    });
    expect((await decodeConfig(above)).swing).toBe(100);
  });

  it('non-number swing defaults to 0', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), swing: 'high',
    });
    expect((await decodeConfig(hash)).swing).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- src/__tests__/configCodec.test.ts`
Expected: PASS (implementation from Task 1 already
handles this).

- [ ] **Step 3: Commit**

```
git add src/__tests__/configCodec.test.ts
git commit -m "Add configCodec tests for swing field"
```

### Task 3: Add `clearAll` and `setSwing` actions

**Files:**
- Modify: `src/app/SequencerContext.tsx:72-88`
  (SequencerActions interface)
- Modify: `src/app/SequencerContext.tsx:336-553`
  (action implementations)
- Modify: `src/app/SequencerContext.tsx:557-581`
  (context value)

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/SequencerContext.test.tsx`, new
describe block after "pattern state machine":

```typescript
// -------------------------------------------------
// E. clearAll and setSwing actions
// -------------------------------------------------
describe('clearAll', () => {
  it('sets all track steps to zeros', () => {
    const { result } = renderSequencer();
    // First set some steps active
    act(() => {
      result.current.actions.toggleStep('bd', 0);
      result.current.actions.toggleStep('sd', 4);
    });
    act(() => {
      result.current.actions.clearAll();
    });
    for (const id of TRACK_IDS) {
      const steps = result.current.meta.config.steps[id];
      expect(steps).toMatch(/^0+$/);
    }
  });

  it('resets swing to 0', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(50);
    });
    expect(result.current.meta.config.swing).toBe(50);
    act(() => {
      result.current.actions.clearAll();
    });
    expect(result.current.meta.config.swing).toBe(0);
  });

  it('resets all track lengths to patternLength', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setTrackLength('bd', 5);
      result.current.actions.setTrackLength('sd', 8);
    });
    act(() => {
      result.current.actions.clearAll();
    });
    const pl = result.current.state.patternLength;
    for (const id of TRACK_IDS) {
      expect(
        result.current.meta.config.trackLengths[id]
      ).toBe(pl);
    }
  });

  it('sets pattern to custom', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.clearAll();
    });
    expect(
      result.current.state.currentPattern.id
    ).toBe('custom');
  });
});

describe('setSwing', () => {
  it('updates swing value', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(75);
    });
    expect(result.current.meta.config.swing).toBe(75);
  });

  it('clamps below 0', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(-10);
    });
    expect(result.current.meta.config.swing).toBe(0);
  });

  it('clamps above 100', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(150);
    });
    expect(result.current.meta.config.swing).toBe(100);
  });

  it('setPattern does not reset swing', () => {
    const { result } = renderSequencer();
    act(() => {
      result.current.actions.setSwing(60);
    });
    const preset = patternsData.patterns[1];
    act(() => {
      result.current.actions.setPattern({
        id: preset.id,
        name: preset.name,
        steps: preset.steps as Record<TrackId, string>,
      });
    });
    expect(result.current.meta.config.swing).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/SequencerContext.test.tsx`
Expected: FAIL — `clearAll` and `setSwing` not defined.

- [ ] **Step 3: Update interfaces and implement actions**

In `src/app/SequencerContext.tsx`:

Add `swing` to `SequencerState` (after `isLoaded`):

```typescript
  swing: number;
```

Add to `SequencerActions` (after `setTrackLength`):

```typescript
  clearAll: () => void;
  setSwing: (value: number) => void;
```

- [ ] **Step 4: Implement `clearAll` action**

Add after the `setGain` callback (around line 553):

```typescript
  const clearAll = useCallback(() => {
    setConfig(prev => {
      const newSteps = {} as Record<TrackId, string>;
      const newTrackLengths = {} as Record<
        TrackId, number
      >;
      for (const id of TRACK_IDS) {
        newSteps[id] =
          '0'.repeat(prev.patternLength);
        newTrackLengths[id] = prev.patternLength;
      }
      return {
        ...prev,
        steps: newSteps,
        trackLengths: newTrackLengths,
        swing: 0,
      };
    });
    setSelectedPatternId('custom');
  }, []);
```

- [ ] **Step 5: Implement `setSwing` action**

Add after `clearAll`:

```typescript
  const setSwing = useCallback(
    (value: number) => {
      setConfig(prev => ({
        ...prev,
        swing: Math.max(0, Math.min(100, value)),
      }));
    },
    []
  );
```

- [ ] **Step 6: Expose `swing` in state and add actions
  to context value**

Add `swing` to the `state` object in the context value
(line ~561):

```typescript
    state: {
      isPlaying,
      bpm: config.bpm,
      patternLength: config.patternLength,
      trackLengths: config.trackLengths,
      currentKit,
      currentPattern,
      trackStates,
      isLoaded,
      swing: config.swing,
    },
```

Add `clearAll` and `setSwing` to the `actions` object:

```typescript
    actions: {
      togglePlay, setBpm, setKit, setPattern,
      toggleStep, toggleMute, toggleSolo, setGain,
      toggleFreeRun, setPatternLength, setTrackLength,
      clearAll, setSwing,
    },
```

- [ ] **Step 7: Run tests**

Run: `npm test -- src/__tests__/SequencerContext.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```
git add src/app/SequencerContext.tsx \
  src/__tests__/SequencerContext.test.tsx
git commit -m "Add clearAll and setSwing actions"
```

### Task 4: Swing timing in handleStep

**Files:**
- Modify: `src/app/SequencerContext.tsx:280-328`
  (handleStep callback)
- Modify: `src/__tests__/handleStep.test.ts`

- [ ] **Step 1: Write failing tests for swing timing**

Add to `src/__tests__/handleStep.test.ts`, new describe
block after the existing `handleStep` describe:

```typescript
// -------------------------------------------------
// handleStep swing timing
// -------------------------------------------------
describe('handleStep swing timing', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
  });

  it('odd step with swing: time is offset', async () => {
    const { result } = renderSequencer();

    // Set swing to 50 and activate bd at step 1
    await act(async () => {
      result.current.actions.setSwing(50);
      // Clear step 0 for bd, set step 1
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.steps[id];
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.steps.bd;
      if (cur[1] === '0') {
        result.current.actions.toggleStep('bd', 1);
      }
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    // Trigger odd step (step 1) at time 1.0
    onStep(1, 1.0);

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    const scheduledTime = mockPlaySound.mock.calls[0][1];
    // BPM 110: halfStep = (60/110)*0.25/2 = 0.06818
    // offset = (50/100) * 0.7 * 0.06818 = 0.02386
    expect(scheduledTime).toBeGreaterThan(1.0);
    expect(scheduledTime).toBeCloseTo(
      1.0 + 0.5 * 0.7 * ((60 / 110) * 0.25 / 2),
      4
    );
  });

  it('even step with swing: no offset', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setSwing(80);
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    // Trigger even step (step 0) at time 1.0
    onStep(0, 1.0);

    // Check that time passed to playSound is exactly
    // 1.0 (no offset for even steps)
    for (const call of mockPlaySound.mock.calls) {
      expect(call[1]).toBe(1.0);
    }
  });

  it('max swing capped by 0.7 multiplier', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setSwing(100);
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.steps[id];
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.steps.bd;
      if (cur[1] === '0') {
        result.current.actions.toggleStep('bd', 1);
      }
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(1, 1.0);

    const scheduledTime = mockPlaySound.mock.calls[0][1];
    // BPM 110: halfStep = (60/110)*0.25/2
    // Max offset = 1.0 * 0.7 * halfStep
    const halfStep = (60 / 110) * 0.25 / 2;
    const maxOffset = 0.7 * halfStep;
    expect(scheduledTime).toBeCloseTo(
      1.0 + maxOffset, 4
    );
    // Verify it's less than a full halfStep
    expect(scheduledTime - 1.0).toBeLessThan(halfStep);
  });

  it('swing offset scales with BPM', async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setBpm(60);
      result.current.actions.setSwing(50);
      for (const id of TRACK_IDS) {
        const cur =
          result.current.meta.config.steps[id];
        if (cur[0] === '1') {
          result.current.actions.toggleStep(id, 0);
        }
      }
    });

    await act(async () => {
      const cur =
        result.current.meta.config.steps.bd;
      if (cur[1] === '0') {
        result.current.actions.toggleStep('bd', 1);
      }
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(1, 1.0);

    const scheduledTime = mockPlaySound.mock.calls[0][1];
    // BPM 60: halfStep = (60/60)*0.25/2 = 0.125
    // offset = 0.5 * 0.7 * 0.125 = 0.04375
    const halfStep = (60 / 60) * 0.25 / 2;
    expect(scheduledTime).toBeCloseTo(
      1.0 + 0.5 * 0.7 * halfStep, 4
    );
  });

  it('zero swing: no offset on any step', async () => {
    const { result } = renderSequencer();
    // swing defaults to 0

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep = mockStart.mock.calls[0][1] as (
      step: number, time: number
    ) => void;

    await waitFor(() => {
      expect(
        result.current.state.isPlaying
      ).toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(1, 1.0);

    for (const call of mockPlaySound.mock.calls) {
      expect(call[1]).toBe(1.0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/handleStep.test.ts`
Expected: FAIL — swing offset not yet applied.

- [ ] **Step 3: Implement swing timing in handleStep**

In `src/app/SequencerContext.tsx`, modify `handleStep`.
After `const cfg = configRef.current;` (line 288),
add swing time calculation. Then modify the
`audioEngine.playSound` call to use `scheduledTime`:

```typescript
  const handleStep = useCallback(
    (step: number, time: number) => {
      const total = totalStepsRef.current;
      totalStepsRef.current = total + 1;
      stepRef.current = step;

      const states = trackStatesRef.current;
      const pattern = patternRef.current;
      const cfg = configRef.current;

      // Swing: offset odd steps
      const halfStep =
        (60 / cfg.bpm) * 0.25 / 2;
      const swingOffset = step % 2 === 1
        ? (cfg.swing / 100) * 0.7 * halfStep
        : 0;
      const scheduledTime = time + swingOffset;

      const anySolo = Object.values(states).some(
        t => t.isSolo
      );

      const trackStep = (
        id: TrackId
      ): number => {
        const len = cfg.trackLengths[id];
        return cfg.mixer[id].freeRun
          ? total % len
          : step % len;
      };

      const isAccented =
        pattern.steps.ac[
          trackStep('ac')
        ] === '1';

      TRACKS.forEach(track => {
        const st = states[track.id];
        const audible = anySolo
          ? st.isSolo
          : !st.isMuted;
        if (!audible) return;

        const effectiveStep = trackStep(track.id);
        if (
          pattern.steps[track.id][effectiveStep]
            === '1'
        ) {
          const cubic = st.gain ** 3;
          const gain =
            isAccented ? cubic * 1.5 : cubic;
          audioEngine.playSound(
            track.id, scheduledTime, gain
          );
        }
      });
    },
    []
  );
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/handleStep.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add src/app/SequencerContext.tsx \
  src/__tests__/handleStep.test.ts
git commit -m "Add swing timing offset in handleStep"
```

## Chunk 2: UI Layer

### Task 5: Create GlobalControls component

**Files:**
- Create: `src/app/GlobalControls.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { memo, useCallback } from 'react';
import Knob from './Knob';
import { useSequencer } from './SequencerContext';

/**
 * Global controls section: pattern length, swing, and
 * clear all.
 */
function GlobalControlsInner() {
  const { state, actions } = useSequencer();

  const handlePatternLength = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      actions.setPatternLength(
        parseInt(e.target.value, 10)
      );
    },
    [actions]
  );

  const handleSwing = useCallback(
    (v: number) => {
      actions.setSwing(Math.round(v * 100));
    },
    [actions]
  );

  return (
    <div className="bg-neutral-900/50 p-2 lg:p-4 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
      <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 lg:mb-2 block font-bold">
        Global
      </span>
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Steps dropdown */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[7px] lg:text-[8px] uppercase tracking-wider text-neutral-600">
            Steps
          </span>
          <select
            id="global-steps"
            value={state.patternLength}
            onChange={handlePatternLength}
            className="bg-neutral-800 border border-neutral-700 rounded p-1 text-xs lg:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 hover:border-neutral-600 transition-colors w-12 lg:w-14"
          >
            {Array.from(
              { length: 16 },
              (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              )
            )}
          </select>
        </div>

        {/* Swing knob */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[7px] lg:text-[8px] uppercase tracking-wider text-neutral-600">
            Swing
          </span>
          <Knob
            value={state.swing / 100}
            onChange={handleSwing}
            size={20}
          />
          <span className="text-[7px] lg:text-[8px] text-neutral-600">
            {state.swing}%
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear button */}
        <button
          onClick={actions.clearAll}
          className="bg-neutral-800 border border-neutral-700 rounded px-1.5 lg:px-2 py-1 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <span className="hidden lg:inline">
            Clr
          </span>
          <span className="lg:hidden">C</span>
        </button>
      </div>
    </div>
  );
}

const GlobalControls = memo(GlobalControlsInner);
export default GlobalControls;
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/app/GlobalControls.tsx
git commit -m "Create GlobalControls component"
```

### Task 6: Wire GlobalControls into TransportControls

**Files:**
- Modify: `src/app/TransportControls.tsx:1-107`

- [ ] **Step 1: Add import and render GlobalControls**

Add import at top:

```typescript
import GlobalControls from './GlobalControls';
```

Change the grid row (line 47) from `grid-cols-2` to
`grid-cols-3`:

```typescript
<div className="grid grid-cols-3 gap-2 lg:gap-4 pt-2 lg:pt-0">
```

Add `<GlobalControls />` as the first child inside
the grid (before the Drum Kit div):

```typescript
        <GlobalControls />
        <div className="bg-neutral-900/50 ...">
          {/* Drum Kit selector */}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/app/TransportControls.tsx
git commit -m "Wire GlobalControls into header grid"
```

### Task 7: Remove Steps from SettingsPopover

**Files:**
- Modify: `src/app/SettingsPopover.tsx:72-131`

- [ ] **Step 1: Remove the pattern length selector**

Remove the `handlePatternLength` callback (lines 72-79)
and the entire Steps `<div>` block from the popover
(lines 109-131). The Export button becomes the only
item in the popover menu. Remove the `border-b
border-neutral-800` from the Export button's parent
since there's no separator needed. Also remove the
`state` and `actions` destructuring for pattern length
if no longer used.

After removal, the popover content should be:

```typescript
        <div
          ref={popoverRef}
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={handleExport}
            className="w-full text-left px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
          >
            {feedback || 'Export URL'}
          </button>
        </div>
```

Clean up unused imports/destructuring (remove `state`
and `actions` from `useSequencer()` if only `meta` is
needed).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```
git add src/app/SettingsPopover.tsx
git commit -m "Remove Steps selector from SettingsPopover"
```

### Task 8: GlobalControls UI test

**Files:**
- Create: `src/__tests__/GlobalControls.test.tsx`

- [ ] **Step 1: Write UI tests**

```typescript
import { render, screen, fireEvent } from
  '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalControls from '../app/GlobalControls';

// Mock SequencerContext
const mockSetPatternLength = vi.fn();
const mockSetSwing = vi.fn();
const mockClearAll = vi.fn();

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => ({
    state: {
      patternLength: 16,
      swing: 0,
    },
    actions: {
      setPatternLength: mockSetPatternLength,
      setSwing: mockSetSwing,
      clearAll: mockClearAll,
    },
  }),
}));

describe('GlobalControls', () => {
  it('renders steps dropdown', () => {
    render(<GlobalControls />);
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    expect(
      (select as HTMLSelectElement).value
    ).toBe('16');
  });

  it('renders swing knob', () => {
    render(<GlobalControls />);
    const knob = screen.getByRole('slider');
    expect(knob).toBeDefined();
  });

  it('renders clear button', () => {
    render(<GlobalControls />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
  });

  it('steps change calls setPatternLength', () => {
    render(<GlobalControls />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, {
      target: { value: '8' },
    });
    expect(mockSetPatternLength).toHaveBeenCalledWith(8);
  });

  it('clear button calls clearAll', () => {
    render(<GlobalControls />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(mockClearAll).toHaveBeenCalled();
  });

  it('swing knob calls setSwing', () => {
    render(<GlobalControls />);
    const knob = screen.getByRole('slider');
    // Simulate keyboard interaction (ArrowUp)
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(mockSetSwing).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/__tests__/GlobalControls.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add src/__tests__/GlobalControls.test.tsx
git commit -m "Add GlobalControls UI tests"
```

## Chunk 3: Verification

### Task 9: Full test suite and lint

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: Zero errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

### Task 10: Manual browser verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify layout**

Open in browser. Confirm three-column header:
**Global | Drum Kit | Pattern**.

- [ ] **Step 3: Test Steps dropdown**

Change steps from 16 to 8. Verify grid shows 8 columns
and tracks clamp.

- [ ] **Step 4: Test Swing knob**

Play a pattern. Drag swing knob up. Verify off-beat
timing shifts audibly.

- [ ] **Step 5: Test Clear button**

Set some steps active, set swing to non-zero, set a
track to length 5. Click CLR. Verify all steps cleared,
swing resets to 0%, track lengths reset.

- [ ] **Step 6: Test mobile viewport**

Resize to mobile width. Verify three columns still
display compactly. CLR button shows "C".

- [ ] **Step 7: Test URL export/import**

Set swing to 50. Export URL. Reload page with the hash.
Verify swing is restored to 50.

- [ ] **Step 8: Test backward compat**

Load an old URL (no swing field). Verify swing defaults
to 0%.

- [ ] **Step 9: Test pattern load preserves swing**

Set swing to 60. Load a preset pattern. Verify swing
stays at 60.

- [ ] **Step 10: Verify SettingsPopover**

Click gear icon. Verify Steps selector is gone. Export
URL button still works.

- [ ] **Step 11: Stop dev server**
