---
date: 2026-03-28T16:25
summary: >
  Consolidate per-track data (steps, freeRun, trigConditions,
  parameterLocks) into a unified TrackConfig type shared by
  Pattern and SequencerConfig. Remove scattered top-level
  fields in favor of a single tracks record.
---

# Unified TrackConfig Implementation Plan

> **For agentic workers:** REQUIRED: Use
> subagent-driven-development (if subagents available) or
> executing-plans to implement this plan. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered per-track fields with a unified
`TrackConfig` type shared by `Pattern` and
`SequencerConfig`, enabling preset patterns to carry
polymetric lengths, freeRun, and parameter locks.

**Architecture:** New `TrackConfig` interface holds all
per-track rhythm data (steps, freeRun, trigConditions,
parameterLocks). Both `Pattern` and `SequencerConfig` use
`tracks: Record<TrackId, TrackConfig>`. Pattern length and
track lengths are inferred from step string lengths.

**Tech Stack:** TypeScript, React (Context API), Vitest,
Next.js App Router

**Spec:** `docs/specs/2026-03-28-unified-track-config-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/types.ts` | Modify | Add `TrackConfig`, update `Pattern`, `SequencerConfig`, `TrackMixerState`, `TrackState`, `HomeSnapshot` |
| `src/app/configCodec.ts` | Modify | Bump version, rewrite validators, add `getPatternLength`, remove old validators |
| `src/app/data/patterns.json` | Modify | Convert 137 presets from flat `steps` to nested `tracks` format |
| `src/app/SequencerContext.tsx` | Modify | Rewrite all state mutations, remove `patternRef`/`currentPattern`/`normalizePatternSteps`, update context API |
| `src/app/StepGrid.tsx` | Modify | Read from `config.tracks` instead of `state.patternLength`/`trackLengths`/`currentPattern` |
| `src/app/TrackRow.tsx` | Modify | Minor prop name changes |
| `src/app/AccentRow.tsx` | Modify | Minor prop name changes |
| `src/app/Sequencer.tsx` | Modify | Derive `patternLength` from `config.tracks` |
| `src/app/GlobalControls.tsx` | Modify | Derive `patternLength` from `config.tracks` |
| `src/app/TransportControls.tsx` | Modify | Remove `currentPattern` usage, pass `selectedPatternId` + tracks to PatternPicker |
| `src/app/PatternPicker.tsx` | Modify | Accept `selectedPatternId` + `tracks` instead of `currentPattern` |
| `src/app/SettingsPopover.tsx` | Modify | No changes expected (uses `meta.config` opaquely) |
| `src/app/useDragPaint.ts` | Modify | Read from `config.tracks` instead of `currentPattern.steps`/`trackLengths` |
| `src/__tests__/configCodec.test.ts` | Modify | Rewrite config construction and assertions for new shape |
| `src/__tests__/configCodec.golden.test.ts` | Modify | Rewrite golden helpers, update golden hashes, update snapshots |
| `src/__tests__/SequencerContext.test.tsx` | Modify | Rewrite all assertions to use `config.tracks` |
| `src/__tests__/handleStep.test.ts` | Modify | Update `setupAndTrigger` helper and all config assertions |
| `src/__tests__/PatternPicker.test.tsx` | Modify | Update to use `selectedPatternId` instead of `currentPattern` |

---

## Task 1: Update Type Definitions

**Files:**
- Modify: `src/app/types.ts`
- Test: `src/__tests__/types.test.ts`

- [ ] **Step 1: Write failing test for TrackConfig type**

Add a type-level test that verifies TrackConfig shape exists
and is assignable:

```typescript
// In types.test.ts, add after existing tests:
it('TrackConfig has expected shape', () => {
  const tc: TrackConfig = {
    steps: '1010101010101010',
  };
  expect(tc.steps).toBe('1010101010101010');
  expect(tc.freeRun).toBeUndefined();
  expect(tc.trigConditions).toBeUndefined();
  expect(tc.parameterLocks).toBeUndefined();

  const tcFull: TrackConfig = {
    steps: '10001000100',
    freeRun: true,
    trigConditions: { 0: { probability: 50 } },
    parameterLocks: { 3: { gain: 0.8 } },
  };
  expect(tcFull.freeRun).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/types.test.ts`
Expected: FAIL — `TrackConfig` not exported

- [ ] **Step 3: Add TrackConfig and update types**

In `src/app/types.ts`:

1. Add new `TrackConfig` interface after `StepLocks`:

```typescript
/**
 * Per-track rhythm configuration. The step string
 * length IS the track length.
 */
export interface TrackConfig {
  steps: string;
  freeRun?: boolean;
  trigConditions?: Record<number, StepConditions>;
  parameterLocks?: Record<number, StepLocks>;
}
```

2. Update `Pattern` — replace `steps`, remove optional
   `trigConditions` and `parameterLocks`:

```typescript
export interface Pattern {
  id: string;
  name: string;
  category?: string;
  tracks: Record<TrackId, TrackConfig>;
}
```

3. Update `SequencerConfig` — remove `patternLength`,
   `trackLengths`, `steps`, `trigConditions`,
   `parameterLocks`. Add `tracks`:

```typescript
export interface SequencerConfig {
  version: number;
  kitId: string;
  bpm: number;
  tracks: Record<TrackId, TrackConfig>;
  mixer: Record<TrackId, TrackMixerState>;
  swing: number;
}
```

4. Remove `freeRun` from `TrackMixerState`:

```typescript
export interface TrackMixerState {
  gain: number;
  isMuted: boolean;
  isSolo: boolean;
}
```

5. Remove `freeRun` from `TrackState`:

```typescript
export interface TrackState {
  id: TrackId;
  name: string;
  isMuted: boolean;
  isSolo: boolean;
  gain: number;
}
```

6. Update `HomeSnapshot`:

```typescript
export interface HomeSnapshot {
  tracks: Record<TrackId, TrackConfig>;
  selectedPatternId: string;
}
```

7. Add `getPatternLength` helper:

```typescript
/**
 * Derive the pattern length from the longest track.
 */
export function getPatternLength(
  tracks: Record<TrackId, TrackConfig>
): number {
  return Math.max(
    ...Object.values(tracks).map(t => t.steps.length)
  );
}
```

8. Remove `TrackPattern` type if unused after this change.
   (Check: it is used by drag-paint cycling — leave it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/types.test.ts`
Expected: PASS (new test passes, TRACK_IDS snapshot
unchanged). **Note:** Other test files will now have
compilation errors — this is expected. We fix them in
subsequent tasks.

- [ ] **Step 5: Commit**

```
git add src/app/types.ts src/__tests__/types.test.ts
git commit -m "Add TrackConfig type, update Pattern and
SequencerConfig interfaces"
```

---

## Task 2: Rewrite configCodec

**Files:**
- Modify: `src/app/configCodec.ts`
- Modify: `src/__tests__/configCodec.test.ts`
- Modify: `src/__tests__/configCodec.golden.test.ts`

This is the largest single task. It rewrites the
serialization/validation layer.

- [ ] **Step 1: Rewrite configCodec.ts**

Key changes to `src/app/configCodec.ts`:

1. Bump `CONFIG_VERSION` from 3 to 4.

2. Remove constants `PATTERN_LENGTH_MIN`,
   `PATTERN_LENGTH_MAX`, `DEFAULT_PATTERN_LENGTH`.
   Add `DEFAULT_TRACK_LENGTH = 16`.

3. Rewrite `defaultConfig()`:

```typescript
export function defaultConfig(): SequencerConfig {
  const firstPattern = patternsData.patterns[0];
  const mixer = {} as Record<TrackId, TrackMixerState>;
  for (const id of TRACK_IDS) {
    mixer[id] = {
      gain: id === 'ac' ? 0.5 : 1.0,
      isMuted: false,
      isSolo: false,
    };
  }
  return {
    version: CONFIG_VERSION,
    kitId: kitsData.kits[0].id,
    bpm: DEFAULT_BPM,
    tracks: firstPattern.tracks as
      Record<TrackId, TrackConfig>,
    mixer,
    swing: 0,
  };
}
```

4. Update `encodeConfig()` — strip empty optional fields
   per-track before serialization:

```typescript
export async function encodeConfig(
  config: SequencerConfig
): Promise<string> {
  const tracks: Record<string, unknown> = {};
  for (const id of TRACK_IDS) {
    const t = config.tracks[id];
    const compact: Record<string, unknown> = {
      steps: t.steps,
    };
    if (t.freeRun) compact.freeRun = true;
    if (t.trigConditions &&
        Object.keys(t.trigConditions).length > 0) {
      compact.trigConditions = t.trigConditions;
    }
    if (t.parameterLocks &&
        Object.keys(t.parameterLocks).length > 0) {
      compact.parameterLocks = t.parameterLocks;
    }
    tracks[id] = compact;
  }
  const toEncode = {
    version: config.version,
    kitId: config.kitId,
    bpm: config.bpm,
    tracks,
    mixer: config.mixer,
    swing: config.swing,
  };
  const json = JSON.stringify(toEncode);
  // ... rest unchanged (compress + base64url)
}
```

5. Remove these functions entirely:
   - `validatePatternLength`
   - `validateTrackLengths`
   - `validateSteps`
   - `normalizeSteps`
   - `validateTrigConditions`
   - `validateParameterLocks`

6. Add `validateTracks()` which consolidates all
   per-track validation:

```typescript
function validateTracks(
  value: unknown,
  fallbackTracks: Record<TrackId, TrackConfig>
): Record<TrackId, TrackConfig> {
  if (value === null || typeof value !== 'object') {
    return fallbackTracks;
  }
  const obj = value as Record<string, unknown>;
  const result = {} as Record<TrackId, TrackConfig>;

  // First pass: validate each track
  for (const id of TRACK_IDS) {
    const raw = obj[id];
    if (raw === null || typeof raw !== 'object') {
      result[id] = { ...fallbackTracks[id] };
      continue;
    }
    const t = raw as Record<string, unknown>;
    result[id] = validateSingleTrack(
      t, fallbackTracks[id]
    );
  }
  return result;
}

function validateSingleTrack(
  raw: Record<string, unknown>,
  fallback: TrackConfig
): TrackConfig {
  // Steps: must be binary string 1-64 chars
  let steps: string;
  if (
    typeof raw.steps === 'string' &&
    raw.steps.length >= 1 &&
    raw.steps.length <= 64 &&
    /^[01]+$/.test(raw.steps)
  ) {
    steps = raw.steps;
  } else {
    steps = fallback.steps;
  }

  const tc: TrackConfig = { steps };

  // freeRun: optional boolean
  if (typeof raw.freeRun === 'boolean') {
    tc.freeRun = raw.freeRun;
  }

  // trigConditions: optional Record<number, StepConditions>
  if (raw.trigConditions !== null &&
      raw.trigConditions !== undefined &&
      typeof raw.trigConditions === 'object') {
    const conds = raw.trigConditions as
      Record<string, unknown>;
    const valid: Record<number, StepConditions> = {};
    for (const key of Object.keys(conds)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) ||
          idx < 0 || idx > MAX_STEP_INDEX) continue;
      const c = validateSingleCondition(conds[key]);
      if (c !== null) valid[idx] = c;
    }
    if (Object.keys(valid).length > 0) {
      tc.trigConditions = valid;
    }
  }

  // parameterLocks: optional, skip 'ac' track
  // (ac filtering done at caller level)
  if (raw.parameterLocks !== null &&
      raw.parameterLocks !== undefined &&
      typeof raw.parameterLocks === 'object') {
    const locks = raw.parameterLocks as
      Record<string, unknown>;
    const valid: Record<number, StepLocks> = {};
    for (const key of Object.keys(locks)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) ||
          idx < 0 || idx > MAX_STEP_INDEX) continue;
      const l = validateSingleLock(locks[key]);
      if (l !== null) valid[idx] = l;
    }
    if (Object.keys(valid).length > 0) {
      tc.parameterLocks = valid;
    }
  }

  return tc;
}
```

Keep `validateSingleCondition` and `validateSingleLock`
unchanged. Keep `validateKitId`, `validateBpm`,
`validateSwing`, `validateMixer` (but remove `freeRun`
from mixer validation).

7. Update `validateConfig()` — add a version gate that
   returns defaults for unrecognized versions:

```typescript
function validateConfig(raw: unknown): SequencerConfig {
  const defaults = defaultConfig();
  if (raw === null || typeof raw !== 'object') {
    return defaults;
  }
  const obj = raw as Record<string, unknown>;

  // Reject unrecognized versions (v3 URLs, etc.)
  if (obj.version !== CONFIG_VERSION) {
    return defaults;
  }

  const kitId = validateKitId(obj.kitId);
  const bpm = validateBpm(obj.bpm);
  const tracks = validateTracks(
    obj.tracks, defaults.tracks
  );
  const mixer = validateMixer(
    obj.mixer, defaults.mixer
  );
  const swing = validateSwing(obj.swing);

  return {
    version: CONFIG_VERSION,
    kitId,
    bpm,
    tracks,
    mixer,
    swing,
  };
}
```

8. Update `validateMixer` — remove `freeRun`:

```typescript
result[id] = {
  gain: /* ... */,
  isMuted: /* ... */,
  isSolo: /* ... */,
};
```

- [ ] **Step 2: Rewrite configCodec.test.ts**

Update all tests to use the new `tracks` shape. Key
patterns:

**Old:**
```typescript
config.steps[id] = '1111111111111111';
config.trackLengths.bd = 5;
config.mixer.bd.freeRun = true;
config.trigConditions = { bd: { 0: { ... } } };
config.parameterLocks = { bd: { 0: { gain: 0.5 } } };
```

**New:**
```typescript
config.tracks[id] = {
  steps: '1111111111111111',
};
config.tracks.bd = {
  steps: '10100',
  freeRun: true,
};
config.tracks.bd.trigConditions = { 0: { ... } };
config.tracks.bd.parameterLocks = { 0: { gain: 0.5 } };
```

Tests to update:
- Round-trip fidelity tests (lines 51–123)
- Field validation tests (lines 303–341)
- TrigCondition validation (lines 394–519)
- Fill condition validation (lines 522–544)
- ParameterLock validation (lines 574–674)

Tests to remove:
- `validateSteps` tests — replaced by `validateTracks`
- `validateTrackLengths` tests — lengths inferred
- `validatePatternLength` tests — length inferred

Tests to add:
- URL compaction: verify empty optional fields are
  stripped from encoded output
- Track validation: missing tracks get defaults
- Consistent pruning removed: locks at index 50 survive
  even when steps are length 16

- [ ] **Step 3: Rewrite configCodec.golden.test.ts**

Update the three golden helper functions
(`goldenConfigV1Decoded`, `goldenConfigV2Decoded`,
`goldenConfigV2`) to build configs with the new shape.

**Important:** Since v3 URLs now return `defaultConfig()`,
the v1 and v2 golden hash tests should verify that
decoding an old hash returns defaults (not the old decoded
config). Update expectations accordingly.

Generate new golden hashes for v4 configs. Write a
one-off test that encodes a known config and prints the
hash:

```typescript
it('generate golden hash', async () => {
  const config = /* build known config */;
  const hash = await encodeConfig(config);
  console.log('GOLDEN_HASH_V4:', hash);
  // Copy this value into the golden constant
});
```

Run it once, capture the hash, paste it into the golden
constant, then remove the generator test.

Update the snapshot file
`__snapshots__/configCodec.golden.test.ts.snap` by
running `npm test -- -u`.

- [ ] **Step 4: Run all codec tests**

Run: `npm test -- src/__tests__/configCodec`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```
git add src/app/configCodec.ts \
  src/__tests__/configCodec.test.ts \
  src/__tests__/configCodec.golden.test.ts \
  src/__tests__/__snapshots__/
git commit -m "Rewrite configCodec for unified TrackConfig

Bump CONFIG_VERSION to 4. Consolidate per-track
validation into validateTracks. Strip empty optional
fields in encoder for compact URLs."
```

---

## Task 3: Convert patterns.json

**Files:**
- Modify: `src/app/data/patterns.json`

- [ ] **Step 1: Write a Node.js migration script**

Create a temporary script at `/tmp/migrate-patterns.js`
that reads patterns.json and converts from old format to
new:

```javascript
const fs = require('fs');
const path = '/home/jme/repos/xox/src/app/data/patterns.json';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));

// Note: the old format has no per-track freeRun
// (freeRun lives in mixer, not in patterns).
// So we only migrate steps, trigConditions, and
// parameterLocks.
const converted = data.patterns.map(p => {
  const tracks = {};
  for (const [id, steps] of Object.entries(p.steps)) {
    const tc = { steps };
    // Carry over existing trigConditions if any
    if (p.trigConditions?.[id]) {
      tc.trigConditions = p.trigConditions[id];
    }
    // Carry over existing parameterLocks if any
    if (p.parameterLocks?.[id]) {
      tc.parameterLocks = p.parameterLocks[id];
    }
    tracks[id] = tc;
  }
  const result = {
    id: p.id,
    name: p.name,
  };
  if (p.category) result.category = p.category;
  result.tracks = tracks;
  return result;
});

fs.writeFileSync(
  path,
  JSON.stringify({ patterns: converted }, null, 2) + '\n'
);
console.log(`Converted ${converted.length} patterns`);
```

- [ ] **Step 2: Run the migration script**

Run: `node /tmp/migrate-patterns.js`
Expected: `Converted 137 patterns`

- [ ] **Step 3: Verify the output**

Spot-check the first pattern to confirm shape:
```json
{
  "id": "afro-cub-1",
  "name": "Afro-Cuban 01",
  "category": "Afro-Cuban",
  "tracks": {
    "ac": { "steps": "0000000000000000" },
    ...
  }
}
```

Verify all 12 track IDs are present in every pattern.

- [ ] **Step 4: Commit**

```
git add src/app/data/patterns.json
git commit -m "Convert patterns.json to unified tracks format

All 137 presets now use tracks: Record<TrackId,
TrackConfig> instead of flat steps/trigConditions."
```

---

## Task 4: Rewrite SequencerContext

**Files:**
- Modify: `src/app/SequencerContext.tsx`
- Modify: `src/__tests__/SequencerContext.test.tsx`

This is the largest and most complex task. It touches
every state mutation and the audio loop.

### Part A: Remove old structure, add new

- [ ] **Step 1: Update SequencerState interface (line 68)**

Remove `patternLength`, `trackLengths`, `currentPattern`.
Keep `trackStates` but it no longer has `freeRun`.

```typescript
interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  currentKit: Kit;
  trackStates: Record<TrackId, TrackState>;
  isLoaded: boolean;
  swing: number;
  isFillActive: boolean;
  fillMode: 'off' | 'latched' | 'momentary';
  patternMode: PatternMode;
  tempState: TempState;
  selectedPatternId: string;
}
```

- [ ] **Step 2: Remove normalizePatternSteps (lines 151-166)**

Delete the function entirely.

- [ ] **Step 3: Remove currentPattern memo (lines 302-318)**

Delete the `currentPattern` useMemo block.

- [ ] **Step 4: Update trackStates memo (lines 320-338)**

Remove `freeRun` from the computed TrackState:

```typescript
const trackStates = useMemo(() => {
  const states = {} as Record<TrackId, TrackState>;
  for (const id of TRACK_IDS) {
    const m = config.mixer[id];
    states[id] = {
      id,
      name: TRACK_NAMES[id],
      gain: m.gain,
      isMuted: m.isMuted,
      isSolo: m.isSolo,
    };
  }
  return states;
}, [config.mixer]);
```

- [ ] **Step 5: Remove patternRef (line 343, effect 353-355)**

Delete `patternRef` and its sync effect. The audio loop
will read from `configRef.current.tracks`.

- [ ] **Step 6: Commit partial progress**

```
git add src/app/SequencerContext.tsx
git commit -m "Remove old per-track fields from context

Remove normalizePatternSteps, currentPattern memo,
patternRef. Update SequencerState interface and
trackStates memo."
```

### Part B: Rewrite handleStep (lines 389-570)

- [ ] **Step 7: Update handleStep audio loop**

Key changes:
- Replace `pattern.steps[track.id][effectiveStep]` with
  `cfg.tracks[track.id].steps[effectiveStep]`
- Replace `pattern.steps.ac[accentStep]` with
  `cfg.tracks.ac.steps[accentStep]`
- Replace `cfg.trackLengths[id]` with
  `cfg.tracks[id].steps.length`
- Replace `cfg.mixer[id].freeRun` with
  `cfg.tracks[id].freeRun`
- Replace `cfg.trigConditions?.ac?.[accentStep]` with
  `cfg.tracks.ac.trigConditions?.[accentStep]`
- Replace `cfg.trigConditions?.[track.id]?.[effectiveStep]`
  with
  `cfg.tracks[track.id].trigConditions?.[effectiveStep]`
- Replace `cfg.parameterLocks?.[track.id]?.[effectiveStep]`
  with
  `cfg.tracks[track.id].parameterLocks?.[effectiveStep]`
- Replace `step === cfg.patternLength - 1` with
  `step === getPatternLength(cfg.tracks) - 1`
- Replace `audioEngine.setPatternLength(...)` calls with
  `getPatternLength(...)` as argument

- [ ] **Step 8: Rewrite pending pattern apply in handleStep**

At the pattern boundary (sequential mode), replace:
```typescript
const normalized = normalizePatternSteps(
  pending.steps, cfg.trackLengths
);
return {
  ...prev,
  steps: normalized,
  trigConditions: pending.trigConditions ?? {},
};
```

With:
```typescript
return {
  ...prev,
  tracks: pending.tracks,
};
```

The pending pattern's tracks replace config.tracks
entirely.

- [ ] **Step 9: Rewrite temp revert in handleStep**

Replace restoration of `steps`, `trigConditions`,
`trackLengths`, `patternLength` with:
```typescript
return {
  ...prev,
  tracks: snap.tracks,
};
```

- [ ] **Step 10: Commit handleStep rewrite**

```
git add src/app/SequencerContext.tsx
git commit -m "Rewrite handleStep for unified tracks"
```

### Part C: Rewrite action callbacks

- [ ] **Step 11: Rewrite applyPatternNow (lines 660-678)**

```typescript
const applyPatternNow = useCallback(
  (pattern: Pattern) => {
    setConfig(prev => ({
      ...prev,
      tracks: pattern.tracks,
    }));
    setSelectedPatternId(pattern.id);
  }, []
);
```

- [ ] **Step 12: Rewrite setPattern (lines 680-767)**

Update HomeSnapshot capture to use `tracks`:
```typescript
const snap: HomeSnapshot = {
  tracks: structuredClone(
    configRef.current.tracks
  ),
  selectedPatternId,
};
```

Remove all `normalizePatternSteps` calls. For
direct-start and direct-jump modes, just call
`applyPatternNow(pattern)` — no need to update a
separate patternRef.

- [ ] **Step 13: Rewrite toggleStep (lines 769-792)**

```typescript
const toggleStep = useCallback(
  (trackId: TrackId, stepIndex: number) => {
    setConfig(prev => {
      const track = prev.tracks[trackId];
      if (stepIndex >= track.steps.length) return prev;
      const steps = track.steps;
      const toggled = steps[stepIndex] === '1'
        ? '0' : '1';
      const newSteps =
        steps.substring(0, stepIndex)
        + toggled
        + steps.substring(stepIndex + 1);
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: { ...track, steps: newSteps },
        },
      };
    });
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 14: Rewrite setStep (lines 794-820)**

Same pattern as toggleStep but sets to explicit value.

- [ ] **Step 15: Rewrite setTrackSteps (lines 822-839)**

```typescript
const setTrackSteps = useCallback(
  (trackId: TrackId, steps: string) => {
    setConfig(prev => {
      if (prev.tracks[trackId].steps === steps) {
        return prev;
      }
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            steps,
          },
        },
      };
    });
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 16: Rewrite toggleFreeRun (lines 841-855)**

```typescript
const toggleFreeRun = useCallback(
  (trackId: TrackId) => {
    setConfig(prev => {
      const track = prev.tracks[trackId];
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            freeRun: !track.freeRun,
          },
        },
      };
    });
    setSelectedPatternId('custom');
  }, []
);
```

Note: `toggleFreeRun` now sets `selectedPatternId` to
`'custom'` per the spec.

- [ ] **Step 17: Rewrite setPatternLength (lines 857-928)**

Asymmetric grow/shrink with no condition/lock pruning:

```typescript
const setPatternLength = useCallback(
  (length: number) => {
    const clamped = Math.max(
      1, Math.min(64, Math.round(length))
    );
    setConfig(prev => {
      const currentMax = getPatternLength(prev.tracks);
      if (clamped === currentMax) return prev;
      const newTracks = { ...prev.tracks };
      for (const id of TRACK_IDS) {
        const track = prev.tracks[id];
        const trackLen = track.steps.length;
        if (clamped > currentMax) {
          // Grow: extend ALL tracks to clamped
          newTracks[id] = {
            ...track,
            steps: track.steps.padEnd(clamped, '0'),
          };
        } else if (trackLen > clamped) {
          // Shrink: only cap tracks exceeding clamped
          newTracks[id] = {
            ...track,
            steps: track.steps.substring(0, clamped),
          };
        }
        // else: track shorter than clamped, leave alone
      }
      return { ...prev, tracks: newTracks };
    });
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 18: Rewrite setTrackLength (lines 930-998)**

```typescript
const setTrackLength = useCallback(
  (trackId: TrackId, length: number) => {
    const clamped = Math.max(
      1, Math.min(64, Math.round(length))
    );
    setConfig(prev => {
      const track = prev.tracks[trackId];
      if (track.steps.length === clamped) return prev;
      let newSteps: string;
      if (clamped > track.steps.length) {
        newSteps = track.steps.padEnd(clamped, '0');
      } else {
        newSteps = track.steps.substring(0, clamped);
      }
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: { ...track, steps: newSteps },
        },
      };
    });
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 19: Rewrite clearAll (lines 1053-1089)**

```typescript
const clearAll = useCallback(() => {
  setConfig(prev => {
    const newTracks = {} as
      Record<TrackId, TrackConfig>;
    for (const id of TRACK_IDS) {
      newTracks[id] = { steps: '0'.repeat(16) };
    }
    return { ...prev, tracks: newTracks };
  });
  setSelectedPatternId('custom');
  homeSnapshotRef.current = null;
  setTempState('off');
}, []);
```

- [ ] **Step 20: Rewrite clearTrack (lines 1091-1126)**

```typescript
const clearTrack = useCallback(
  (trackId: TrackId) => {
    setConfig(prev => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: { steps: '0'.repeat(16) },
      },
    }));
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 21: Rewrite setTrigCondition (lines 1199-1217)**

```typescript
const setTrigCondition = useCallback(
  (trackId: TrackId, stepIndex: number,
   conditions: StepConditions) => {
    setConfig(prev => {
      const track = prev.tracks[trackId];
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            trigConditions: {
              ...track.trigConditions,
              [stepIndex]: conditions,
            },
          },
        },
      };
    });
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 22: Rewrite clearTrigCondition (lines 1219-1241)**

```typescript
const clearTrigCondition = useCallback(
  (trackId: TrackId, stepIndex: number) => {
    setConfig(prev => {
      const track = prev.tracks[trackId];
      if (!track.trigConditions) return prev;
      const { [stepIndex]: _, ...rest } =
        track.trigConditions;
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            trigConditions:
              Object.keys(rest).length > 0
                ? rest : undefined,
          },
        },
      };
    });
    setSelectedPatternId('custom');
  }, []
);
```

- [ ] **Step 23: Rewrite setParameterLock/clearParameterLock**

Same pattern as steps 21–22 above: substitute
`parameterLocks` for `trigConditions` throughout. The
`setParameterLock` callback spreads
`track.parameterLocks` with the new entry, and
`clearParameterLock` destructures to remove the key.

- [ ] **Step 24: Update togglePlay (lines 586-628)**

Replace HomeSnapshot restoration with:
```typescript
if (snapshot) {
  setConfig(prev => ({
    ...prev,
    tracks: snapshot.tracks,
  }));
  setSelectedPatternId(snapshot.selectedPatternId);
}
```

- [ ] **Step 25: Update context value (lines 1331-1374)**

Remove `patternLength`, `trackLengths`,
`currentPattern` from state. Add `selectedPatternId`:

```typescript
const value: SequencerContextValue = useMemo(
  () => ({
    state: {
      isPlaying,
      bpm: config.bpm,
      currentKit,
      trackStates,
      isLoaded,
      swing: config.swing,
      isFillActive,
      fillMode,
      patternMode,
      tempState,
      selectedPatternId,
    },
    actions: { /* unchanged list */ },
    meta: {
      stepRef,
      totalStepsRef,
      config,
    },
  }),
  [/* update dependency array */]
);
```

- [ ] **Step 26: Update audioEngine.setPatternLength calls**

Search for `audioEngine.setPatternLength` in the file.
Replace the argument with
`getPatternLength(config.tracks)`. There should be ~2-3
call sites (in useEffect and in handleStep).

- [ ] **Step 27: Commit SequencerContext rewrite**

```
git add src/app/SequencerContext.tsx
git commit -m "Rewrite SequencerContext for unified tracks

All state mutations use config.tracks. Remove
patternRef, normalizePatternSteps. Asymmetric
grow/shrink for setPatternLength. No condition/lock
pruning on length change."
```

### Part D: Rewrite SequencerContext tests

- [ ] **Step 28: Update SequencerContext.test.tsx**

Systematic replacements throughout the file:

- `result.current.meta.config.steps.X` →
  `result.current.meta.config.tracks.X.steps`
- `result.current.meta.config.trackLengths.X` →
  `result.current.meta.config.tracks.X.steps.length`
- `result.current.state.patternLength` →
  `getPatternLength(result.current.meta.config.tracks)`
- `result.current.state.trackLengths` →
  derive from `config.tracks`
- `result.current.state.currentPattern.steps` →
  `result.current.meta.config.tracks`
- `result.current.meta.config.mixer.X.freeRun` →
  `result.current.meta.config.tracks.X.freeRun`
- `result.current.meta.config.trigConditions.X` →
  `result.current.meta.config.tracks.X.trigConditions`
- `result.current.meta.config.parameterLocks.X` →
  `result.current.meta.config.tracks.X.parameterLocks`

Import `getPatternLength` from types.

Update tests that check condition/lock pruning on length
change: these should now verify that conditions/locks
are NOT pruned (they survive as dormant data).

Update clearAll/clearTrack tests: assert reset to 16
steps, not to `patternLength`.

Update setPatternLength tests for asymmetric behavior:
grow extends all, shrink caps only.

- [ ] **Step 29: Run SequencerContext tests**

Run: `npm test -- src/__tests__/SequencerContext.test.tsx`
Expected: ALL PASS

- [ ] **Step 30: Commit test updates**

```
git add src/__tests__/SequencerContext.test.tsx
git commit -m "Update SequencerContext tests for unified tracks"
```

---

## Task 5: Update handleStep Tests

**Files:**
- Modify: `src/__tests__/handleStep.test.ts`

- [ ] **Step 1: Update setupAndTrigger helper (lines 60-162)**

The helper constructs config and reads steps. Update all
`config.steps[id]` references to
`config.tracks[id].steps`. Update `parameterLocks`
setup to nest inside tracks.

- [ ] **Step 2: Update all test assertions**

Same mechanical replacement as SequencerContext tests:
- `config.steps.X` → `config.tracks.X.steps`
- `config.trigConditions.X` →
  `config.tracks.X.trigConditions`
- `config.parameterLocks.X` →
  `config.tracks.X.parameterLocks`
- `currentPattern.id` →
  `state.selectedPatternId`

Update pruning tests (lines 671-729): they should now
verify conditions are NOT pruned on length change.

- [ ] **Step 3: Run handleStep tests**

Run: `npm test -- src/__tests__/handleStep.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```
git add src/__tests__/handleStep.test.ts
git commit -m "Update handleStep tests for unified tracks"
```

---

## Task 6: Update UI Components

**Files:**
- Modify: `src/app/StepGrid.tsx`
- Modify: `src/app/TrackRow.tsx`
- Modify: `src/app/AccentRow.tsx`
- Modify: `src/app/Sequencer.tsx`
- Modify: `src/app/GlobalControls.tsx`
- Modify: `src/app/TransportControls.tsx`
- Modify: `src/app/PatternPicker.tsx`
- Modify: `src/app/useDragPaint.ts`

- [ ] **Step 1: Update StepGrid.tsx**

Replace:
```typescript
const {
  currentPattern, trackStates,
  patternLength, trackLengths,
} = state;
```

With:
```typescript
const { trackStates, selectedPatternId } = state;
const { config } = meta;
const patternLength = getPatternLength(config.tracks);
```

Update all prop passing:
- `trackLength={trackLengths[track.id]}` →
  `trackLength={config.tracks[track.id].steps.length}`
- `steps={currentPattern.steps[track.id]}` →
  `steps={config.tracks[track.id].steps}`
- `isFreeRun={trackStates[track.id].freeRun}` →
  `isFreeRun={config.tracks[track.id].freeRun ?? false}`
- `trigConditions={config.trigConditions[track.id]}` →
  `trigConditions={config.tracks[track.id].trigConditions}`
- `parameterLocks={config.parameterLocks[track.id]}` →
  `parameterLocks={config.tracks[track.id].parameterLocks}`

Same for accent row props.

Update `useDragPaint` call to pass `config.tracks`.

- [ ] **Step 2: Update useDragPaint.ts**

Update the hook signature to accept `tracks` instead of
separate `steps` and `trackLengths`:

```typescript
// Old signature:
function useDragPaint(
  trackLengths: Record<TrackId, number>,
  steps: Record<TrackId, string>,
  ...
)

// New signature:
function useDragPaint(
  tracks: Record<TrackId, TrackConfig>,
  ...
)
```

Inside the hook, read step data from
`tracks[id].steps` and length from
`tracks[id].steps.length`.

- [ ] **Step 3: Update Sequencer.tsx**

Replace `state.patternLength` with:
```typescript
const patternLength = getPatternLength(
  meta.config.tracks
);
```

- [ ] **Step 4: Update GlobalControls.tsx**

Replace `state.patternLength` with:
```typescript
const patternLength = getPatternLength(
  meta.config.tracks
);
```

- [ ] **Step 5: Update TransportControls.tsx**

Replace `currentPattern` with `selectedPatternId` from
state. Pass `selectedPatternId` and `config.tracks` to
PatternPicker instead of `currentPattern`.

- [ ] **Step 6: Update PatternPicker.tsx**

Replace `currentPattern: Pattern` prop with
`selectedPatternId: string`. Update all
`currentPattern.id` references to `selectedPatternId`.

- [ ] **Step 7: Update TrackRow.tsx and AccentRow.tsx**

These receive props — no context changes needed. Just
verify prop types still match (they should, since
StepGrid passes the same shapes).

- [ ] **Step 8: Run lint**

Run: `npm run lint`
Expected: PASS with zero errors

- [ ] **Step 9: Commit UI updates**

```
git add src/app/StepGrid.tsx src/app/TrackRow.tsx \
  src/app/AccentRow.tsx src/app/Sequencer.tsx \
  src/app/GlobalControls.tsx \
  src/app/TransportControls.tsx \
  src/app/PatternPicker.tsx src/app/useDragPaint.ts
git commit -m "Update UI components for unified tracks

Read from config.tracks instead of state.patternLength,
trackLengths, currentPattern. Drop freeRun from
trackStates."
```

---

## Task 7: Update Remaining Tests and Final Verification

**Files:**
- Modify: `src/__tests__/PatternPicker.test.tsx`
- Modify: `src/__tests__/useDragPaint.test.tsx`
- Possibly: other test files

- [ ] **Step 1: Update PatternPicker.test.tsx**

Replace `currentPattern` prop with `selectedPatternId`.
Update assertions that check `currentPattern.id`.

- [ ] **Step 2: Update useDragPaint.test.tsx if needed**

If the hook's parameter signature changed, update the
test to pass `tracks` instead of `steps`/`trackLengths`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS with zero errors

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: PASS (static export succeeds)

- [ ] **Step 6: Commit any remaining fixes**

```
git add src/__tests__/PatternPicker.test.tsx \
  src/__tests__/useDragPaint.test.tsx
git commit -m "Update remaining tests for unified tracks"
```

---

## Task 8: Browser Verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify in browser**

Open the app and verify:
- Default pattern loads and plays
- Switching patterns works (all three modes)
- Step toggling works
- Track length adjustment works
- freeRun toggle works
- Trig conditions can be added/removed
- Parameter locks can be added/removed
- clearAll resets to 16 steps
- clearTrack resets individual track to 16 steps
- URL sharing: copy URL, paste in new tab, verify state
- Temp mode: arm, switch pattern, verify revert

- [ ] **Step 3: Commit any fixes found during testing**

---

## Dependency Order

```
Task 1 (types)
  └─→ Task 2 (configCodec)
       └─→ Task 3 (patterns.json)
            └─→ Task 4 (SequencerContext)
                 ├─→ Task 5 (handleStep tests)
                 └─→ Task 6 (UI components)
                      └─→ Task 7 (remaining tests)
                           └─→ Task 8 (browser)
```

Tasks 5 and 6 can run in parallel after Task 4.
