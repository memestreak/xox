---
date: 2026-03-20
summary: >
  Add per-step gain parameter locks to the XOX drum sequencer
  (issue #30). Extends the step popover with a gain slider,
  adds opacity visual indicator, and wires through serialization.
---

# Parameter Locks — Gain Implementation Plan

> **For agentic workers:** REQUIRED: Use
> subagent-driven-development (if subagents available) or
> executing-plans to implement this plan. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Add per-step gain overrides ("parameter locks") so
each step can have its own volume, independent of the track
mixer.

**Architecture:** New `StepLocks` type and `parameterLocks`
field on `SequencerConfig`, mirroring the existing
`trigConditions` pattern. `ProbabilitySlider` is generalized
into a reusable `RangeSlider`. The existing
`TrigConditionPopover` is renamed to `StepPopover` and
extended with a "Locks" section. Gain lock overrides mixer
gain in `handleStep`; active steps show opacity proportional
to locked gain.

**Tech Stack:** React 19, TypeScript strict, Vitest + jsdom,
Tailwind CSS v4, Next.js App Router

**Spec:** `docs/specs/2026-03-20-parameter-locks-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/types.ts` | Add `StepLocks` interface, extend `SequencerConfig` and `Pattern` |
| Create | `src/app/RangeSlider.tsx` | Generalized horizontal slider (min/max/onChange) |
| Modify | `src/app/ProbabilitySlider.tsx` | Rewrite as thin wrapper around `RangeSlider` |
| Rename | `src/app/TrigConditionPopover.tsx` → `src/app/StepPopover.tsx` | Extended with locks section |
| Modify | `src/app/StepButton.tsx` | Remove `isActive` guard on popover; add opacity style |
| Modify | `src/app/StepGrid.tsx` | Update import; pass `parameterLocks` to popover |
| Modify | `src/app/configCodec.ts` | Add `validateParameterLocks()`, update `defaultConfig()`, `validateConfig()`, strip empty on encode |
| Modify | `src/app/SequencerContext.tsx` | Add actions, wire `parameterLocks` through all state operations |
| Create | `src/__tests__/RangeSlider.test.tsx` | Slider unit tests |
| Modify | `src/__tests__/TrigConditionPopover.test.tsx` → rename to `src/__tests__/StepPopover.test.tsx` | Update imports, add locks section tests |
| Modify | `src/__tests__/handleStep.test.ts` | Gain lock override tests |
| Modify | `src/__tests__/configCodec.test.ts` | Round-trip, validation, stripping tests |
| Modify | `src/__tests__/configCodec.golden.test.ts` | Update snapshot |
| Modify | `src/__tests__/StepButton.test.tsx` | Opacity indicator, popover-on-inactive tests |

---

## Task 1: Types and Data Model

**Files:**
- Modify: `src/app/types.ts:23-102`

- [ ] **Step 1: Add `StepLocks` interface**

Add after `StepConditions` (line 27):

```typescript
/**
 * Per-step parameter lock overrides.
 * Each field overrides the track-level default when present.
 */
export interface StepLocks {
  gain?: number; // 0.0–1.0
}
```

- [ ] **Step 2: Add `parameterLocks` to `SequencerConfig`**

Add after `trigConditions` (line 101):

```typescript
  parameterLocks: Partial<
    Record<TrackId, Record<number, StepLocks>>
  >;
```

- [ ] **Step 3: Add `parameterLocks` to `Pattern`**

Add after `trigConditions` (line 39):

```typescript
  parameterLocks?: Partial<
    Record<TrackId, Record<number, StepLocks>>
  >;
```

- [ ] **Step 4: Run tests to confirm nothing breaks**

Run: `npm test -- --run`
Expected: Snapshot failures in golden test (expected — do NOT
update yet). No other failures.

- [ ] **Step 5: Commit**

```
git add src/app/types.ts
git commit -m "Add StepLocks type and parameterLocks field"
```

---

## Task 2: configCodec — Validation and Encoding

**Files:**
- Modify: `src/app/configCodec.ts:1-470`
- Modify: `src/__tests__/configCodec.test.ts`
- Modify: `src/__tests__/configCodec.golden.test.ts`

- [ ] **Step 1: Write failing tests for `parameterLocks` validation**

Add to `src/__tests__/configCodec.test.ts`:

```typescript
describe('parameterLocks validation', () => {
  it('round-trips parameterLocks through encode/decode',
    async () => {
      const config = makeConfig({
        parameterLocks: {
          bd: { 0: { gain: 0.5 }, 3: { gain: 0.8 } },
          sd: { 7: { gain: 0.2 } },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.parameterLocks).toEqual(
        config.parameterLocks
      );
    }
  );

  it('defaults to {} when missing', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(),
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.parameterLocks).toEqual({});
  });

  it('clamps gain to [0, 1]', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(),
      parameterLocks: {
        bd: { 0: { gain: 2.5 }, 1: { gain: -0.3 } },
      },
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.parameterLocks.bd?.[0]?.gain).toBe(1);
    expect(decoded.parameterLocks.bd?.[1]?.gain).toBe(0);
  });

  it('drops invalid track IDs', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(),
      parameterLocks: {
        zz: { 0: { gain: 0.5 } },
        bd: { 0: { gain: 0.7 } },
      },
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.parameterLocks).toEqual({
      bd: { 0: { gain: 0.7 } },
    });
  });

  it('drops ac track entries', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(),
      parameterLocks: {
        ac: { 0: { gain: 0.5 } },
        bd: { 0: { gain: 0.7 } },
      },
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.parameterLocks).toEqual({
      bd: { 0: { gain: 0.7 } },
    });
  });

  it('drops step indices >= 64', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(),
      parameterLocks: {
        bd: { 0: { gain: 0.5 }, 99: { gain: 0.8 } },
      },
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.parameterLocks).toEqual({
      bd: { 0: { gain: 0.5 } },
    });
  });

  it('strips empty parameterLocks from encoded output',
    async () => {
      const config = makeConfig({
        parameterLocks: {},
      });
      const hash = await encodeConfig(config);
      // Decode raw JSON to inspect
      const bytes = Uint8Array.from(
        atob(
          hash.replace(/-/g, '+').replace(/_/g, '/')
            + '='.repeat((4 - (hash.length % 4)) % 4)
        ),
        c => c.charCodeAt(0)
      );
      const stream = new Blob([bytes]).stream()
        .pipeThrough(
          new DecompressionStream('deflate-raw')
        );
      const json = await new Response(stream).text();
      const parsed = JSON.parse(json);
      expect(parsed.parameterLocks).toBeUndefined();
    }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/__tests__/configCodec.test.ts`
Expected: FAIL — `parameterLocks` not handled yet.

- [ ] **Step 3: Add `validateParameterLocks()` to configCodec.ts**

Add after `validateTrigConditions` (after line 433). Import
`StepLocks` from types:

```typescript
const MAX_STEP_INDEX = 63;

/**
 * Validate a single StepLocks object.
 * Returns null if no valid fields remain.
 */
function validateSingleLock(
  raw: unknown
): StepLocks | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const sl: StepLocks = {};

  if (
    typeof obj.gain === 'number'
    && isFinite(obj.gain)
  ) {
    sl.gain = Math.max(0, Math.min(1, obj.gain));
  }

  if (Object.keys(sl).length === 0) return null;
  return sl;
}

/**
 * Validate parameterLocks map. Drops ac track,
 * invalid step indices, and invalid lock objects.
 */
function validateParameterLocks(
  value: unknown,
  trackLengths: Record<TrackId, number>
): SequencerConfig['parameterLocks'] {
  if (
    value === null || typeof value !== 'object'
  ) return {};
  const obj = value as Record<string, unknown>;
  const result:
    SequencerConfig['parameterLocks'] = {};

  for (const id of TRACK_IDS) {
    if (id === 'ac') continue;
    const trackEntry = obj[id];
    if (
      trackEntry === null
      || typeof trackEntry !== 'object'
    ) continue;

    const stepMap =
      trackEntry as Record<string, unknown>;
    const validSteps: Record<number, StepLocks> = {};

    for (const key of Object.keys(stepMap)) {
      const stepIndex = Number(key);
      if (
        !Number.isInteger(stepIndex)
        || stepIndex < 0
        || stepIndex > MAX_STEP_INDEX
      ) continue;
      const lock = validateSingleLock(stepMap[key]);
      if (lock !== null) {
        validSteps[stepIndex] = lock;
      }
    }

    if (Object.keys(validSteps).length > 0) {
      result[id] = validSteps;
    }
  }

  return result;
}
```

- [ ] **Step 4: Update `defaultConfig()` — add `parameterLocks: {}`**

In `defaultConfig()` (line 48, before closing brace):

```typescript
    parameterLocks: {},
```

- [ ] **Step 5: Update `validateConfig()` — call `validateParameterLocks`**

Add after the `trigConditions` validation (line 167):

```typescript
  const parameterLocks = validateParameterLocks(
    obj.parameterLocks, trackLengths
  );
```

Add `parameterLocks` to the return object (line 178):

```typescript
    parameterLocks,
```

- [ ] **Step 6: Update `encodeConfig()` — strip empty `parameterLocks`**

Replace the current `encodeConfig` function body:

```typescript
export async function encodeConfig(
  config: SequencerConfig
): Promise<string> {
  const toEncode: Record<string, unknown> = {
    ...config,
  };
  // Strip empty parameterLocks to keep URLs small
  if (
    Object.keys(
      config.parameterLocks ?? {}
    ).length === 0
  ) {
    delete toEncode.parameterLocks;
  }
  const json = JSON.stringify(toEncode);
  const stream = new Blob([json]).stream()
    .pipeThrough(
      new CompressionStream('deflate-raw')
    );
  const bytes = new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
  return toBase64url(bytes);
}
```

- [ ] **Step 7: Update import in configCodec.ts**

Add `StepLocks` to the import from `'./types'`:

```typescript
import type {
  SequencerConfig,
  StepConditions,
  StepLocks,
  TrackId,
  TrackMixerState,
} from './types';
```

- [ ] **Step 8: Run configCodec tests**

Run: `npm test -- --run src/__tests__/configCodec.test.ts`
Expected: All PASS (including new tests).

- [ ] **Step 9: Update golden test snapshot**

Run: `npm test -- --run -u src/__tests__/configCodec.golden.test.ts`
Expected: Snapshot updated with `parameterLocks: {}`.

- [ ] **Step 10: Update types.test.ts snapshot (if applicable)**

Run: `npm test -- --run -u src/__tests__/types.test.ts`
Expected: PASS (snapshot updated if it tracks
`SequencerConfig` shape).

- [ ] **Step 11: Run full test suite**

Run: `npm test -- --run`
Expected: All PASS.

- [ ] **Step 12: Commit**

```
git add src/app/configCodec.ts src/__tests__/configCodec.test.ts \
  src/__tests__/configCodec.golden.test.ts \
  src/__tests__/__snapshots__/
git commit -m "Add parameterLocks validation and codec support"
```

---

## Task 3: RangeSlider Component

**Files:**
- Create: `src/app/RangeSlider.tsx`
- Modify: `src/app/ProbabilitySlider.tsx`
- Create: `src/__tests__/RangeSlider.test.tsx`

- [ ] **Step 1: Write failing tests for RangeSlider**

Create `src/__tests__/RangeSlider.test.tsx`:

```typescript
import { render, screen, fireEvent } from
  '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RangeSlider from '../app/RangeSlider';

describe('RangeSlider', () => {
  it('renders with current value', () => {
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('clamps at min on Home key', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('clamps at max on End key', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('respects custom min (e.g., 1 for probability)',
    () => {
      const onChange = vi.fn();
      render(
        <RangeSlider
          value={5} min={1} max={100}
          onChange={onChange}
        />
      );
      const slider = screen.getByRole('slider');
      fireEvent.keyDown(slider, { key: 'Home' });
      expect(onChange).toHaveBeenCalledWith(1);
    }
  );

  it('arrow key increments by 1', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(
      slider, { key: 'ArrowRight' }
    );
    expect(onChange).toHaveBeenCalledWith(51);
  });

  it('shift+arrow increments by 10', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(
      slider,
      { key: 'ArrowRight', shiftKey: true }
    );
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('sets correct aria attributes', () => {
    render(
      <RangeSlider
        value={42} min={0} max={100}
        onChange={vi.fn()} label="Gain"
      />
    );
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin'))
      .toBe('0');
    expect(slider.getAttribute('aria-valuemax'))
      .toBe('100');
    expect(slider.getAttribute('aria-valuenow'))
      .toBe('42');
    expect(slider.getAttribute('aria-label'))
      .toBe('Gain');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/__tests__/RangeSlider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `RangeSlider.tsx`**

Create `src/app/RangeSlider.tsx`:

```typescript
"use client";

import { useRef, useCallback, useEffect } from 'react';

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
}

/**
 * Horizontal range slider with pointer-capture drag
 * and keyboard controls.
 *
 * Args:
 *   value: Current value
 *   min: Minimum value (inclusive)
 *   max: Maximum value (inclusive)
 *   onChange: Callback with new value
 *   label: Accessible label (default "Value")
 */
export default function RangeSlider({
  value,
  min,
  max,
  onChange,
  label = 'Value',
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startValue: number;
  } | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const range = max - min;

  const clamp = (v: number) =>
    Math.max(min, Math.min(max, Math.round(v)));

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(
        e.pointerId
      );
      dragRef.current = {
        startX: e.clientX,
        startValue: valueRef.current,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !trackRef.current) {
        return;
      }
      const width = trackRef.current.offsetWidth;
      if (width === 0) return;
      const delta =
        ((e.clientX - dragRef.current.startX)
          / width) * range;
      onChange(
        clamp(dragRef.current.startValue + delta)
      );
    },
    [onChange, range]
  );

  const release = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const v = valueRef.current;
      let next = v;
      const step = e.shiftKey ? 10 : 1;
      if (
        e.key === 'ArrowRight'
        || e.key === 'ArrowUp'
      ) {
        next = clamp(v + step);
      } else if (
        e.key === 'ArrowLeft'
        || e.key === 'ArrowDown'
      ) {
        next = clamp(v - step);
      } else if (e.key === 'Home') {
        next = min;
      } else if (e.key === 'End') {
        next = max;
      } else {
        return;
      }
      e.preventDefault();
      onChange(next);
    },
    [onChange, min, max]
  );

  const pct = range > 0
    ? ((value - min) / range) * 100
    : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className={
          'relative h-6 flex-1 rounded'
          + ' bg-neutral-700 cursor-ew-resize'
          + ' focus-visible:outline-none'
          + ' focus-visible:ring-2'
          + ' focus-visible:ring-orange-500'
        }
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
      >
        <div
          className={
            'absolute inset-y-0 left-0 rounded'
            + ' bg-orange-600'
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={
        'text-xs font-mono text-neutral-300'
        + ' w-10 text-right tabular-nums'
      }>
        {value}%
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run RangeSlider tests**

Run: `npm test -- --run src/__tests__/RangeSlider.test.tsx`
Expected: All PASS.

- [ ] **Step 5: Rewrite ProbabilitySlider as wrapper**

Replace `src/app/ProbabilitySlider.tsx`:

```typescript
"use client";

import RangeSlider from './RangeSlider';

interface ProbabilitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Probability slider (1-100). Thin wrapper around
 * RangeSlider.
 */
export default function ProbabilitySlider({
  value,
  onChange,
}: ProbabilitySliderProps) {
  return (
    <RangeSlider
      value={value}
      min={1}
      max={100}
      onChange={onChange}
      label="Probability"
    />
  );
}
```

- [ ] **Step 6: Run full test suite to verify ProbabilitySlider still works**

Run: `npm test -- --run`
Expected: All PASS (ProbabilitySlider tests + popover tests
still pass since behavior is identical).

- [ ] **Step 7: Commit**

```
git add src/app/RangeSlider.tsx \
  src/app/ProbabilitySlider.tsx \
  src/__tests__/RangeSlider.test.tsx
git commit -m "Extract RangeSlider from ProbabilitySlider"
```

---

## Task 4: SequencerContext — Actions and State Parity

**Files:**
- Modify: `src/app/SequencerContext.tsx`
- Modify: `src/__tests__/handleStep.test.ts`

- [ ] **Step 1: Write failing tests for gain lock in handleStep**

Add to `src/__tests__/handleStep.test.ts`, in a new
`describe('handleStep parameter locks')` block. The
`setupAndTrigger` helper needs a new optional
`parameterLocks` field — add it to the options type and
wire it through:

In the `setupAndTrigger` options type (line 39), add:

```typescript
    parameterLocks?: Partial<
      Record<TrackId, Record<number, StepLocks>>
    >;
```

In the destructuring (line 51), add:

```typescript
    parameterLocks = {},
```

After gains are set (around line 95), add the lock setup
using the new `setParameterLock` action:

```typescript
    for (const [tid, steps] of
      Object.entries(parameterLocks)) {
      for (const [si, locks] of
        Object.entries(steps)) {
        await act(async () => {
          result.current.actions.setParameterLock(
            tid as TrackId,
            Number(si),
            locks
          );
        });
      }
    }
```

Then add the test cases:

```typescript
import type { StepLocks } from '../app/types';

describe('handleStep parameter locks', () => {
  beforeEach(() => {
    mockPlaySound.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
  });

  it('gain lock overrides mixer gain', async () => {
    const { mockPlaySound: mp } =
      await setupAndTrigger({
        activeTracks: ['bd'],
        gains: { bd: 1.0 },
        parameterLocks: {
          bd: { 0: { gain: 0.5 } },
        },
      });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 0.5^3 = 0.125
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.125);
  });

  it('accent stacks on locked gain', async () => {
    const { mockPlaySound: mp } =
      await setupAndTrigger({
        activeTracks: ['bd'],
        accentStep0: true,
        gains: { bd: 1.0 },
        parameterLocks: {
          bd: { 0: { gain: 0.5 } },
        },
      });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 0.5^3 * 1.5 = 0.1875
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.1875);
  });

  it('no lock falls back to mixer gain', async () => {
    const { mockPlaySound: mp } =
      await setupAndTrigger({
        activeTracks: ['bd'],
        gains: { bd: 0.8 },
        parameterLocks: {},
      });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 0.8^3 = 0.512
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBeCloseTo(0.512);
  });

  it('gain lock = 0 produces silence', async () => {
    const { mockPlaySound: mp } =
      await setupAndTrigger({
        activeTracks: ['bd'],
        gains: { bd: 1.0 },
        parameterLocks: {
          bd: { 0: { gain: 0 } },
        },
      });
    expect(mp).toHaveBeenCalledTimes(1);
    // gain = 0^3 = 0
    const gainArg = mp.mock.calls[0][2];
    expect(gainArg).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/__tests__/handleStep.test.ts`
Expected: FAIL — `setParameterLock` not defined.

- [ ] **Step 3: Add `setParameterLock` and `clearParameterLock` actions to SequencerContext**

Add after `clearTrigCondition` (after line 919):

```typescript
  const setParameterLock = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      locks: StepLocks
    ) => {
      setConfig(prev => ({
        ...prev,
        parameterLocks: {
          ...prev.parameterLocks,
          [trackId]: {
            ...prev.parameterLocks[trackId],
            [stepIndex]: locks,
          },
        },
      }));
    },
    []
  );

  const clearParameterLock = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const trackLocks = {
          ...prev.parameterLocks[trackId],
        };
        delete trackLocks[stepIndex];
        const newParameterLocks = {
          ...prev.parameterLocks,
        };
        if (
          Object.keys(trackLocks).length === 0
        ) {
          delete newParameterLocks[trackId];
        } else {
          newParameterLocks[trackId] = trackLocks;
        }
        return {
          ...prev,
          parameterLocks: newParameterLocks,
        };
      });
    },
    []
  );
```

Add `StepLocks` to the import from `'./types'`.

Export these actions in the actions object (around line 957):

```typescript
      setParameterLock,
      clearParameterLock,
```

Add them to the `Actions` interface (around line 106):

```typescript
  setParameterLock: (
    trackId: TrackId,
    stepIndex: number,
    locks: StepLocks
  ) => void;
  clearParameterLock: (
    trackId: TrackId,
    stepIndex: number
  ) => void;
```

- [ ] **Step 4: Update `handleStep` gain calculation**

In `handleStep` (around line 401), replace:

```typescript
          const cubic = st.gain ** 3;
          const gain =
            isAccented ? cubic * 1.5 : cubic;
```

With:

```typescript
          const locks =
            cfg.parameterLocks
              ?.[track.id]?.[effectiveStep];
          const baseGain =
            locks?.gain ?? st.gain;
          const cubic = baseGain ** 3;
          const gain =
            isAccented ? cubic * 1.5 : cubic;
```

- [ ] **Step 5: Wire `parameterLocks` through state operations**

**`setPattern`** (line 489-494) — add `parameterLocks`:

```typescript
      return {
        ...prev,
        steps: newSteps,
        trigConditions:
          pattern.trigConditions ?? {},
        parameterLocks:
          pattern.parameterLocks ?? {},
      };
```

Note: The spec lists `clearPattern` as needing
`parameterLocks` reset. No separate `clearPattern` action
exists — `clearAll` serves this role.

**`clearAll`** (line 760-767) — add `parameterLocks: {}`:

```typescript
      return {
        ...prev,
        steps: newSteps,
        trackLengths: newTrackLengths,
        mixer: newMixer,
        swing: 0,
        trigConditions: {},
        parameterLocks: {},
      };
```

**`clearTrack`** (line 775-800) — delete parameterLocks
for the track:

After `delete newTrigConditions[trackId];` (line 781),
add:

```typescript
        const newParameterLocks = {
          ...prev.parameterLocks,
        };
        delete newParameterLocks[trackId];
```

Add `parameterLocks: newParameterLocks` to the return
object.

**`setPatternLength`** (line 596-635) — prune locks:

After the trig conditions pruning loop (line 614-627),
add the same pattern for parameterLocks. First, copy
`prev.parameterLocks` into `newParamLocks` alongside
`newTrigConds` (line 596):

```typescript
        const newParamLocks = {
          ...prev.parameterLocks,
        };
```

Then in the per-track loop, after the trig condition
pruning:

```typescript
          const trackLocks = newParamLocks[id];
          if (trackLocks) {
            const pruned: Record<
              number, StepLocks
            > = {};
            for (const [k, v] of
              Object.entries(trackLocks)) {
              if (Number(k) < len) {
                pruned[Number(k)] = v;
              }
            }
            newParamLocks[id] = pruned;
          }
```

Add `parameterLocks: newParamLocks` to the return object.

**`setTrackLength`** (line 642-688) — prune locks:

After the trig conditions pruning (line 657-675), add:

```typescript
        const trackLocks =
          prev.parameterLocks[trackId];
        let newParameterLocks =
          prev.parameterLocks;
        if (trackLocks) {
          const pruned: Record<
            number, StepLocks
          > = {};
          for (const [k, v] of
            Object.entries(trackLocks)) {
            if (Number(k) < clamped) {
              pruned[Number(k)] = v;
            }
          }
          newParameterLocks = {
            ...prev.parameterLocks,
            [trackId]: pruned,
          };
        }
```

Add `parameterLocks: newParameterLocks` to the return
object.

- [ ] **Step 6: Run handleStep tests**

Run: `npm test -- --run src/__tests__/handleStep.test.ts`
Expected: All PASS.

- [ ] **Step 7: Run full test suite**

Run: `npm test -- --run`
Expected: All PASS.

- [ ] **Step 8: Commit**

```
git add src/app/SequencerContext.tsx \
  src/__tests__/handleStep.test.ts
git commit -m "Add parameterLock actions and gain override"
```

---

## Task 5: Rename TrigConditionPopover → StepPopover

**Files:**
- Rename: `src/app/TrigConditionPopover.tsx` → `src/app/StepPopover.tsx`
- Modify: `src/app/StepGrid.tsx:10-11,175`
- Rename: `src/__tests__/TrigConditionPopover.test.tsx` → `src/__tests__/StepPopover.test.tsx`

- [ ] **Step 1: Rename files**

```bash
git mv src/app/TrigConditionPopover.tsx \
  src/app/StepPopover.tsx
git mv src/__tests__/TrigConditionPopover.test.tsx \
  src/__tests__/StepPopover.test.tsx
```

- [ ] **Step 2: Update component name in StepPopover.tsx**

Replace `TrigConditionPopover` with `StepPopover` in:
- The `interface` name (line 12)
- The function name (line 32)
- The `export default function` declaration

Update the aria-label from `"Trig conditions"` to
`"Step editor"` (line 169).

- [ ] **Step 3: Update imports in StepGrid.tsx**

Replace (lines 10-11):

```typescript
import StepPopover from './StepPopover';
```

Replace `<TrigConditionPopover` with `<StepPopover`
(line 175).

- [ ] **Step 4: Update test file imports**

In `src/__tests__/StepPopover.test.tsx`, replace all
`TrigConditionPopover` with `StepPopover` and update
the import path.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run`
Expected: All PASS.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "Rename TrigConditionPopover to StepPopover"
```

---

## Task 6: StepPopover — Gain Lock UI

**Files:**
- Modify: `src/app/StepPopover.tsx`
- Modify: `src/__tests__/StepPopover.test.tsx`

- [ ] **Step 1: Write failing tests for the locks section**

Add to `src/__tests__/StepPopover.test.tsx`:

```typescript
import type { StepLocks } from '../app/types';

describe('StepPopover gain lock', () => {
  it('renders gain slider in locks section', () => {
    render(<StepPopover {...base} />);
    expect(screen.getByText('Locks'))
      .toBeTruthy();
    expect(
      screen.getByRole('slider', { name: 'Gain' })
    ).toBeTruthy();
  });

  it('slider starts at 100 when no lock exists',
    () => {
      render(<StepPopover {...base} />);
      const slider = screen.getByRole(
        'slider', { name: 'Gain' }
      );
      expect(slider.getAttribute('aria-valuenow'))
        .toBe('100');
    }
  );

  it('slider shows current lock value', () => {
    render(
      <StepPopover
        {...base}
        locks={{ gain: 0.6 }}
      />
    );
    const slider = screen.getByRole(
      'slider', { name: 'Gain' }
    );
    expect(slider.getAttribute('aria-valuenow'))
      .toBe('60');
  });

  it('Reset locks button clears locks', async () => {
    const { actions } = setupMockActions();
    render(
      <StepPopover
        {...base}
        locks={{ gain: 0.5 }}
      />
    );
    const resetBtn = screen.getByText('Reset locks');
    fireEvent.click(resetBtn);
    expect(actions.clearParameterLock)
      .toHaveBeenCalledWith('bd', 0);
  });
});
```

Note: The test setup mocks `useSequencer`. Add
`setParameterLock: vi.fn()` and
`clearParameterLock: vi.fn()` to the mocked actions
object (follow the existing pattern where
`setTrigCondition` and `clearTrigCondition` are mocked).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/__tests__/StepPopover.test.tsx`
Expected: FAIL — no "Locks" heading, no gain slider.

- [ ] **Step 3: Add `locks` prop and gain slider to StepPopover**

Add to `StepPopoverProps` interface:

```typescript
  locks?: StepLocks;
```

Add import for `RangeSlider` and `StepLocks`:

```typescript
import RangeSlider from './RangeSlider';
import type {
  StepConditions, StepLocks, TrackId,
} from './types';
```

Add state for gain (after fillValue state):

```typescript
  const [gainValue, setGainValue] = useState(
    locks?.gain !== undefined
      ? Math.round(locks.gain * 100)
      : 100
  );
  const gainTouched = useRef(false);
```

Add gain change handler (after handleFillChange):

```typescript
  const handleGainChange = useCallback(
    (v: number) => {
      setGainValue(v);
      gainTouched.current = true;
      actions.setParameterLock(
        trackId,
        stepIndex,
        { gain: v / 100 }
      );
    },
    [actions, trackId, stepIndex]
  );
```

Add the locks section JSX after the Fill section's
closing `</div>` and before the popover's closing
`</div>`:

```tsx
      {/* Divider */}
      <div className="border-t border-neutral-700" />

      {/* Locks section */}
      <div className={
        'flex items-center justify-between'
      }>
        <div className={
          'text-xs font-bold uppercase'
          + ' tracking-wider text-neutral-400'
        }>
          Locks
        </div>
        <button
          onClick={() => {
            actions.clearParameterLock(
              trackId, stepIndex
            );
            setGainValue(100);
            gainTouched.current = false;
          }}
          disabled={locks === undefined}
          className={
            'text-[11px] px-1.5 py-0.5 rounded'
            + ' border transition-colors'
            + (locks !== undefined
              ? ' text-neutral-400'
                + ' hover:text-neutral-200'
                + ' border-neutral-700'
                + ' hover:bg-neutral-800'
              : ' text-neutral-700'
                + ' border-neutral-800'
                + ' cursor-default')
          }
        >
          Reset locks
        </button>
      </div>

      <div className="space-y-1">
        <div className={
          'text-[10px] uppercase tracking-wider'
          + ' text-neutral-500'
        }>
          Gain
        </div>
        <RangeSlider
          value={gainValue}
          min={0}
          max={100}
          onChange={handleGainChange}
          label="Gain"
        />
      </div>
```

- [ ] **Step 4: Pass `locks` prop from StepGrid**

In `src/app/StepGrid.tsx`, update the `<StepPopover>`
rendering (around line 175) to pass `locks`:

```tsx
        <StepPopover
          trackId={openPopover.trackId}
          stepIndex={openPopover.stepIndex}
          conditions={
            config.trigConditions[
              openPopover.trackId
            ]?.[openPopover.stepIndex]
          }
          locks={
            config.parameterLocks[
              openPopover.trackId
            ]?.[openPopover.stepIndex]
          }
          anchorRect={openPopover.anchorRect}
          onClose={() => setOpenPopover(null)}
          scrollContainerRef={scrollContainerRef}
        />
```

- [ ] **Step 5: Run StepPopover tests**

Run: `npm test -- --run src/__tests__/StepPopover.test.tsx`
Expected: All PASS.

- [ ] **Step 6: Run full test suite**

Run: `npm test -- --run`
Expected: All PASS.

- [ ] **Step 7: Commit**

```
git add src/app/StepPopover.tsx src/app/StepGrid.tsx \
  src/__tests__/StepPopover.test.tsx
git commit -m "Add gain lock slider to StepPopover"
```

---

## Task 7: StepButton — Opacity Indicator and Popover on Inactive Steps

**Files:**
- Modify: `src/app/StepButton.tsx:49-59,150`
- Modify: `src/__tests__/StepButton.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/StepButton.test.tsx`:

```typescript
describe('StepButton gain lock opacity', () => {
  it('active step with gain lock shows opacity',
    () => {
      render(
        <StepButton
          {...defaultProps}
          isActive={true}
          gainLock={0.5}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('0.5');
    }
  );

  it('active step with gain lock 0 shows min opacity',
    () => {
      render(
        <StepButton
          {...defaultProps}
          isActive={true}
          gainLock={0}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('0.2');
    }
  );

  it('inactive step with gain lock has no opacity',
    () => {
      render(
        <StepButton
          {...defaultProps}
          isActive={false}
          gainLock={0.3}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('');
    }
  );

  it('active step without gain lock has no opacity',
    () => {
      render(
        <StepButton
          {...defaultProps}
          isActive={true}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('');
    }
  );
});

describe('StepButton popover on inactive steps',
  () => {
    it('opens popover on inactive step right-click',
      () => {
        const onOpenPopover = vi.fn();
        render(
          <StepButton
            {...defaultProps}
            isActive={false}
            onOpenPopover={onOpenPopover}
          />
        );
        const btn = screen.getByRole('button');
        fireEvent.contextMenu(btn);
        expect(onOpenPopover).toHaveBeenCalled();
      }
    );
  }
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/__tests__/StepButton.test.tsx`
Expected: FAIL — no `gainLock` prop, popover blocked on
inactive.

- [ ] **Step 3: Add `gainLock` prop and opacity style**

In `StepButtonProps` interface, add:

```typescript
  gainLock?: number;
```

In the button's `style` prop (line 150), replace:

```typescript
      style={{ touchAction: 'manipulation' }}
```

With:

```typescript
      style={{
        touchAction: 'manipulation',
        ...(
          isActive && gainLock !== undefined
            ? {
                opacity: Math.max(0.2, gainLock),
              }
            : {}
        ),
      }}
```

- [ ] **Step 4: Remove `isActive` guard from `openPopover`**

In `openPopover` callback (line 51), change:

```typescript
      if (!isActive || !onOpenPopover) return;
```

To:

```typescript
      if (!onOpenPopover) return;
```

Also remove `isActive` from the dependency array (line 59).

- [ ] **Step 5: Pass `gainLock` from StepGrid → TrackRow → StepButton**

**StepGrid.tsx** — add prop to `<TrackRow>` (after the
`trigConditions` prop, around line 161):

```tsx
            parameterLocks={
              config.parameterLocks[track.id]
            }
```

**TrackRow.tsx** — add to `TrackRowProps` interface (after
`trigConditions`, around line 146):

```typescript
  parameterLocks?: Record<number, StepLocks>;
```

Add `StepLocks` to the import from `'./types'`.

Add `parameterLocks` to the destructured props (after
`trigConditions`, around line 183).

In the `<StepButton>` render (around line 403), add
after the `conditions` prop:

```tsx
                    gainLock={
                      parameterLocks?.[globalIdx]
                        ?.gain
                    }
```

- [ ] **Step 6: Run tests**

Run: `npm test -- --run`
Expected: All PASS.

- [ ] **Step 7: Commit**

```
git add src/app/StepButton.tsx src/app/StepGrid.tsx \
  src/app/TrackRow.tsx \
  src/__tests__/StepButton.test.tsx
git commit -m "Add gain lock opacity and inactive popover"
```

---

## Task 8: Lint, Build, and Browser Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run linter**

Run: `npm run lint`
Expected: Zero errors.

- [ ] **Step 2: Run full test suite**

Run: `npm test -- --run`
Expected: All PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 4: Browser test**

Start dev server: `npm run dev`

Test in browser:
1. Right-click a step → popover shows "Locks" section
   with gain slider at 100%
2. Drag gain slider to ~50% → step button dims to ~50%
   opacity
3. Play the pattern → the gain-locked step plays quieter
4. Right-click an inactive step → popover opens
5. Set gain lock on inactive step → no visual change
6. Activate the step → opacity indicator appears
7. Click "Reset locks" → opacity returns to full
8. Share URL → reload → gain locks preserved

- [ ] **Step 5: Stop dev server**

- [ ] **Step 6: Final commit if any lint fixes were needed**

```
git add -A
git commit -m "Fix lint issues"
```

---

## Verification Checklist

- [ ] `npm run lint` — zero errors
- [ ] `npm test -- --run` — all pass
- [ ] `npm run build` — clean static export
- [ ] Browser: gain slider in popover works
- [ ] Browser: opacity indicator on active steps
- [ ] Browser: popover opens on inactive steps
- [ ] Browser: URL sharing preserves gain locks
- [ ] Browser: accent stacks on gain-locked steps
- [ ] Browser: playback glow visible on dim steps
