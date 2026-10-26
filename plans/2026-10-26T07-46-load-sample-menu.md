---
date: 2026-10-26T07:46
summary: >
  Add "Load sample from file..." and "Reset to kit sample" to the
  track name menu, "Reset all samples to kit" to the grid menu, an
  amber dot on custom tracks, WAV-only checks, and custom buffers in
  the audio engine.
---

# Load Sample from File Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development
> (if subagents available) or executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user replace any grid track's sound with a WAV file
from the track name menu, keep it across kit changes, and reset it
per track or all at once.

**Architecture:** `AudioEngine` gets a second buffer map
(`customBuffers`) that `playSound` checks first. A new hook,
`useCustomSamples`, owns the per-track `File`s, the error message and
the load/reset actions, and `SequencerContext` exposes them. The UI
(`TrackNameButton`, `TrackRow`, `GridContextMenu`, `StepGrid`,
`Sequencer`) only calls those actions and shows a dot.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4,
Vitest + jsdom + Testing Library, Web Audio API.

**Spec:** `docs/specs/2026-10-26-load-sample-menu-design.md`. Read it
first.

---

## Ground rules for every task

- Worktree: `WT=/Users/jme/repos/xox/.worktrees/load-sample-menu`.
  All paths below are relative to it. Branch: `load-sample-menu`.
- Never `cd`. Use `npm --prefix $WT ...` and `git -C $WT ...`.
- Never use `grep`/`cat`/`sed`/`find` through Bash; use the Read
  tool (and Bash `grep` only if no search tool exists).
- Commit messages: write the message to a new temp file with the
  Write tool, then `git -C $WT commit -F <file>`. First line
  imperative, no period, at most 50 chars; blank line; body wrapped
  at 72. No heredocs.
- If a git or npm command fails with "Operation not permitted", it
  is the sandbox: rerun the same command outside the sandbox.
- Run one test file: `npm --prefix $WT test -- <path>`.
- Lines in this codebase wrap around 60-70 columns; match the
  surrounding style (2-space indent, single quotes, trailing
  commas).
- Tests encode the spec. If a test fails because production code is
  wrong, fix the code, not the test.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/app/constants.ts` | modify | `MAX_SAMPLE_FILE_BYTES` |
| `src/app/sampleFiles.ts` | create | WAV check, size check, error texts, `accept` string |
| `src/app/AudioEngine.ts` | modify | `customBuffers`, `decodeSample`, set/clear methods |
| `src/app/hooks/useCustomSamples.ts` | create | per-track `File`s, error, load/reset actions |
| `src/app/statusMessage.ts` | create | which banner message wins |
| `src/app/SequencerContext.tsx` | modify | compose hook; expose state/actions |
| `src/app/Sequencer.tsx` | modify | banner uses `pickStatus` |
| `src/app/CustomSampleDot.tsx` | create | the amber dot |
| `src/app/TrackNameButton.tsx` | modify | menu items + hidden file input |
| `src/app/TrackRow.tsx` | modify | pass props, render dots |
| `src/app/GridContextMenu.tsx` | modify | "Reset all samples to kit" |
| `src/app/StepGrid.tsx` | modify | wire state/actions to rows and grid menu |
| `src/app/helpContent.ts` | modify | document new items |
| `CLAUDE.md` | modify | document hook, files, reset exception |
| tests | create/modify | see each task |

---

### Task 0: Prepare the worktree

- [ ] **Step 1: Install dependencies**

Run: `npm --prefix $WT ci`
Expected: completes without errors.

- [ ] **Step 2: Baseline**

Run: `npm --prefix $WT test`
Expected: all tests pass. If anything fails before you change code,
stop and report it.

---

### Task 1: `sampleFiles.ts` and the size constant

**Files:**
- Modify: `src/app/constants.ts` (append at the end)
- Create: `src/app/sampleFiles.ts`
- Create: `src/__tests__/sampleFiles.test.ts`
- Update: `src/__tests__/__snapshots__/constants.test.ts.snap`
  (via `-u`)

- [ ] **Step 1: Write the failing test**

`src/__tests__/sampleFiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  SAMPLE_ACCEPT,
  checkSampleFile,
  decodeErrorMessage,
  isSupportedSampleFile,
} from '../app/sampleFiles';
import { MAX_SAMPLE_FILE_BYTES } from '../app/constants';

function fileOf(
  name: string, type = '', size = 4
): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('isSupportedSampleFile', () => {
  it('accepts .wav in any case', () => {
    expect(isSupportedSampleFile(fileOf('kick.wav'))).toBe(true);
    expect(isSupportedSampleFile(fileOf('KICK.WAV'))).toBe(true);
  });

  it('accepts a WAV MIME type without the extension', () => {
    expect(
      isSupportedSampleFile(fileOf('kick', 'audio/wav'))
    ).toBe(true);
    expect(
      isSupportedSampleFile(fileOf('kick', 'audio/x-wav'))
    ).toBe(true);
  });

  it('rejects other audio types', () => {
    expect(isSupportedSampleFile(fileOf('loop.aif'))).toBe(false);
    expect(
      isSupportedSampleFile(fileOf('loop.mp3', 'audio/mpeg'))
    ).toBe(false);
    expect(isSupportedSampleFile(fileOf('wav.txt'))).toBe(false);
  });
});

describe('checkSampleFile', () => {
  it('passes a WAV at the size limit', () => {
    expect(
      checkSampleFile(
        fileOf('kick.wav', '', MAX_SAMPLE_FILE_BYTES)
      )
    ).toBeNull();
  });

  it('names the file when the type is wrong', () => {
    expect(checkSampleFile(fileOf('loop.aif'))).toBe(
      'Only WAV samples are supported (got loop.aif).'
    );
  });

  it('refuses a file over the limit, rounding MB up', () => {
    expect(
      checkSampleFile(
        fileOf('big.wav', '', MAX_SAMPLE_FILE_BYTES + 1)
      )
    ).toBe(
      'big.wav is too large (21 MB).'
      + ' Samples must be under 20 MB.'
    );
  });

  it('checks the type before the size', () => {
    expect(
      checkSampleFile(
        fileOf('big.aif', '', MAX_SAMPLE_FILE_BYTES + 1)
      )
    ).toBe('Only WAV samples are supported (got big.aif).');
  });
});

describe('decodeErrorMessage', () => {
  it('names the file', () => {
    expect(decodeErrorMessage('kick.wav')).toBe(
      "Couldn't read kick.wav. It may be damaged or use"
      + ' an unusual WAV encoding.'
    );
  });
});

describe('SAMPLE_ACCEPT', () => {
  it('lists the extension and MIME types', () => {
    expect(SAMPLE_ACCEPT.split(',')).toEqual([
      '.wav', 'audio/wav', 'audio/x-wav',
      'audio/wave', 'audio/vnd.wave',
    ]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm --prefix $WT test -- src/__tests__/sampleFiles.test.ts`
Expected: FAIL, cannot resolve `../app/sampleFiles`.

- [ ] **Step 3: Add the constant**

Append to `src/app/constants.ts`:

```ts

// ── Custom samples ──────────────────────────────────
/** Largest sample file a track will load (20 MB). */
export const MAX_SAMPLE_FILE_BYTES = 20 * 1024 * 1024;
```

- [ ] **Step 4: Create `src/app/sampleFiles.ts`**

```ts
import { MAX_SAMPLE_FILE_BYTES } from './constants';

/**
 * Which files a track can load as a custom sample. The
 * picker's `accept` string and the check in loadSample
 * share these lists, so they can't drift apart.
 */
export const SAMPLE_EXTENSIONS = ['.wav'];
export const SAMPLE_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
];

export const SAMPLE_ACCEPT = [
  ...SAMPLE_EXTENSIONS, ...SAMPLE_MIME_TYPES,
].join(',');

const BYTES_PER_MB = 1024 * 1024;

export function isSupportedSampleFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SAMPLE_EXTENSIONS.some(ext => name.endsWith(ext))
    || SAMPLE_MIME_TYPES.includes(file.type);
}

/**
 * Why a file can't be loaded, or null if it can be
 * decoded. Type first, then size; both are checked
 * before reading the file.
 */
export function checkSampleFile(file: File): string | null {
  if (!isSupportedSampleFile(file)) {
    return `Only WAV samples are supported (got ${file.name}).`;
  }
  if (file.size > MAX_SAMPLE_FILE_BYTES) {
    const sizeMb = Math.ceil(file.size / BYTES_PER_MB);
    const limitMb = MAX_SAMPLE_FILE_BYTES / BYTES_PER_MB;
    return `${file.name} is too large (${sizeMb} MB).`
      + ` Samples must be under ${limitMb} MB.`;
  }
  return null;
}

export function decodeErrorMessage(fileName: string): string {
  return `Couldn't read ${fileName}. It may be damaged or use`
    + ' an unusual WAV encoding.';
}
```

- [ ] **Step 5: Run the test and the constants snapshot**

Run: `npm --prefix $WT test -- src/__tests__/sampleFiles.test.ts`
Expected: PASS.

Run: `npm --prefix $WT test -- src/__tests__/constants.test.ts -u`
Expected: PASS; snapshot updated with `MAX_SAMPLE_FILE_BYTES:
20971520`. Read the `.snap` diff with `git -C $WT diff` and confirm
it is the only change.

- [ ] **Step 6: Commit**

```
git -C $WT add src/app/constants.ts src/app/sampleFiles.ts \
  src/__tests__/sampleFiles.test.ts \
  src/__tests__/__snapshots__/constants.test.ts.snap
```

Message: `Add WAV sample file checks`

---

### Task 2: Custom buffers in `AudioEngine`

**Files:**
- Modify: `src/app/AudioEngine.ts` (field near line 54, new
  methods after `preloadKit` ~line 245, `playSound` ~line 357)
- Modify: `src/__tests__/audioEngine.test.ts` (append a
  `describe`)

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/audioEngine.test.ts`:

```ts
describe('AudioEngine custom samples', () => {
  function engineCtx(): MockAudioContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (audioEngine as any).ctx as MockAudioContext;
  }

  function kitBuffers(): Map<TrackId, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (audioEngine as any).buffers;
  }

  /** Plays `id` and returns the buffer the source got. */
  function playedBuffer(id: TrackId): unknown {
    const ctx = engineCtx();
    const spy = vi.spyOn(ctx, 'createBufferSource');
    audioEngine.playSound(id, 0, 1);
    const source = spy.mock.results.at(-1)?.value as
      { buffer: unknown } | undefined;
    spy.mockRestore();
    return source?.buffer;
  }

  const fakeFile = {
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as File;

  beforeEach(async () => {
    // The failed fetches log one error per sample.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Make sure the context exists.
    vi.stubGlobal(
      'fetch', vi.fn().mockRejectedValue(new Error('x'))
    );
    await audioEngine.preloadKit('808');
  });

  afterEach(() => {
    audioEngine.clearCustomSamples();
    vi.mocked(console.error).mockRestore();
  });

  it('decodeSample decodes the file bytes', async () => {
    const decoded = { decoded: true };
    engineCtx().decodeAudioData = vi.fn(async () => decoded);
    await expect(audioEngine.decodeSample(fakeFile))
      .resolves.toBe(decoded);
    expect(engineCtx().decodeAudioData).toHaveBeenCalledWith(
      expect.any(ArrayBuffer)
    );
  });

  it('decodeSample rejects when decoding fails', async () => {
    engineCtx().decodeAudioData = vi.fn(
      async () => { throw new Error('bad'); }
    );
    await expect(audioEngine.decodeSample(fakeFile))
      .rejects.toThrow();
  });

  it('plays the custom buffer instead of the kit one', () => {
    const kit = { kit: true };
    const custom = { custom: true };
    kitBuffers().set('sd', kit);
    audioEngine.setCustomSample(
      'sd', custom as unknown as AudioBuffer
    );
    expect(playedBuffer('sd')).toBe(custom);
  });

  it('falls back to the kit after clearing a track', () => {
    const kit = { kit: true };
    kitBuffers().set('sd', kit);
    audioEngine.setCustomSample(
      'sd', {} as unknown as AudioBuffer
    );
    audioEngine.clearCustomSample('sd');
    expect(playedBuffer('sd')).toBe(kit);
  });

  it('clearCustomSamples clears every track', () => {
    const kit = { kit: true };
    kitBuffers().set('sd', kit);
    kitBuffers().set('oh', kit);
    audioEngine.setCustomSample(
      'sd', {} as unknown as AudioBuffer
    );
    audioEngine.setCustomSample(
      'oh', {} as unknown as AudioBuffer
    );
    audioEngine.clearCustomSamples();
    expect(playedBuffer('sd')).toBe(kit);
    expect(playedBuffer('oh')).toBe(kit);
  });

  it('a kit load keeps custom samples', async () => {
    const custom = { custom: true };
    audioEngine.setCustomSample(
      'sd', custom as unknown as AudioBuffer
    );
    await audioEngine.preloadKit('electro');
    expect(playedBuffer('sd')).toBe(custom);
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npm --prefix $WT test -- src/__tests__/audioEngine.test.ts`
Expected: FAIL, `audioEngine.clearCustomSamples is not a function`
(and the others).

- [ ] **Step 3: Implement**

In `src/app/AudioEngine.ts`, after
`private buffers: Map<TrackId, AudioBuffer> = new Map();` add:

```ts
  // Samples loaded from files, by track. They win over
  // the kit's buffers and survive kit changes.
  private customBuffers: Map<TrackId, AudioBuffer> = new Map();
```

After the closing brace of `preloadKit` add:

```ts
  /**
   * Decodes an audio file into a buffer. Rejects if the
   * browser can't decode it.
   */
  public async decodeSample(file: File): Promise<AudioBuffer> {
    this.init();
    const data = await file.arrayBuffer();
    return this.ctx!.decodeAudioData(data);
  }

  /** Plays `buffer` for this track instead of the kit's. */
  public setCustomSample(id: TrackId, buffer: AudioBuffer) {
    this.customBuffers.set(id, buffer);
  }

  /** Goes back to the kit's sound for this track. */
  public clearCustomSample(id: TrackId) {
    this.customBuffers.delete(id);
  }

  /** Goes back to the kit's sound on every track. */
  public clearCustomSamples() {
    this.customBuffers.clear();
  }
```

In `playSound`, replace
`const buffer = this.buffers.get(id);` with:

```ts
    const buffer =
      this.customBuffers.get(id) ?? this.buffers.get(id);
```

- [ ] **Step 4: Run the tests**

Run: `npm --prefix $WT test -- src/__tests__/audioEngine.test.ts`
Expected: PASS (all describes, old and new).

- [ ] **Step 5: Commit**

```
git -C $WT add src/app/AudioEngine.ts \
  src/__tests__/audioEngine.test.ts
```

Message: `Let tracks play a custom sample buffer`

---

### Task 3: `useCustomSamples` hook

**Files:**
- Create: `src/app/hooks/useCustomSamples.ts`
- Create: `src/__tests__/hooks/useCustomSamples.test.ts`

Design notes (from the spec):
- No args. Not reset by `clearAll`, so it has **no** `reset()`.
- Each load or reset bumps a per-track counter in a ref; a decode
  that finishes after its track's counter moved is dropped. So
  the last load started wins and a reset beats a load in flight.
- A type or size error also bumps the counter (it is the latest
  thing the user asked for on that track).
- All actions are stable (`useCallback` with `[]`).

- [ ] **Step 1: Write the failing tests**

`src/__tests__/hooks/useCustomSamples.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { useCustomSamples } from '../../app/hooks/useCustomSamples';
import { audioEngine } from '../../app/AudioEngine';
import { MAX_SAMPLE_FILE_BYTES } from '../../app/constants';

vi.mock('../../app/AudioEngine', () => ({
  audioEngine: {
    decodeSample: vi.fn(),
    setCustomSample: vi.fn(),
    clearCustomSample: vi.fn(),
    clearCustomSamples: vi.fn(),
  },
}));

const engine = vi.mocked(audioEngine);

function wav(name = 'kick.wav', size = 4): File {
  const file = new File(['x'], name, { type: 'audio/wav' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** A decode we resolve or reject by hand. */
function deferredDecode() {
  let resolve!: (b: AudioBuffer) => void;
  let reject!: (e: Error) => void;
  engine.decodeSample.mockImplementationOnce(
    () => new Promise<AudioBuffer>((res, rej) => {
      resolve = res;
      reject = rej;
    })
  );
  return {
    resolve: (b: AudioBuffer) => resolve(b),
    reject: () => reject(new Error('bad')),
  };
}

const bufA = { a: 1 } as unknown as AudioBuffer;
const bufB = { b: 1 } as unknown as AudioBuffer;

beforeEach(() => {
  vi.clearAllMocks();
  engine.decodeSample.mockResolvedValue(bufA);
});

describe('useCustomSamples', () => {
  it('starts with no samples and no error', () => {
    const { result } = renderHook(() => useCustomSamples());
    expect(result.current.customSamples).toEqual({});
    expect(result.current.sampleError).toBeNull();
  });

  it('loads a WAV onto a track', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const file = wav();
    await act(() => result.current.loadSample('sd', file));
    expect(engine.decodeSample).toHaveBeenCalledWith(file);
    expect(engine.setCustomSample)
      .toHaveBeenCalledWith('sd', bufA);
    expect(result.current.customSamples.sd).toBe(file);
  });

  it('refuses a non-WAV without decoding', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample('sd', new File(['x'], 'a.aif'))
    );
    expect(engine.decodeSample).not.toHaveBeenCalled();
    expect(result.current.sampleError).toBe(
      'Only WAV samples are supported (got a.aif).'
    );
    expect(result.current.customSamples.sd).toBeUndefined();
  });

  it('refuses a file over the size limit', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample(
        'sd', wav('big.wav', MAX_SAMPLE_FILE_BYTES + 1)
      )
    );
    expect(engine.decodeSample).not.toHaveBeenCalled();
    expect(result.current.sampleError)
      .toMatch(/^big\.wav is too large/);
  });

  it('keeps the previous sample when decoding fails',
    async () => {
      const { result } = renderHook(() => useCustomSamples());
      const first = wav('first.wav');
      await act(() => result.current.loadSample('sd', first));
      engine.decodeSample.mockRejectedValueOnce(
        new Error('bad')
      );
      await act(() =>
        result.current.loadSample('sd', wav('broken.wav'))
      );
      expect(result.current.customSamples.sd).toBe(first);
      expect(engine.setCustomSample).toHaveBeenCalledTimes(1);
      expect(result.current.sampleError).toBe(
        "Couldn't read broken.wav. It may be damaged or use"
        + ' an unusual WAV encoding.'
      );
    }
  );

  it('a successful load clears the error', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample('sd', new File(['x'], 'a.aif'))
    );
    expect(result.current.sampleError).not.toBeNull();
    await act(() => result.current.loadSample('sd', wav()));
    expect(result.current.sampleError).toBeNull();
  });

  it('dismissSampleError clears the error', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample('sd', new File(['x'], 'a.aif'))
    );
    act(() => result.current.dismissSampleError());
    expect(result.current.sampleError).toBeNull();
  });

  it('resetSample clears one track', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() => result.current.loadSample('sd', wav()));
    await act(() => result.current.loadSample('oh', wav()));
    act(() => result.current.resetSample('sd'));
    expect(engine.clearCustomSample).toHaveBeenCalledWith('sd');
    expect(result.current.customSamples.sd).toBeUndefined();
    expect(result.current.customSamples.oh).toBeDefined();
  });

  it('resetAllSamples clears every track', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() => result.current.loadSample('sd', wav()));
    await act(() => result.current.loadSample('oh', wav()));
    act(() => result.current.resetAllSamples());
    expect(engine.clearCustomSamples).toHaveBeenCalled();
    expect(result.current.customSamples).toEqual({});
  });

  it('the load started last wins', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    const fast = deferredDecode();
    const older = wav('older.wav');
    const newer = wav('newer.wav');
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.loadSample('sd', older);
      p2 = result.current.loadSample('sd', newer);
    });
    await act(async () => {
      fast.resolve(bufB);
      await p2;
      slow.resolve(bufA);
      await p1;
    });
    expect(result.current.customSamples.sd).toBe(newer);
    expect(engine.setCustomSample).toHaveBeenCalledTimes(1);
    expect(engine.setCustomSample)
      .toHaveBeenCalledWith('sd', bufB);
  });

  it('a stale decode failure shows no error', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    let p1!: Promise<void>;
    act(() => {
      p1 = result.current.loadSample('sd', wav('old.wav'));
    });
    await act(() => result.current.loadSample('sd', wav()));
    await act(async () => {
      slow.reject();
      await p1;
    });
    expect(result.current.sampleError).toBeNull();
  });

  it('a reset during a load wins', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    let p!: Promise<void>;
    act(() => {
      p = result.current.loadSample('sd', wav());
    });
    act(() => result.current.resetSample('sd'));
    await act(async () => {
      slow.resolve(bufA);
      await p;
    });
    expect(engine.setCustomSample).not.toHaveBeenCalled();
    expect(result.current.customSamples.sd).toBeUndefined();
  });

  it('reset all during a load wins', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    let p!: Promise<void>;
    act(() => {
      p = result.current.loadSample('oh', wav());
    });
    act(() => result.current.resetAllSamples());
    await act(async () => {
      slow.resolve(bufA);
      await p;
    });
    expect(engine.setCustomSample).not.toHaveBeenCalled();
  });

  it('keeps its actions stable', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const before = result.current;
    await act(() => result.current.loadSample('sd', wav()));
    expect(result.current.loadSample).toBe(before.loadSample);
    expect(result.current.resetSample).toBe(before.resetSample);
    expect(result.current.resetAllSamples)
      .toBe(before.resetAllSamples);
    expect(result.current.dismissSampleError)
      .toBe(before.dismissSampleError);
  });

  it('has no reset() (Reset keeps custom samples)', () => {
    const { result } = renderHook(() => useCustomSamples());
    expect('reset' in result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npm --prefix $WT test -- src/__tests__/hooks/useCustomSamples.test.ts`
Expected: FAIL, cannot resolve `useCustomSamples`.

- [ ] **Step 3: Implement `src/app/hooks/useCustomSamples.ts`**

```ts
"use client";

import { useCallback, useRef, useState } from 'react';
import { audioEngine } from '../AudioEngine';
import { checkSampleFile, decodeErrorMessage } from '../sampleFiles';
import { TRACK_IDS } from '../types';
import type { TrackId } from '../types';

export type CustomSamples = Partial<Record<TrackId, File>>;

export interface UseCustomSamplesReturn {
  /** Original file per custom track (name and bytes). */
  customSamples: CustomSamples;
  /** Why the last load was refused, if it was. */
  sampleError: string | null;
  loadSample: (track: TrackId, file: File) => Promise<void>;
  resetSample: (track: TrackId) => void;
  resetAllSamples: () => void;
  dismissSampleError: () => void;
}

/**
 * Samples loaded from files onto tracks. Memory only,
 * independent of the kit (a kit change keeps them).
 *
 * Deliberately has no reset(): Reset (clearAll) keeps
 * custom samples, like the master volume. Only
 * resetSample and resetAllSamples clear them.
 */
export function useCustomSamples(): UseCustomSamplesReturn {
  const [customSamples, setCustomSamples] =
    useState<CustomSamples>({});
  const [sampleError, setSampleError] =
    useState<string | null>(null);

  // Bumped by every load and reset of a track. A decode
  // that finishes after its track's count moved on is
  // stale and dropped, so the latest request wins.
  const requestIdsRef = useRef<Partial<Record<TrackId, number>>>(
    {}
  );
  const bump = useCallback((track: TrackId): number => {
    const next = (requestIdsRef.current[track] ?? 0) + 1;
    requestIdsRef.current[track] = next;
    return next;
  }, []);

  const loadSample = useCallback(
    async (track: TrackId, file: File) => {
      const requestId = bump(track);
      const isCurrent = () =>
        requestIdsRef.current[track] === requestId;

      const problem = checkSampleFile(file);
      if (problem) {
        setSampleError(problem);
        return;
      }

      let buffer: AudioBuffer;
      try {
        buffer = await audioEngine.decodeSample(file);
      } catch {
        if (isCurrent()) {
          setSampleError(decodeErrorMessage(file.name));
        }
        return;
      }
      if (!isCurrent()) return;

      audioEngine.setCustomSample(track, buffer);
      setCustomSamples(prev => ({ ...prev, [track]: file }));
      setSampleError(null);
    },
    [bump]
  );

  const resetSample = useCallback((track: TrackId) => {
    bump(track);
    audioEngine.clearCustomSample(track);
    setCustomSamples(prev => {
      if (!(track in prev)) return prev;
      const next = { ...prev };
      delete next[track];
      return next;
    });
  }, [bump]);

  const resetAllSamples = useCallback(() => {
    for (const id of TRACK_IDS) bump(id);
    audioEngine.clearCustomSamples();
    setCustomSamples({});
  }, [bump]);

  const dismissSampleError = useCallback(() => {
    setSampleError(null);
  }, []);

  return {
    customSamples,
    sampleError,
    loadSample,
    resetSample,
    resetAllSamples,
    dismissSampleError,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm --prefix $WT test -- src/__tests__/hooks/useCustomSamples.test.ts`
Expected: PASS. If "the load started last wins" fails with
`setCustomSample` called twice, the staleness check is missing
after `await`; fix the hook.

- [ ] **Step 5: Commit**

```
git -C $WT add src/app/hooks/useCustomSamples.ts \
  src/__tests__/hooks/useCustomSamples.test.ts
```

Message: `Add useCustomSamples hook`

---

### Task 4: Context wiring and the status banner

**Files:**
- Create: `src/app/statusMessage.ts`
- Create: `src/__tests__/statusMessage.test.ts`
- Modify: `src/app/SequencerContext.tsx`
- Modify: `src/app/Sequencer.tsx:104-111`
- Modify: `src/__tests__/SequencerContext.test.tsx` (mock at
  lines 19-30; new describe at the end)

- [ ] **Step 1: Write the failing `statusMessage` test**

`src/__tests__/statusMessage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickStatus } from '../app/statusMessage';

const none = {
  loadError: null, sampleError: null, importNotice: null,
};

describe('pickStatus', () => {
  it('is null when there is nothing to show', () => {
    expect(pickStatus(none)).toBeNull();
  });

  it('shows a kit load error first', () => {
    expect(pickStatus({
      loadError: 'kit', sampleError: 'sample',
      importNotice: 'link',
    })).toEqual({ source: 'load', message: 'kit' });
  });

  it('shows a sample error before a link notice', () => {
    expect(pickStatus({
      ...none, sampleError: 'sample', importNotice: 'link',
    })).toEqual({ source: 'sample', message: 'sample' });
  });

  it('shows a link notice last', () => {
    expect(pickStatus({ ...none, importNotice: 'link' }))
      .toEqual({ source: 'import', message: 'link' });
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm --prefix $WT test -- src/__tests__/statusMessage.test.ts`
Expected: FAIL, cannot resolve `statusMessage`.

- [ ] **Step 3: Create `src/app/statusMessage.ts`**

```ts
export type StatusSource = 'load' | 'sample' | 'import';

export interface StatusInputs {
  loadError: string | null;
  sampleError: string | null;
  importNotice: string | null;
}

/**
 * The one message StatusBanner shows: a kit load error,
 * then a refused sample, then a share-link notice.
 */
export function pickStatus(
  inputs: StatusInputs
): { source: StatusSource; message: string } | null {
  if (inputs.loadError) {
    return { source: 'load', message: inputs.loadError };
  }
  if (inputs.sampleError) {
    return { source: 'sample', message: inputs.sampleError };
  }
  if (inputs.importNotice) {
    return { source: 'import', message: inputs.importNotice };
  }
  return null;
}
```

Run the test again. Expected: PASS.

- [ ] **Step 4: Write failing context tests**

In `src/__tests__/SequencerContext.test.tsx`, add to the
`audioEngine` mock object (lines 19-30):

```ts
    decodeSample: vi.fn().mockResolvedValue({}),
    setCustomSample: vi.fn(),
    clearCustomSample: vi.fn(),
    clearCustomSamples: vi.fn(),
```

Append at the end of the file:

```ts
// -------------------------------------------------------
// Custom samples (memory only, kept by Reset and kits)
// -------------------------------------------------------
describe('custom samples', () => {
  const wav = () =>
    new File(['x'], 'kick.wav', { type: 'audio/wav' });

  it('loads a sample onto a track', async () => {
    const { result } = renderSequencer();
    const file = wav();
    await act(() =>
      result.current.actions.loadSample('sd', file)
    );
    expect(result.current.state.customSamples.sd).toBe(file);
  });

  it('Reset keeps custom samples', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    act(() => result.current.actions.clearAll());
    expect(result.current.state.customSamples.sd)
      .toBeDefined();
  });

  it('a kit change keeps custom samples', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    const electro = kitsData.kits.find(
      k => k.id === 'electro'
    )!;
    act(() => result.current.actions.setKit(electro));
    expect(result.current.state.currentKit.id)
      .toBe('electro');
    expect(result.current.state.customSamples.sd)
      .toBeDefined();
  });

  it('exposes a refused file as sampleError', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample(
        'sd', new File(['x'], 'a.aif')
      )
    );
    expect(result.current.state.sampleError).toBe(
      'Only WAV samples are supported (got a.aif).'
    );
    act(() => result.current.actions.dismissSampleError());
    expect(result.current.state.sampleError).toBeNull();
  });

  it('resetAllSamples clears every track', async () => {
    const { result } = renderSequencer();
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    act(() => result.current.actions.resetAllSamples());
    expect(result.current.state.customSamples).toEqual({});
  });

  it('keeps actions stable across a load', async () => {
    const { result } = renderSequencer();
    const actions = result.current.actions;
    await act(() =>
      result.current.actions.loadSample('sd', wav())
    );
    expect(result.current.actions).toBe(actions);
  });
});
```

Run: `npm --prefix $WT test -- src/__tests__/SequencerContext.test.tsx`
Expected: FAIL, `loadSample is not a function` and
`customSamples` undefined.

- [ ] **Step 5: Wire the hook into `SequencerContext.tsx`**

1. Import:
   ```ts
   import { useCustomSamples } from './hooks/useCustomSamples';
   import type { CustomSamples } from './hooks/useCustomSamples';
   ```
2. In `interface SequencerState`, after `autoMinimize: boolean;`:
   ```ts
     /**
      * Samples loaded from files, by track. Memory only;
      * kept by Reset and kit changes.
      */
     customSamples: CustomSamples;
     /** Why the last sample load was refused. */
     sampleError: string | null;
   ```
3. In `interface SequencerActions`, after `holdAutoMinimize`:
   ```ts
     loadSample: (trackId: TrackId, file: File) => Promise<void>;
     resetSample: (trackId: TrackId) => void;
     resetAllSamples: () => void;
     dismissSampleError: () => void;
   ```
4. After `const minimize = useMinimizedTracks({...});` add:
   ```ts
     // Not part of clearAll: Reset keeps custom samples.
     const samples = useCustomSamples();
   ```
   Do **not** add anything to `clearAll`.
5. Next to `const { minimizedTracks, minimizableCount } = minimize;`
   add:
   ```ts
     const { customSamples, sampleError } = samples;
   ```
   Add `customSamples, sampleError,` to the `state` object and to
   its dependency array.
6. Next to the other action destructures add:
   ```ts
     const {
       loadSample, resetSample, resetAllSamples,
       dismissSampleError,
     } = samples;
   ```
   Add all four to the `actions` object and its dependency array.

- [ ] **Step 6: Use `pickStatus` in `Sequencer.tsx`**

Import `import { pickStatus } from './statusMessage';` and replace
the `<StatusBanner ... />` block (lines 104-111) with:

```tsx
        <StatusBanner
          message={status?.message ?? null}
          onDismiss={
            status?.source === 'load'
              ? actions.dismissError
              : status?.source === 'sample'
                ? actions.dismissSampleError
                : actions.dismissImportNotice
          }
        />
```

and, near the top of the component body where `state` and
`actions` are read from `useSequencer()`, add:

```ts
  const status = pickStatus(state);
```

(Read the component first to find that spot; if `state` is
destructured differently, pass
`{ loadError, sampleError, importNotice }` explicitly.)

- [ ] **Step 7: Run tests and typecheck**

Run: `npm --prefix $WT test -- src/__tests__/SequencerContext.test.tsx src/__tests__/statusMessage.test.ts`
Expected: PASS.

Run: `npm --prefix $WT run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```
git -C $WT add src/app/statusMessage.ts \
  src/__tests__/statusMessage.test.ts \
  src/app/SequencerContext.tsx src/app/Sequencer.tsx \
  src/__tests__/SequencerContext.test.tsx
```

Message: `Expose custom samples through the sequencer`

---

### Task 5: Dot and track name menu items

**Files:**
- Create: `src/app/CustomSampleDot.tsx`
- Modify: `src/app/TrackNameButton.tsx`
- Modify: `src/__tests__/TrackNameButton.test.tsx`

Menu order after this task: Free-run, Preview sound,
Load sample from file..., [Reset to kit sample], divider,
Clear track.

- [ ] **Step 1: Write failing tests**

In `src/__tests__/TrackNameButton.test.tsx`:

1. Add to `renderButton`'s default props:
   ```ts
       onLoadSample: vi.fn(),
       onResetSample: vi.fn(),
   ```
2. The existing "arrow keys move focus between menu items" test
   destructures three items. The menu now has four by spec, so
   change the destructure to
   `const [freeRun, preview, , clear] = screen.getAllByRole('menuitem');`
   and the `ArrowDown` from `freeRun` still lands on `preview`.
   No other assertion changes.
3. Append inside the `describe`:

```ts
  it('offers Load sample from file', () => {
    renderButton();
    openMenu();
    expect(screen.getByRole('menuitem', {
      name: /load sample from file/i,
    })).toBeInTheDocument();
  });

  it('offers Reset only for a custom track', () => {
    renderButton();
    openMenu();
    expect(screen.queryByRole('menuitem', {
      name: /reset to kit sample/i,
    })).toBeNull();
  });

  it('Reset to kit sample calls onResetSample', () => {
    const props = renderButton({
      customSampleName: 'kick.wav',
    });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', {
      name: /reset to kit sample/i,
    }));
    expect(props.onResetSample).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Load opens the file picker and closes the menu', () => {
    renderButton();
    openMenu();
    const input = screen.getByLabelText(
      'Load sample for SD'
    ) as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('menuitem', {
      name: /load sample from file/i,
    }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    // Still mounted after the menu closed.
    expect(input.isConnected).toBe(true);
  });

  it('a chosen file goes to onLoadSample', () => {
    const props = renderButton();
    const input = screen.getByLabelText(
      'Load sample for SD'
    ) as HTMLInputElement;
    expect(input.accept).toBe(
      '.wav,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave'
    );
    const file = new File(['x'], 'kick.wav');
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onLoadSample).toHaveBeenCalledWith(file);
  });

  it('a cancelled picker loads nothing', () => {
    const props = renderButton();
    const input = screen.getByLabelText('Load sample for SD');
    fireEvent.change(input, { target: { files: [] } });
    expect(props.onLoadSample).not.toHaveBeenCalled();
  });

  it('small size has no file input', () => {
    renderButton({ size: 'sm' });
    expect(screen.queryByLabelText('Load sample for SD'))
      .toBeNull();
  });
```

Also create `src/__tests__/CustomSampleDot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CustomSampleDot from '../app/CustomSampleDot';

describe('CustomSampleDot', () => {
  it('names the file for hover and screen readers', () => {
    render(<CustomSampleDot fileName="kick.wav" />);
    const dot = screen.getByRole('img', {
      name: 'Custom sample: kick.wav',
    });
    expect(dot).toHaveAttribute('title', 'kick.wav');
  });
});
```

Run: `npm --prefix $WT test -- src/__tests__/TrackNameButton.test.tsx src/__tests__/CustomSampleDot.test.tsx`
Expected: FAIL (no such items, no such component).

- [ ] **Step 2: Create `src/app/CustomSampleDot.tsx`**

```tsx
interface CustomSampleDotProps {
  /** Original file name, shown on hover. */
  fileName: string;
  /** Positioning classes from the parent. */
  className?: string;
}

/**
 * Small amber dot marking a track that plays a sample
 * loaded from a file. A 12px box keeps it easy to hover.
 */
export default function CustomSampleDot({
  fileName,
  className = '',
}: CustomSampleDotProps) {
  return (
    <span
      role="img"
      aria-label={`Custom sample: ${fileName}`}
      title={fileName}
      className={
        'flex items-center justify-center w-3 h-3 shrink-0 '
        + className
      }
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full bg-accent"
      />
    </span>
  );
}
```

- [ ] **Step 3: Extend `TrackNameButton.tsx`**

1. Import `import { SAMPLE_ACCEPT } from './sampleFiles';`.
2. Add props to `TrackNameButtonProps` and destructure them:
   ```ts
     /** File name when the track plays a custom sample. */
     customSampleName?: string;
     onLoadSample?: (file: File) => void;
     onResetSample?: () => void;
   ```
3. Add `const fileInputRef = useRef<HTMLInputElement>(null);`
   next to the other refs.
4. Inside `<div className="relative">`, right after the closing
   `</button>` of the name button and before
   `{menuOpen && size === 'lg' && (`, add:
   ```tsx
        {size === 'lg' && (
          <input
            ref={fileInputRef}
            type="file"
            accept={SAMPLE_ACCEPT}
            aria-label={`Load sample for ${trackName}`}
            tabIndex={-1}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              // Clear so the same file can be picked again.
              e.target.value = '';
              if (file) onLoadSample?.(file);
            }}
          />
        )}
   ```
   It sits outside the menu block so it stays mounted after the
   menu closes (otherwise `onChange` never fires).
5. In the menu, after the "Preview sound" button and before the
   divider `<div className="h-px bg-line mx-1.5 my-1" />`, add:
   ```tsx
          <button
            role="menuitem"
            onClick={() => {
              // Opens the picker inside the click (a user
              // gesture), then closes the menu.
              fileInputRef.current?.click();
              closeMenu();
            }}
            className={MENU_ITEM}
          >
            <span>Load sample from file...</span>
          </button>
          {customSampleName !== undefined && (
            <button
              role="menuitem"
              onClick={() => {
                onResetSample?.();
                closeMenu();
              }}
              className={MENU_ITEM}
            >
              <span>Reset to kit sample</span>
            </button>
          )}
   ```

- [ ] **Step 4: Run the tests**

Run: `npm --prefix $WT test -- src/__tests__/TrackNameButton.test.tsx src/__tests__/CustomSampleDot.test.tsx`
Expected: PASS. If `fireEvent.change` with `files` fails to set
`files` in jsdom, define it first with
`Object.defineProperty(input, 'files', { value: [file] })` and then
`fireEvent.change(input)`.

Run: `npm --prefix $WT run lint`
Expected: no errors (jsx-a11y included).

- [ ] **Step 5: Commit**

```
git -C $WT add src/app/CustomSampleDot.tsx \
  src/app/TrackNameButton.tsx \
  src/__tests__/TrackNameButton.test.tsx \
  src/__tests__/CustomSampleDot.test.tsx
```

Message: `Add sample items to the track name menu`

---

### Task 6: Rows show the dot and pass the actions

**Files:**
- Modify: `src/app/TrackRow.tsx`
- Modify: `src/app/StepGrid.tsx:59-75, 495-547`
- Modify: `src/__tests__/TrackRow.test.tsx`

Dot placement (no layout shift):
- Phone row (`sm`): inline after the name. The mixer has
  `ml-auto`, so nothing moves.
- Desktop row (`lg`): wrap the name in `relative shrink-0` and
  put the dot `absolute top-0 right-0`, over the empty right end
  of the 56px name box. The mixer does not move.
- Minimized row: inline after the name; its name column has a
  fixed width, so the step line does not move.

- [ ] **Step 1: Write failing tests**

Append to `src/__tests__/TrackRow.test.tsx`:

```tsx
describe('TrackRow custom samples', () => {
  const dots = () => screen.queryAllByRole('img', {
    name: 'Custom sample: kick.wav',
  });

  it('shows no dot for a kit sample', () => {
    renderTrackRow();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('shows the dot at both row sizes', () => {
    renderTrackRow({ customSampleName: 'kick.wav' });
    // Phone and desktop name areas are both in the DOM.
    expect(dots()).toHaveLength(2);
  });

  it('shows the dot on a minimized row', () => {
    renderTrackRow({
      steps: '0'.repeat(16),
      trackLength: 16,
      patternLength: 16,
      isMinimized: true,
      customSampleName: 'kick.wav',
    });
    expect(dots()).toHaveLength(1);
  });

  it('binds load and reset to the track', () => {
    const onLoadSample = vi.fn();
    const onResetSample = vi.fn();
    renderTrackRow({
      customSampleName: 'kick.wav',
      onLoadSample,
      onResetSample,
    });
    const file = new File(['x'], 'snare.wav');
    fireEvent.change(
      screen.getByLabelText('Load sample for BD'),
      { target: { files: [file] } }
    );
    expect(onLoadSample).toHaveBeenCalledWith('bd', file);

    const names = screen.getAllByRole('button', { name: 'BD' });
    // The desktop name button has the menu.
    const lg = names.find(
      b => b.getAttribute('aria-haspopup') === 'menu'
    )!;
    fireEvent.contextMenu(lg);
    fireEvent.click(screen.getByRole('menuitem', {
      name: /reset to kit sample/i,
    }));
    expect(onResetSample).toHaveBeenCalledWith('bd');
  });
});
```

Run: `npm --prefix $WT test -- src/__tests__/TrackRow.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement in `TrackRow.tsx`**

1. `import CustomSampleDot from './CustomSampleDot';`
2. Add to `TrackRowProps`:
   ```ts
     /** File name when the track plays a custom sample. */
     customSampleName?: string;
     onLoadSample?: (trackId: TrackId, file: File) => void;
     onResetSample?: (trackId: TrackId) => void;
   ```
   and destructure them in `TrackRowInner`.
3. Add `customSampleName?: string;` to `MinimizedTrackRowProps`
   and destructure it. In `MinimizedTrackRow`, right after the name
   `</button>` (inside the `relative flex ... w-[76px] lg:w-56`
   div), add:
   ```tsx
        {customSampleName !== undefined && (
          <CustomSampleDot fileName={customSampleName} />
        )}
   ```
4. Bound callbacks, next to the others:
   ```ts
     const handleLoadSample = useCallback(
       (file: File) => onLoadSample?.(trackId, file),
       [onLoadSample, trackId]
     );
     const handleResetSample = useCallback(
       () => onResetSample?.(trackId),
       [onResetSample, trackId]
     );
   ```
5. Pass `customSampleName={customSampleName}` to
   `<MinimizedTrackRow>`.
6. Phone row: pass `customSampleName`, `onLoadSample=
   {handleLoadSample}`, `onResetSample={handleResetSample}` to the
   `size="sm"` `TrackNameButton` and add right after it:
   ```tsx
        {customSampleName !== undefined && (
          <CustomSampleDot fileName={customSampleName} />
        )}
   ```
7. Desktop row: replace the `size="lg"` `<TrackNameButton ... />`
   with:
   ```tsx
          <div className="relative shrink-0">
            <TrackNameButton
              size="lg"
              trackId={trackId}
              trackName={trackName}
              isFreeRun={isFreeRun}
              isTriggered={isTriggered}
              onToggleFreeRun={handleFreeRun}
              onClearTrack={handleClearTrack}
              onPlayPreview={handlePlayPreview}
              customSampleName={customSampleName}
              onLoadSample={handleLoadSample}
              onResetSample={handleResetSample}
            />
            {customSampleName !== undefined && (
              <CustomSampleDot
                fileName={customSampleName}
                className="absolute top-0 right-0"
              />
            )}
          </div>
   ```

- [ ] **Step 3: Wire `StepGrid.tsx`**

1. Add `customSamples` to the `state` destructure (line ~61) and
   `loadSample, resetSample` to the `actions` destructure
   (line ~65).
2. On `<TrackRow>` (line ~496) add:
   ```tsx
            customSampleName={customSamples[track.id]?.name}
            onLoadSample={loadSample}
            onResetSample={resetSample}
   ```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npm --prefix $WT test -- src/__tests__/TrackRow.test.tsx src/__tests__/StepGrid.test.tsx`
Expected: PASS.

Run: `npm --prefix $WT run typecheck` and
`npm --prefix $WT run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```
git -C $WT add src/app/TrackRow.tsx src/app/StepGrid.tsx \
  src/__tests__/TrackRow.test.tsx
```

Message: `Show custom sample dots on track rows`

---

### Task 7: "Reset all samples to kit" in the grid menu

**Files:**
- Modify: `src/app/GridContextMenu.tsx`
- Modify: `src/app/StepGrid.tsx:591-603`
- Create: `src/__tests__/GridContextMenu.test.tsx`

Placement: after the separator, above "Reset pattern". Shown only
when at least one track is custom (not disabled: absent).

- [ ] **Step 1: Write the failing test**

`src/__tests__/GridContextMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GridContextMenu from '../app/GridContextMenu';

function renderMenu(overrides = {}) {
  const props = {
    x: 10,
    y: 10,
    canMinimize: false,
    canRestore: false,
    onMinimize: vi.fn(),
    onRestoreAll: vi.fn(),
    autoMinimize: false,
    onSetAutoMinimize: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
    hasCustomSamples: false,
    onResetAllSamples: vi.fn(),
    ...overrides,
  };
  render(<GridContextMenu {...props} />);
  return props;
}

describe('GridContextMenu samples item', () => {
  it('is absent when no track is custom', () => {
    renderMenu();
    expect(screen.queryByRole('menuitem', {
      name: 'Reset all samples to kit',
    })).toBeNull();
  });

  it('resets every sample and closes', () => {
    const props = renderMenu({ hasCustomSamples: true });
    fireEvent.click(screen.getByRole('menuitem', {
      name: 'Reset all samples to kit',
    }));
    expect(props.onResetAllSamples).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npm --prefix $WT test -- src/__tests__/GridContextMenu.test.tsx`
Expected: FAIL (item never appears).

- [ ] **Step 2: Implement in `GridContextMenu.tsx`**

1. Add to `GridContextMenuProps`, after `onReset`:
   ```ts
     /** True when at least one track has a custom sample. */
     hasCustomSamples: boolean;
     onResetAllSamples: () => void;
   ```
   and destructure both.
2. Update the component doc comment's item list to include
   "reset samples".
3. After `<div role="separator" ... />` and before the
   "Reset pattern" button add:
   ```tsx
      {hasCustomSamples && (
        <button
          role="menuitem"
          onClick={() => {
            onResetAllSamples();
            onClose();
          }}
          className={MENU_ITEM}
        >
          <span>Reset all samples to kit</span>
        </button>
      )}
   ```

- [ ] **Step 3: Wire `StepGrid.tsx`**

Add `resetAllSamples` to the `actions` destructure (line ~65).
On `<GridContextMenu>` add:

```tsx
          hasCustomSamples={
            Object.keys(customSamples).length > 0
          }
          onResetAllSamples={resetAllSamples}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npm --prefix $WT test -- src/__tests__/GridContextMenu.test.tsx src/__tests__/StepGrid.test.tsx`
Expected: PASS.

Run: `npm --prefix $WT run typecheck` and
`npm --prefix $WT run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```
git -C $WT add src/app/GridContextMenu.tsx src/app/StepGrid.tsx \
  src/__tests__/GridContextMenu.test.tsx
```

Message: `Add Reset all samples to kit to the grid menu`

---

### Task 8: Help text and CLAUDE.md

**Files:**
- Modify: `src/app/helpContent.ts:160-178` (mouse tab)
- Modify: `src/__tests__/helpContent.test.ts`
- Modify: `CLAUDE.md`

The track menu is on the `lg` row (right-click, or a long-press
on a wide touch screen); the grid menu is also reachable on
phones through the ⋯ key. So the Mouse tab gets both changes and
the Touch tab's ⋯ row mentions resetting samples.

- [ ] **Step 1: Write the failing test**

Append inside the `describe` in
`src/__tests__/helpContent.test.ts`:

```ts
  it('lists the sample menu items', () => {
    const desk = getHelpTabs(false)
      .flatMap(t => t.sections)
      .flatMap(sec => sec.rows.map(r => ({ ...r, section: sec.title })));
    expect(desk).toContainEqual(expect.objectContaining({
      section: 'Track name',
      gesture: 'right-click',
      text: expect.stringMatching(/load or reset a sample/),
    }));
    expect(desk).toContainEqual(expect.objectContaining({
      section: 'Grid (blank area)',
      text: expect.stringMatching(/reset samples/),
    }));
  });
```

Run: `npm --prefix $WT test -- src/__tests__/helpContent.test.ts`
Expected: FAIL.

- [ ] **Step 2: Update `helpContent.ts`**

In the Mouse tab:
- "Track name" section, the right-click row's text becomes
  `'Track menu: free-run, preview, load or reset a sample, clear'`
  (keep its `note`).
- "Grid (blank area)" row's text becomes
  `'Grid menu: minimize, restore, auto-minimize, reset samples, reset'`.

In the Touch tab (line ~279), the `'tap ⋯ over the tracks'` row's
text becomes
`'Minimize, restore, auto-minimize, reset samples or reset tracks'`.

Run the test again. Expected: PASS. Run the Help modal tests too:
`npm --prefix $WT test -- src/__tests__/HelpModal.test.tsx`.
Expected: PASS (if a test pins the old text, it is pinning help
copy, not behavior; update that string to the new copy).

- [ ] **Step 3: Update `CLAUDE.md`**

Read `CLAUDE.md`, then:
1. Hooks list: after the `useMasterVolume.ts` bullet add
   ```
   - `useCustomSamples.ts` — samples loaded from WAV files
     onto tracks (track name menu: Load sample from
     file... / Reset to kit sample; grid menu: Reset all
     samples to kit). Memory only, not in
     `SequencerConfig` or share links; kept by kit changes
     and by Reset (no `reset()`). Each load/reset bumps a
     per-track counter so the latest request wins. Checks
     (WAV only, 20 MB) live in `sampleFiles.ts`;
     `AudioEngine.customBuffers` win over kit buffers
   ```
2. Change "Every hook that manages resettable state must expose a
   `reset()` method." to add: "Exceptions: `useMasterVolume` and
   `useCustomSamples`, which Reset deliberately keeps."
3. Component decomposition: in the `StepGrid.tsx →
   GridContextMenu.tsx` bullet, add "Reset all samples to kit
   (only when a track is custom)" to the listed items. Also add
   `- \`CustomSampleDot.tsx\` — amber dot (file name on hover) on a
   track with a custom sample`.
4. Error Boundaries section, `StatusBanner` bullet: say it shows
   kit load errors, refused samples, and share-link notices, one at
   a time in that order (`statusMessage.pickStatus`).

- [ ] **Step 4: Commit**

```
git -C $WT add src/app/helpContent.ts \
  src/__tests__/helpContent.test.ts CLAUDE.md
```

Message: `Document loading samples from files`

---

### Task 9: Full verification

- [ ] **Step 1:** `npm --prefix $WT run lint` → no errors or
  warnings (zero-lint policy, including preexisting ones).
- [ ] **Step 2:** `npm --prefix $WT run typecheck` → no errors.
- [ ] **Step 3:** `npm --prefix $WT test` → all pass.
- [ ] **Step 4:** `npm --prefix $WT run build` → succeeds.
- [ ] **Step 5:** Fix anything that fails (production code, not
  tests) and commit the fix.

---

### Task 10: Browser test (required: UI change)

Use Playwright (`mcp__plugin_playwright_playwright__*`).

- [ ] **Step 1: Prepare files** in the scratchpad (Write tool):
  - `not-a-sample.aif`: any text.
  - `broken.wav`: the text `not really a wav`.
  - For a good WAV, use a real kit file with a clearly different
    sound, e.g. `$WT/public/kits/electro/sd.wav` (on the 808 kit,
    load it onto OH).
  - If Playwright's file upload refuses a path outside its allowed
    roots, copy the files into a folder it accepts (e.g. under
    `$WT/.playwright-mcp/`, which is gitignored) and upload from
    there.
- [ ] **Step 2: Start the dev server** from the worktree in the
  background: `npm --prefix $WT run dev -- --port 3001`. Port
  3000 is already used by the main checkout's server. Read the
  output to confirm the actual port. Binding a port needs to run
  outside the sandbox.
- [ ] **Step 3: Check** at http://localhost:3001, window at least
  1280px wide (the menu is `lg` only):
  1. Right-click OH. The menu shows "Load sample from file..."
     and no "Reset to kit sample". Click Load, upload the electro
     `sd.wav`. A dot appears beside OH; hovering it shows
     `sd.wav`; the mixer knobs did not move (screenshot before and
     after).
  2. Play, or click OH: confirm via
     `browser_evaluate` that OH plays the custom buffer, e.g.
     check that a `playSound('oh', ...)` call happens and there is
     no console error. (Listening isn't possible; at least verify
     no errors and that the dot/state are right.)
  3. Change the kit to electro: OH keeps its dot; other tracks
     load the new kit.
  4. Load `not-a-sample.aif` (the picker filter may hide it; if
     Playwright's upload bypasses the filter, expect the
     "Only WAV samples are supported" banner). Load `broken.wav`:
     expect the "Couldn't read broken.wav" banner; OH keeps its
     dot and earlier sample.
  5. Right-click OH → "Reset to kit sample": the dot goes away.
  6. Load samples onto SD and OH, right-click a blank grid spot
     → "Reset all samples to kit": both dots go away.
  7. Press Reset with a custom sample loaded: the dot stays.
  8. Minimize empty tracks (H) with an empty custom track: the
     minimized row shows the dot.
  9. Phone width (390px): the dot shows after the name, and the
     row doesn't scroll sideways. Check the minimized row too: its
     name column is a fixed 76px (caret + name + dot), so make
     sure the dot isn't clipped.
  10. Dismiss each banner with its close button (this exercises
     the `onDismiss` wiring in `Sequencer.tsx`, which has no unit
     test).
- [ ] **Step 4:** Fix and commit anything found, rerun Task 9.
- [ ] **Step 5:** Stop the dev server on port 3001.

---

## Done when

- All tasks are checked, Task 9 is green, and Task 10 found no
  problems.
- The branch is ready for a PR (rebase on `github/main` first, PR
  under 70 chars, body says what it does; there is no issue to
  close unless one is created).
