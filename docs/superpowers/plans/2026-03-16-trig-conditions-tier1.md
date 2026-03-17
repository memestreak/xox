# Trig Conditions Tier 1: Probability & Cycle A:B

> **For agentic workers:** REQUIRED: Use
> superpowers:subagent-driven-development (if subagents
> available) or superpowers:executing-plans to implement
> this plan. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Add probability (X%) and cycle (A:B) trig
conditions so individual steps can fire conditionally,
creating evolving patterns without long sequences.

**Architecture:** A new `TrigCondition` union type and
`trigConditions` sparse map are added to `SequencerConfig`
(version 3). A pure `evaluateCondition()` function is
extracted into its own module and called from `handleStep`.
`cycleCount` transient state tracks per-track loop
iterations. configCodec is bumped to v3 with backward
compat for v1/v2 URLs.

**Tech Stack:** TypeScript, React, Vitest, Next.js

**Issues:** [#5](https://github.com/memestreak/xox/issues/5)
(engine, partial), [#6](https://github.com/memestreak/xox/issues/6)
(UI, not in scope — Tier 1 is engine only)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/types.ts` | Modify | Add `TrigCondition` type, `trigConditions` to `SequencerConfig`, optional `trigConditions?` to `Pattern` |
| `src/app/trigConditions.ts` | Create | Pure `evaluateCondition()` function |
| `src/app/configCodec.ts` | Modify | Bump to v3, add `validateTrigConditions()`, update `defaultConfig()` |
| `src/app/SequencerContext.tsx` | Modify | Add `cycleCount` ref, wire `evaluateCondition` into `handleStep`, add `setTrigCondition`/`clearTrigCondition` actions, prune on track/pattern length change, reset `trigConditions` in `clearAll`, clear and load conditions in `setPattern` |
| `src/__tests__/trigConditions.test.ts` | Create | Unit tests for `evaluateCondition` |
| `src/__tests__/handleStep.test.ts` | Modify | Integration tests for conditions in `handleStep` |
| `src/__tests__/configCodec.test.ts` | Modify | Validation tests for `trigConditions` field |
| `src/__tests__/configCodec.golden.test.ts` | Modify | v3 golden hash, v1/v2 backward compat tests |

---

## Task 1: Types, configCodec v3, and golden tests

Types and configCodec must land together — adding
`trigConditions` to `SequencerConfig` without updating
`defaultConfig()` and `validateConfig()` would break
compilation.

**Files:**
- Modify: `src/app/types.ts`
- Modify: `src/app/configCodec.ts`
- Modify: `src/__tests__/configCodec.test.ts`
- Modify: `src/__tests__/configCodec.golden.test.ts`

- [ ] **Step 1: Write failing tests for trigConditions validation**

In `src/__tests__/configCodec.test.ts`, add a new
describe block:

```typescript
describe('trigConditions validation', () => {
  it('missing trigConditions defaults to empty',
    async () => {
      const config = makeConfig();
      delete (config as Record<string, unknown>)
        .trigConditions;
      const hash = await encodeRaw(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({});
    }
  );

  it('valid probability condition round-trips',
    async () => {
      const config = makeConfig({
        trigConditions: {
          bd: {
            0: { type: 'probability', value: 50 },
          },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({
        bd: {
          0: { type: 'probability', value: 50 },
        },
      });
    }
  );

  it('valid cycle condition round-trips',
    async () => {
      const config = makeConfig({
        trigConditions: {
          sd: {
            3: { type: 'cycle', a: 1, b: 4 },
          },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({
        sd: {
          3: { type: 'cycle', a: 1, b: 4 },
        },
      });
    }
  );

  it('invalid condition type is dropped',
    async () => {
      const config = {
        ...makeConfig(),
        trigConditions: {
          bd: { 0: { type: 'bogus' } },
        },
      };
      const hash = await encodeRaw(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({});
    }
  );

  it('probability value clamped to 1-99',
    async () => {
      const config = makeConfig({
        trigConditions: {
          bd: {
            0: {
              type: 'probability', value: 150,
            },
            1: {
              type: 'probability', value: -5,
            },
          },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      const bd = decoded.trigConditions.bd!;
      expect(bd[0]).toEqual(
        { type: 'probability', value: 99 }
      );
      expect(bd[1]).toEqual(
        { type: 'probability', value: 1 }
      );
    }
  );

  it('cycle b clamped to 2-8', async () => {
    const config = makeConfig({
      trigConditions: {
        bd: {
          0: { type: 'cycle', a: 0, b: 200 },
        },
      },
    });
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions.bd![0]).toEqual(
      { type: 'cycle', a: 1, b: 8 }
    );
  });

  it('cycle b=1 is dropped (minimum is 2)',
    async () => {
      const config = makeConfig({
        trigConditions: {
          bd: {
            0: { type: 'cycle', a: 1, b: 1 },
          },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({});
    }
  );

  it('cycle a > b is clamped to a = b',
    async () => {
      const config = makeConfig({
        trigConditions: {
          bd: {
            0: { type: 'cycle', a: 5, b: 3 },
          },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions.bd![0]).toEqual(
        { type: 'cycle', a: 3, b: 3 }
      );
    }
  );

  it('step index beyond track length is dropped',
    async () => {
      const config = makeConfig({
        trigConditions: {
          bd: {
            99: {
              type: 'probability', value: 50,
            },
          },
        },
      });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({});
    }
  );

  it('non-object trigConditions defaults to empty',
    async () => {
      const config = {
        ...makeConfig(),
        trigConditions: 'garbage',
      };
      const hash = await encodeRaw(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.trigConditions).toEqual({});
    }
  );
});
```

Also update the existing `'wrong version number is
overwritten'` test — change the expected version from
`toBe(2)` to `toBe(3)`.

- [ ] **Step 2: Add TrigCondition type to types.ts**

At the end of `src/app/types.ts`, add:

```typescript
/**
 * A trig condition that gates whether a step fires.
 * One condition per step. Absent = always fire.
 */
export type TrigCondition =
  | { type: 'probability'; value: number }
  | { type: 'cycle'; a: number; b: number };
```

Add `trigConditions` to `SequencerConfig` (after
`swing`):

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
  trigConditions: Partial<
    Record<TrackId, Record<number, TrigCondition>>
  >;
}
```

The outer `Partial` means tracks with no conditions are
simply absent. The inner `Record<number, TrigCondition>`
is sparse — only step indices with conditions have
entries.

Also add optional `trigConditions` to the `Pattern`
interface so patterns can carry conditions:

```typescript
export interface Pattern {
  id: string;
  name: string;
  steps: Record<TrackId, string>;
  trigConditions?: Partial<
    Record<
      TrackId, Record<number, TrigCondition>
    >
  >;
}
```

The `?` makes the field optional. Existing
`patterns.json` is **not modified** — preset patterns
simply lack the field, which defaults to `{}`.

- [ ] **Step 3: Bump CONFIG_VERSION and update defaultConfig**

In `src/app/configCodec.ts`:

Change line 12:
```typescript
const CONFIG_VERSION = 3;
```

Add `TrigCondition` to the import from `./types`
(line 5-9):

```typescript
import type {
  SequencerConfig,
  TrackId,
  TrackMixerState,
  TrigCondition,
} from './types';
```

In `defaultConfig()` (line 37-46), add `trigConditions`
to the return object:

```typescript
  return {
    version: CONFIG_VERSION,
    kitId: kitsData.kits[0].id,
    bpm: DEFAULT_BPM,
    patternLength: DEFAULT_PATTERN_LENGTH,
    trackLengths,
    steps: firstPattern.steps as
      Record<TrackId, string>,
    mixer,
    swing: 0,
    trigConditions: {},
  };
```

- [ ] **Step 4: Add validateTrigConditions function**

Add after `validateSwing()` (after line 215):

```typescript
/**
 * Validate trig conditions. Returns a sparse map
 * containing only valid conditions on valid step
 * indices.
 */
function validateTrigConditions(
  value: unknown,
  trackLengths: Record<TrackId, number>
): Partial<
  Record<TrackId, Record<number, TrigCondition>>
> {
  if (value === null || typeof value !== 'object') {
    return {};
  }
  const obj = value as Record<string, unknown>;
  const result: Partial<
    Record<TrackId, Record<number, TrigCondition>>
  > = {};

  for (const id of TRACK_IDS) {
    const trackConds = obj[id];
    if (
      trackConds === null ||
      typeof trackConds !== 'object'
    ) {
      continue;
    }
    const tc =
      trackConds as Record<string, unknown>;
    const validated:
      Record<number, TrigCondition> = {};
    for (const [key, cond] of Object.entries(tc)) {
      const stepIdx = Number(key);
      if (
        !Number.isInteger(stepIdx) ||
        stepIdx < 0 ||
        stepIdx >= trackLengths[id]
      ) {
        continue;
      }
      const parsed =
        validateSingleCondition(cond);
      if (parsed !== null) {
        validated[stepIdx] = parsed;
      }
    }
    if (Object.keys(validated).length > 0) {
      result[id] = validated;
    }
  }
  return result;
}

function validateSingleCondition(
  value: unknown
): TrigCondition | null {
  if (
    value === null || typeof value !== 'object'
  ) {
    return null;
  }
  const obj = value as Record<string, unknown>;

  if (obj.type === 'probability') {
    if (
      typeof obj.value !== 'number' ||
      !isFinite(obj.value)
    ) {
      return null;
    }
    return {
      type: 'probability',
      value: Math.max(
        1, Math.min(99, Math.round(obj.value))
      ),
    };
  }

  if (obj.type === 'cycle') {
    if (
      typeof obj.a !== 'number' ||
      !isFinite(obj.a) ||
      typeof obj.b !== 'number' ||
      !isFinite(obj.b)
    ) {
      return null;
    }
    const rawB = Math.round(obj.b);
    if (rawB < 2) return null;
    const b = Math.min(8, rawB);
    const a = Math.max(
      1, Math.min(b, Math.round(obj.a))
    );
    return { type: 'cycle', a, b };
  }

  return null;
}
```

- [ ] **Step 5: Wire validateTrigConditions into validateConfig**

In `validateConfig()` (lines 138-174), add after
`validateSwing`:

```typescript
  const trigConditions = validateTrigConditions(
    obj.trigConditions, trackLengths
  );
```

And include it in the return object:

```typescript
  return {
    version: CONFIG_VERSION,
    kitId,
    bpm,
    patternLength,
    trackLengths,
    steps,
    mixer,
    swing,
    trigConditions,
  };
```

- [ ] **Step 6: Update golden tests for v3**

In `src/__tests__/configCodec.golden.test.ts`:

Update `goldenConfigV1Decoded()` — change `version: 2`
to `version: 3` and add `trigConditions: {}`:

```typescript
function goldenConfigV1Decoded(): SequencerConfig {
  // ... existing setup code unchanged ...
  return {
    version: 3,
    kitId: 'electro',
    bpm: 140,
    patternLength: 16,
    trackLengths,
    steps,
    mixer,
    swing: 0,
    trigConditions: {},
  };
}
```

Update `goldenConfigV2()` — add `trigConditions: {}`:

```typescript
function goldenConfigV2(): SequencerConfig {
  // ... existing setup code unchanged ...
  return {
    version: 2,
    kitId: 'electro',
    bpm: 140,
    patternLength: 12,
    trackLengths,
    steps,
    mixer,
    swing: 0,
    trigConditions: {},
  };
}
```

Update the v2 round-trip test — `decodeConfig` stamps
v3, so the decoded version won't match the input:

```typescript
it('v2 config round-trips identically',
  async () => {
    const config = goldenConfigV2();
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual({
      ...config,
      version: 3,
    });
  }
);
```

Add `encodeRaw` helper (duplicate the 10-line helper
from `configCodec.test.ts` at the top of the golden
test file):

```typescript
async function encodeRaw(
  obj: unknown
): Promise<string> {
  const json = JSON.stringify(obj);
  const stream = new Blob([json]).stream()
    .pipeThrough(
      new CompressionStream('deflate-raw')
    );
  const bytes = new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

Add a new v2 backward compat test:

```typescript
function goldenConfigV2Decoded(): SequencerConfig {
  return {
    ...goldenConfigV2(),
    version: 3,
  };
}

it('v2 hash decodes with trigConditions defaulted',
  async () => {
    const v2Config = goldenConfigV2();
    const v2Only = { ...v2Config };
    delete (v2Only as Record<string, unknown>)
      .trigConditions;
    const hash = await encodeRaw(v2Only);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(
      goldenConfigV2Decoded()
    );
  }
);
```

- [ ] **Step 7: Run tests and update snapshots**

Run: `npm test -- --update-snapshots`
Expected: snapshot updates to include
`trigConditions: {}`, all tests pass.

Note: SequencerContext.tsx will have type errors at
this point because it constructs `SequencerConfig`
objects without `trigConditions` in some actions. Those
are fixed in Task 3. Verify that the configCodec and
golden tests pass in isolation:

Run: `npm test -- src/__tests__/configCodec`

- [ ] **Step 8: Commit**

```
git add src/app/types.ts src/app/configCodec.ts \
  src/__tests__/configCodec.test.ts \
  src/__tests__/configCodec.golden.test.ts
git commit -m "Add TrigCondition type and configCodec v3"
```

---

## Task 2: Create evaluateCondition module

**Files:**
- Create: `src/app/trigConditions.ts`
- Create: `src/__tests__/trigConditions.test.ts`

- [ ] **Step 1: Write tests for evaluateCondition**

Create `src/__tests__/trigConditions.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateCondition,
} from '../app/trigConditions';
import type { TrigCondition } from '../app/types';

describe('evaluateCondition', () => {
  describe('no condition (undefined)', () => {
    it('always fires', () => {
      expect(evaluateCondition(undefined, {
        cycleCount: 0,
      })).toBe(true);
    });
  });

  describe('probability', () => {
    const cond: TrigCondition = {
      type: 'probability', value: 50,
    };

    it('fires when random < threshold', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValue(0.49);
      expect(evaluateCondition(cond, {
        cycleCount: 0,
      })).toBe(true);
      vi.restoreAllMocks();
    });

    it('does not fire when random >= threshold',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.50);
        expect(evaluateCondition(cond, {
          cycleCount: 0,
        })).toBe(false);
        vi.restoreAllMocks();
      }
    );

    it('1% fires when random < 0.01', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValue(0.009);
      const c: TrigCondition = {
        type: 'probability', value: 1,
      };
      expect(evaluateCondition(c, {
        cycleCount: 0,
      })).toBe(true);
      vi.restoreAllMocks();
    });

    it('99% does not fire when random >= 0.99',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.99);
        const c: TrigCondition = {
          type: 'probability', value: 99,
        };
        expect(evaluateCondition(c, {
          cycleCount: 0,
        })).toBe(false);
        vi.restoreAllMocks();
      }
    );
  });

  describe('cycle A:B', () => {
    it('1:4 fires on cycle 0 (1st of every 4)',
      () => {
        const cond: TrigCondition = {
          type: 'cycle', a: 1, b: 4,
        };
        expect(evaluateCondition(cond, {
          cycleCount: 0,
        })).toBe(true);
      }
    );

    it('1:4 does not fire on cycles 1-3', () => {
      const cond: TrigCondition = {
        type: 'cycle', a: 1, b: 4,
      };
      expect(evaluateCondition(cond, {
        cycleCount: 1,
      })).toBe(false);
      expect(evaluateCondition(cond, {
        cycleCount: 2,
      })).toBe(false);
      expect(evaluateCondition(cond, {
        cycleCount: 3,
      })).toBe(false);
    });

    it('3:4 fires on cycle 2 (3rd of every 4)',
      () => {
        const cond: TrigCondition = {
          type: 'cycle', a: 3, b: 4,
        };
        expect(evaluateCondition(cond, {
          cycleCount: 2,
        })).toBe(true);
      }
    );

    it('2:2 fires on odd cycles (0-indexed)',
      () => {
        const cond: TrigCondition = {
          type: 'cycle', a: 2, b: 2,
        };
        expect(evaluateCondition(cond, {
          cycleCount: 0,
        })).toBe(false);
        expect(evaluateCondition(cond, {
          cycleCount: 1,
        })).toBe(true);
        expect(evaluateCondition(cond, {
          cycleCount: 2,
        })).toBe(false);
        expect(evaluateCondition(cond, {
          cycleCount: 3,
        })).toBe(true);
      }
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/trigConditions.test.ts`
Expected: FAIL — module `trigConditions` does not exist

- [ ] **Step 3: Implement evaluateCondition**

Create `src/app/trigConditions.ts`:

```typescript
import type { TrigCondition } from './types';

/**
 * Context needed to evaluate a trig condition.
 */
export interface ConditionContext {
  /**
   * Current cycle count for this track
   * (0-indexed).
   */
  cycleCount: number;
}

/**
 * Evaluate whether a step should fire given its
 * condition and the current context.
 *
 * Returns true if:
 * - No condition (undefined) -- always fire
 * - Probability: Math.random() < value/100
 * - Cycle A:B: (cycleCount % b) === (a - 1)
 *
 * Args:
 *   condition: The trig condition, or undefined
 *     for unconditional steps.
 *   ctx: Current evaluation context.
 *
 * Returns:
 *   Whether the step should fire.
 */
export function evaluateCondition(
  condition: TrigCondition | undefined,
  ctx: ConditionContext
): boolean {
  if (condition === undefined) return true;

  switch (condition.type) {
    case 'probability':
      return Math.random() <
        condition.value / 100;
    case 'cycle':
      return (
        ctx.cycleCount % condition.b ===
        condition.a - 1
      );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/trigConditions.test.ts`
Expected: all pass

- [ ] **Step 5: Run lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```
git add src/app/trigConditions.ts \
  src/__tests__/trigConditions.test.ts
git commit -m "Add evaluateCondition for probability and cycle"
```

---

## Task 3: Wire evaluateCondition into handleStep

**Files:**
- Modify: `src/app/SequencerContext.tsx`
- Modify: `src/__tests__/handleStep.test.ts`

- [ ] **Step 1: Write failing integration tests**

In `src/__tests__/handleStep.test.ts`, add a new
describe block. These tests verify that conditions are
consulted during step evaluation. The `clearAll` action
is used to get a clean slate with only the tracks we
care about active.

```typescript
describe('trig conditions in handleStep', () => {
  it('step with probability condition can be '
    + 'suppressed', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValue(0.99);

    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.clearAll();
    });
    await act(async () => {
      result.current.actions
        .toggleStep('bd', 0);
    });
    await act(async () => {
      result.current.actions.setTrigCondition(
        'bd', 0,
        { type: 'probability', value: 50 }
      );
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep =
      mockStart.mock.calls[0][1] as (
        step: number, time: number
      ) => void;
    await waitFor(() => {
      expect(result.current.state.isPlaying)
        .toBe(true);
    });
    mockPlaySound.mockClear();

    onStep(0, 0.0);

    expect(mockPlaySound)
      .not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('step without condition always fires',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.clearAll();
      });
      await act(async () => {
        result.current.actions
          .toggleStep('bd', 0);
      });

      mockPlaySound.mockClear();
      mockStart.mockClear();

      await act(async () => {
        result.current.actions.togglePlay();
      });

      const onStep =
        mockStart.mock.calls[0][1] as (
          step: number, time: number
        ) => void;
      await waitFor(() => {
        expect(result.current.state.isPlaying)
          .toBe(true);
      });
      mockPlaySound.mockClear();

      onStep(0, 0.0);

      expect(mockPlaySound)
        .toHaveBeenCalledTimes(1);
      expect(mockPlaySound.mock.calls[0][0])
        .toBe('bd');
    }
  );

  it('clearTrigCondition removes condition',
    async () => {
      const { result } = renderSequencer();

      await act(async () => {
        result.current.actions.setTrigCondition(
          'bd', 0,
          { type: 'probability', value: 50 }
        );
      });

      expect(
        result.current.meta.config
          .trigConditions.bd?.[0]
      ).toBeDefined();

      await act(async () => {
        result.current.actions
          .clearTrigCondition('bd', 0);
      });

      expect(
        result.current.meta.config
          .trigConditions.bd?.[0]
      ).toBeUndefined();
    }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/handleStep.test.ts`
Expected: FAIL — `setTrigCondition` and
`clearTrigCondition` don't exist yet

- [ ] **Step 3: Add imports and cycleCount ref**

In `src/app/SequencerContext.tsx`:

Add imports at top:

```typescript
import {
  evaluateCondition,
} from './trigConditions';
import type { TrigCondition } from './types';
```

Add `cycleCountRef` near the other refs (around
line 240, after `configRef`):

```typescript
const cycleCountRef = useRef<
  Record<TrackId, number>
>({} as Record<TrackId, number>);
```

- [ ] **Step 4: Wire condition evaluation into handleStep**

In `handleStep` (line 284), make these changes:

**Add cycle count increment** after the `anySolo`
check (line 304) and before the accent evaluation:

```typescript
      // Increment cycle count for tracks at
      // their cycle boundary
      for (const id of TRACK_IDS) {
        const len = cfg.trackLengths[id];
        if (total > 0 && total % len === 0) {
          cycleCountRef.current[id] =
            (cycleCountRef.current[id] ?? 0)
            + 1;
        }
      }
```

**Replace the `isAccented` const** (lines 315-318)
with condition-aware version. This goes AFTER the
cycle increment so accent sees the updated count:

```typescript
      const accentStep = trackStep('ac');
      const accentActive =
        pattern.steps.ac[accentStep] === '1';
      let isAccented = false;
      if (accentActive) {
        const accentCond =
          cfg.trigConditions?.ac?.[accentStep];
        isAccented = evaluateCondition(
          accentCond, {
            cycleCount:
              cycleCountRef.current.ac ?? 0,
          }
        );
      }
```

**Add condition check** inside the `TRACKS.forEach`
loop. After `pattern.steps[track.id][effectiveStep]
=== '1'`, add before the gain/playSound code:

```typescript
          const cond =
            cfg.trigConditions?.[track.id]?.[
              effectiveStep
            ];
          const shouldFire = evaluateCondition(
            cond, {
              cycleCount:
                cycleCountRef.current[track.id]
                ?? 0,
            }
          );
          if (!shouldFire) return;
```

The full inner loop becomes:

```typescript
      TRACKS.forEach(track => {
        const st = states[track.id];
        const audible = anySolo
          ? st.isSolo
          : !st.isMuted;
        if (!audible) return;

        const effectiveStep =
          trackStep(track.id);
        if (
          pattern.steps[track.id][effectiveStep]
            === '1'
        ) {
          const cond =
            cfg.trigConditions?.[track.id]?.[
              effectiveStep
            ];
          const shouldFire = evaluateCondition(
            cond, {
              cycleCount:
                cycleCountRef.current[track.id]
                ?? 0,
            }
          );
          if (!shouldFire) return;

          const cubic = st.gain ** 3;
          const gain =
            isAccented ? cubic * 1.5 : cubic;
          audioEngine.playSound(
            track.id, scheduledTime, gain
          );
        }
      });
```

- [ ] **Step 5: Initialize and reset cycleCount in togglePlay**

In `togglePlay` (line 351):

**Start branch** (after `totalStepsRef.current = 0`
on line 358):

```typescript
      const counts =
        {} as Record<TrackId, number>;
      for (const id of TRACK_IDS) {
        counts[id] = 0;
      }
      cycleCountRef.current = counts;
```

**Stop branch** (after `totalStepsRef.current = 0`
on line 356):

```typescript
      const counts =
        {} as Record<TrackId, number>;
      for (const id of TRACK_IDS) {
        counts[id] = 0;
      }
      cycleCountRef.current = counts;
```

- [ ] **Step 6: Add setTrigCondition and clearTrigCondition actions**

Add to the `SequencerActions` interface (around
line 90):

```typescript
  setTrigCondition: (
    trackId: TrackId,
    stepIndex: number,
    condition: TrigCondition
  ) => void;
  clearTrigCondition: (
    trackId: TrackId,
    stepIndex: number
  ) => void;
```

Add implementations after the existing actions
(before the `useMemo` that assembles the return
value):

```typescript
  const setTrigCondition = useCallback(
    (
      trackId: TrackId,
      stepIndex: number,
      condition: TrigCondition
    ) => {
      setConfig(prev => {
        const trackConds = {
          ...prev.trigConditions[trackId],
        };
        trackConds[stepIndex] = condition;
        return {
          ...prev,
          trigConditions: {
            ...prev.trigConditions,
            [trackId]: trackConds,
          },
        };
      });
    },
    []
  );

  const clearTrigCondition = useCallback(
    (trackId: TrackId, stepIndex: number) => {
      setConfig(prev => {
        const trackConds = {
          ...prev.trigConditions[trackId],
        };
        delete trackConds[stepIndex];
        const newConditions = {
          ...prev.trigConditions,
        };
        if (
          Object.keys(trackConds).length === 0
        ) {
          delete newConditions[trackId];
        } else {
          newConditions[trackId] = trackConds;
        }
        return {
          ...prev,
          trigConditions: newConditions,
        };
      });
    },
    []
  );
```

Add both to the `useMemo` actions return object.

- [ ] **Step 7: Reset trigConditions in clearAll**

In the `clearAll` action (around line 573), add
`trigConditions: {}` to the returned config object
so clearing all state also removes all conditions:

```typescript
  const clearAll = useCallback(() => {
    setConfig(prev => {
      // ... existing steps/trackLengths/swing
      // reset code ...
      return {
        ...prev,
        steps: newSteps,
        trackLengths: newTrackLengths,
        swing: 0,
        trigConditions: {},
      };
    });
    setSelectedPatternId('custom');
  }, []);
```

- [ ] **Step 8: Reset cycle count on mute/solo toggle**

In the `toggleMute` action (around line 525), add
cycle count reset for the toggled track:

```typescript
  const toggleMute = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            isMuted:
              !prev.mixer[trackId].isMuted,
          },
        },
      }));
      // Reset cycle count for this track
      cycleCountRef.current[trackId] = 0;
    },
    []
  );
```

Apply the same pattern to `toggleSolo` (around
line 541):

```typescript
  const toggleSolo = useCallback(
    (trackId: TrackId) => {
      setConfig(prev => ({
        ...prev,
        mixer: {
          ...prev.mixer,
          [trackId]: {
            ...prev.mixer[trackId],
            isSolo:
              !prev.mixer[trackId].isSolo,
          },
        },
      }));
      // Reset cycle count for this track
      cycleCountRef.current[trackId] = 0;
    },
    []
  );
```

- [ ] **Step 9: Clear and load conditions in setPattern**

In the `setPattern` action (around line 399), modify
it to replace `trigConditions` with the pattern's
conditions (defaulting to `{}` if absent):

```typescript
  const setPattern = useCallback(
    (pattern: Pattern) => {
      setConfig(prev => {
        const newSteps = { ...pattern.steps };
        for (const id of TRACK_IDS) {
          const cur = newSteps[id] ?? '';
          const len = prev.trackLengths[id];
          if (cur.length < len) {
            newSteps[id] =
              cur.padEnd(len, '0');
          } else if (cur.length > len) {
            newSteps[id] =
              cur.substring(0, len);
          }
        }
        return {
          ...prev,
          steps: newSteps,
          trigConditions:
            pattern.trigConditions ?? {},
        };
      });
      setSelectedPatternId(pattern.id);
    },
    []
  );
```

- [ ] **Step 10: Prune conditions on track length change**

In the existing `setTrackLength` action (line 494), add
condition pruning after step string truncation:

```typescript
  const setTrackLength = useCallback(
    (trackId: TrackId, length: number) => {
      setConfig(prev => {
        const clamped = Math.max(
          1,
          Math.min(prev.patternLength, length)
        );
        const cur = prev.steps[trackId];
        let newSteps: string;
        if (cur.length < clamped) {
          newSteps = cur.padEnd(clamped, '0');
        } else {
          newSteps =
            cur.substring(0, clamped);
        }

        // Prune conditions beyond new length
        const trackConds =
          prev.trigConditions[trackId];
        let newConditions =
          prev.trigConditions;
        if (trackConds) {
          const pruned: Record<
            number, TrigCondition
          > = {};
          for (
            const [k, v] of
            Object.entries(trackConds)
          ) {
            const idx = Number(k);
            if (idx < clamped) {
              pruned[idx] = v;
            }
          }
          newConditions = {
            ...prev.trigConditions,
          };
          if (
            Object.keys(pruned).length === 0
          ) {
            delete newConditions[trackId];
          } else {
            newConditions[trackId] = pruned;
          }
        }

        return {
          ...prev,
          steps: {
            ...prev.steps,
            [trackId]: newSteps,
          },
          trackLengths: {
            ...prev.trackLengths,
            [trackId]: clamped,
          },
          trigConditions: newConditions,
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );
```

- [ ] **Step 11: Prune conditions on pattern length change**

In the `setPatternLength` action (around line 457),
add condition pruning. `setPatternLength` shortens
all tracks to the new pattern length, so conditions
on steps beyond each track's new length must be
pruned:

```typescript
  const setPatternLength = useCallback(
    (length: number) => {
      setConfig(prev => {
        const clamped = Math.max(
          1, Math.min(64, length)
        );
        // ... existing step/trackLength logic ...

        // Prune conditions beyond new lengths
        const newConditions: Partial<
          Record<
            TrackId,
            Record<number, TrigCondition>
          >
        > = {};
        for (const id of TRACK_IDS) {
          const trackConds =
            prev.trigConditions[id];
          if (!trackConds) continue;
          const newLen = newTrackLengths[id];
          const pruned: Record<
            number, TrigCondition
          > = {};
          for (
            const [k, v] of
            Object.entries(trackConds)
          ) {
            const idx = Number(k);
            if (idx < newLen) {
              pruned[idx] = v;
            }
          }
          if (
            Object.keys(pruned).length > 0
          ) {
            newConditions[id] = pruned;
          }
        }

        return {
          ...prev,
          patternLength: clamped,
          trackLengths: newTrackLengths,
          steps: newSteps,
          trigConditions: newConditions,
        };
      });
      setSelectedPatternId('custom');
    },
    []
  );
```

- [ ] **Step 12: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 13: Run lint**

Run: `npm run lint`
Expected: clean

- [ ] **Step 14: Commit**

```
git add src/app/SequencerContext.tsx \
  src/__tests__/handleStep.test.ts
git commit -m "Wire trig conditions into handleStep"
```

---

## Task 4: Add condition pruning tests

**Files:**
- Modify: `src/__tests__/handleStep.test.ts`

- [ ] **Step 1: Write pruning tests**

First, add these imports at the top of
`handleStep.test.ts` (alongside existing imports):

```typescript
import patternsData
  from '../app/data/patterns.json';
import type { Pattern } from '../app/types';
```

Then add to the `trig conditions in handleStep`
describe block:

```typescript
it('shortening track prunes conditions '
  + 'beyond length', async () => {
  const { result } = renderSequencer();

  await act(async () => {
    result.current.actions.setTrigCondition(
      'bd', 15,
      { type: 'probability', value: 50 }
    );
  });

  expect(
    result.current.meta.config
      .trigConditions.bd?.[15]
  ).toBeDefined();

  await act(async () => {
    result.current.actions
      .setTrackLength('bd', 8);
  });

  expect(
    result.current.meta.config
      .trigConditions.bd?.[15]
  ).toBeUndefined();
});

it('shortening track preserves conditions '
  + 'within length', async () => {
  const { result } = renderSequencer();

  await act(async () => {
    result.current.actions.setTrigCondition(
      'bd', 3,
      { type: 'probability', value: 50 }
    );
  });

  await act(async () => {
    result.current.actions
      .setTrackLength('bd', 8);
  });

  expect(
    result.current.meta.config
      .trigConditions.bd?.[3]
  ).toEqual(
    { type: 'probability', value: 50 }
  );
});

it('shortening pattern length prunes '
  + 'conditions', async () => {
  const { result } = renderSequencer();

  await act(async () => {
    result.current.actions.setTrigCondition(
      'bd', 15,
      { type: 'probability', value: 50 }
    );
  });

  await act(async () => {
    result.current.actions
      .setPatternLength(8);
  });

  expect(
    result.current.meta.config
      .trigConditions.bd?.[15]
  ).toBeUndefined();
});

it('clearAll resets trigConditions',
  async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setTrigCondition(
        'bd', 0,
        { type: 'probability', value: 50 }
      );
    });

    expect(
      result.current.meta.config
        .trigConditions.bd?.[0]
    ).toBeDefined();

    await act(async () => {
      result.current.actions.clearAll();
    });

    expect(
      result.current.meta.config
        .trigConditions
    ).toEqual({});
  }
);

it('loading preset clears conditions',
  async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.setTrigCondition(
        'bd', 0,
        { type: 'probability', value: 50 }
      );
    });

    expect(
      result.current.meta.config
        .trigConditions.bd?.[0]
    ).toBeDefined();

    // Load a preset pattern (no trigConditions)
    const preset = patternsData.patterns[0];

    await act(async () => {
      result.current.actions.setPattern(
        preset as Pattern
      );
    });

    expect(
      result.current.meta.config
        .trigConditions
    ).toEqual({});
  }
);

it('toggling step off preserves condition',
  async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions
        .toggleStep('bd', 0);
    });
    await act(async () => {
      result.current.actions.setTrigCondition(
        'bd', 0,
        { type: 'probability', value: 50 }
      );
    });

    // Toggle step off
    await act(async () => {
      result.current.actions
        .toggleStep('bd', 0);
    });

    // Condition persists on inactive step
    expect(
      result.current.meta.config
        .trigConditions.bd?.[0]
    ).toEqual(
      { type: 'probability', value: 50 }
    );

    // Toggle step back on
    await act(async () => {
      result.current.actions
        .toggleStep('bd', 0);
    });

    // Condition still there
    expect(
      result.current.meta.config
        .trigConditions.bd?.[0]
    ).toEqual(
      { type: 'probability', value: 50 }
    );
  }
);

it('mute resets cycle count for that track',
  async () => {
    const { result } = renderSequencer();

    await act(async () => {
      result.current.actions.clearAll();
    });
    await act(async () => {
      result.current.actions
        .toggleStep('bd', 0);
    });
    await act(async () => {
      result.current.actions.setTrigCondition(
        'bd', 0,
        { type: 'cycle', a: 2, b: 2 }
      );
    });

    mockPlaySound.mockClear();
    mockStart.mockClear();

    await act(async () => {
      result.current.actions.togglePlay();
    });

    const onStep =
      mockStart.mock.calls[0][1] as (
        step: number, time: number
      ) => void;
    await waitFor(() => {
      expect(result.current.state.isPlaying)
        .toBe(true);
    });

    // Play 16 steps (one cycle), then 16 more
    // (second cycle where 2:2 fires)
    for (let i = 0; i < 32; i++) {
      onStep(i % 16, i * 0.125);
    }

    // Mute bd — should reset its cycle count
    await act(async () => {
      result.current.actions.toggleMute('bd');
    });

    // Unmute bd
    await act(async () => {
      result.current.actions.toggleMute('bd');
    });

    // After unmute, cycle count is back to 0.
    // Next step 0 should NOT fire (2:2 fires
    // on cycle 1, not cycle 0)
    mockPlaySound.mockClear();
    onStep(0, 100.0);

    const playedIds =
      mockPlaySound.mock.calls.map(
        (c: unknown[]) => c[0]
      );
    expect(playedIds).not.toContain('bd');

    vi.restoreAllMocks();
  }
);
```

- [ ] **Step 2: Add E2E URL hash import test**

In `src/__tests__/SequencerContext.test.tsx`, add to
the existing `'URL hash import'` describe block:

```typescript
it('v3 hash with trigConditions sets '
  + 'conditions in state', async () => {
  const config = defaultConfig();
  config.trigConditions = {
    bd: {
      0: { type: 'probability', value: 50 },
    },
    sd: {
      3: { type: 'cycle', a: 1, b: 4 },
    },
  };
  const hash = await encodeConfig(config);
  window.location.hash = hash;

  const { result } = renderSequencer();
  await waitFor(() => {
    expect(
      result.current.meta.config
        .trigConditions.bd?.[0]
    ).toBeDefined();
  });
  expect(
    result.current.meta.config
      .trigConditions.bd![0]
  ).toEqual(
    { type: 'probability', value: 50 }
  );
  expect(
    result.current.meta.config
      .trigConditions.sd![3]
  ).toEqual(
    { type: 'cycle', a: 1, b: 4 }
  );
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 4: Commit**

```
git add src/__tests__/handleStep.test.ts \
  src/__tests__/SequencerContext.test.tsx
git commit -m "Add pruning, lifecycle, and E2E tests for trig conditions"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: clean

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: clean static export

- [ ] **Step 4: Manual smoke test**

Start dev server (`npm run dev`), open in browser:
1. Verify normal playback is unchanged (no
   conditions set)
2. This is engine-only (no UI yet), so manual
   verification is limited to confirming no runtime
   errors during playback

- [ ] **Step 5: Stop the dev server**

- [ ] **Step 6: Commit any remaining changes and
create PR**

**Spec:**
`docs/superpowers/specs/2026-03-17-trig-conditions-tier1-spec.md`

**Design decisions:**
- Cycle B range: 2-8 (matches Elektron)
- Probability: integer 1-99
- Per-track cycle counter (Elektron-style)
- `setPattern` clears and loads conditions
- Pattern type has optional `trigConditions?`
- Accent supports conditions (evaluated globally)
- Negated cycle (NOT A:B) noted for future tier
