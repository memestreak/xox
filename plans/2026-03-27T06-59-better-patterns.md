---
date: 2026-03-27
summary: Build audition page and replace 137 legacy patterns with ~170 modern patterns across contemporary genres
---

# Better Patterns Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development (if subagents available) or executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pattern audition page for interactive curation, then replace all legacy patterns with ~170 modern, genre-appropriate drum patterns that use trig conditions.

**Architecture:** New `/audition` route reuses existing `SequencerProvider`, `StepGrid`, and `TempoController`. Patterns are staged via a JSON file in `/public/patterns/`, auditioned in-browser, and approved via chat. An "Approve Edited" button copies edited grid state to clipboard for patterns the user modifies.

**Tech Stack:** Next.js App Router, React, TypeScript, Web Audio API (via existing AudioEngine), Clipboard API

**Spec:** `docs/specs/2026-03-26-better-patterns-design.md`

---

### Task 1: Create Staging Infrastructure

**Files:**
- Create: `public/patterns/staging.json`
- Create: `src/app/data/approved-patterns.json`

- [ ] **Step 1: Create the staging pattern file**

Create the `public/patterns/` directory, then write `public/patterns/staging.json` with a starter House pattern:

```json
{
  "id": "house-1",
  "name": "House 01",
  "category": "House",
  "suggestedBpm": 124,
  "steps": {
    "ac": "0000000000000000",
    "bd": "1000100010001000",
    "sd": "0000100000001000",
    "ch": "1010101010101010",
    "oh": "0000000000000000",
    "cy": "0000000000000000",
    "ht": "0000000000000000",
    "mt": "0000000000000000",
    "lt": "0000000000000000",
    "rs": "0000000000000000",
    "cp": "0000000000000000",
    "cb": "0000000000000000"
  }
}
```

- [ ] **Step 2: Create the approved patterns file**

Write `src/app/data/approved-patterns.json`:

```json
{
  "patterns": []
}
```

- [ ] **Step 3: Commit**

```
git add public/patterns/staging.json src/app/data/approved-patterns.json
git commit -m "Add staging infrastructure for pattern audition"
```

---

### Task 2: Build the Audition Page

**Files:**
- Create: `src/app/audition/page.tsx`

**Key references:**
- `src/app/Sequencer.tsx` — provider wrapping pattern to follow
- `src/app/SequencerContext.tsx` — `useSequencer()` hook, `setPattern()` action, `meta.config` for trig/param state
- `src/app/StepGrid.tsx` — `StepGridProps` interface (scrollContainerRef, pageOffset, autoFollow, setPage)
- `src/app/TempoController.tsx` — `TempoControllerProps` (bpm, setBpm)
- `src/app/types.ts:40-51` — `Pattern` interface
- `src/app/TooltipContext.tsx` — `TooltipProvider`
- `src/app/MidiContext.tsx` — `MidiProvider`

- [ ] **Step 1: Create the audition page component**

Create `src/app/audition/page.tsx`. The page structure:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { SequencerProvider, useSequencer } from '../SequencerContext';
import { TooltipProvider } from '../TooltipContext';
import { MidiProvider } from '../MidiContext';
import StepGrid from '../StepGrid';
import TempoController from '../TempoController';
import type { Pattern, TrackId } from '../types';
import { TRACK_IDS } from '../types';

interface StagingPattern extends Pattern {
  suggestedBpm: number;
}

function AuditionInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { state, actions, meta } = useSequencer();
  const { isPlaying, bpm, isLoaded } = state;
  const { togglePlay, setBpm, setPattern } = actions;

  const [patternName, setPatternName] = useState('');
  const [patternCategory, setPatternCategory] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const loadStagingPattern = useCallback(async () => {
    try {
      const cacheBuster = `?t=${Date.now()}`;
      const res = await fetch(
        `/patterns/staging.json${cacheBuster}`
      );
      const staging: StagingPattern = await res.json();

      // Build a plain Pattern (exclude suggestedBpm)
      const pattern: Pattern = {
        id: staging.id,
        name: staging.name,
        category: staging.category,
        steps: staging.steps,
        trigConditions: staging.trigConditions,
        parameterLocks: staging.parameterLocks,
      };

      setPatternName(staging.name);
      setPatternCategory(staging.category ?? '');
      setBpm(staging.suggestedBpm);
      setPattern(pattern);
    } catch {
      setToastMessage('Failed to load staging pattern');
      setTimeout(() => setToastMessage(''), 3000);
    }
  }, [setBpm, setPattern]);

  // Load on mount
  useEffect(() => {
    loadStagingPattern();
  }, [loadStagingPattern]);

  const handleApproveEdited = useCallback(async () => {
    const { config } = meta;
    const steps: Record<string, string> = {};
    for (const id of TRACK_IDS) {
      steps[id] = config.steps[id];
    }

    // Build pattern with current grid state
    const pattern: Pattern = {
      id: state.currentPattern.id,
      name: patternName,
      category: patternCategory || undefined,
      steps: steps as Record<TrackId, string>,
    };

    // Include trigConditions if any are set
    const tc = config.trigConditions;
    if (tc && Object.keys(tc).length > 0) {
      pattern.trigConditions = tc;
    }

    // Include parameterLocks if any are set
    const pl = config.parameterLocks;
    if (pl && Object.keys(pl).length > 0) {
      pattern.parameterLocks = pl;
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(pattern, null, 2)
      );
      setToastMessage('Copied to clipboard!');
      setTimeout(() => setToastMessage(''), 2000);
    } catch {
      setToastMessage('Clipboard write failed');
      setTimeout(() => setToastMessage(''), 3000);
    }
  }, [meta, state.currentPattern.id, patternName,
      patternCategory]);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950 text-neutral-100 font-sans">
      <div className="max-w-none lg:max-w-4xl w-full mx-auto px-3 lg:px-8 pt-3 lg:pt-4 flex flex-col flex-1 min-h-0">
        {/* Header: pattern info */}
        <div className="border-b border-neutral-800 pb-3 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                XOX Audition
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                <span className="text-neutral-100 font-medium">
                  {patternName}
                </span>
                {patternCategory && (
                  <span className="ml-2 text-neutral-500">
                    {patternCategory}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <TempoController bpm={bpm} setBpm={setBpm} />
              <button
                onClick={togglePlay}
                disabled={!isLoaded}
                className={`w-20 py-2 rounded-full font-bold text-sm text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                  isPlaying
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isPlaying ? 'STOP' : 'PLAY'}
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-3"
        >
          <StepGrid
            scrollContainerRef={scrollRef}
            pageOffset={0}
            autoFollow={false}
            setPage={() => {}}
          />
        </div>

        {/* Action bar */}
        <div className="border-t border-neutral-800 py-3 flex gap-3 items-center">
          <button
            onClick={handleApproveEdited}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition-colors"
          >
            Approve Edited
          </button>
          <button
            onClick={loadStagingPattern}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg font-bold text-sm transition-colors"
          >
            Reload Pattern
          </button>
          {toastMessage && (
            <span className="text-sm text-green-400 ml-2">
              {toastMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditionPage() {
  return (
    <SequencerProvider>
      <MidiProvider>
        <TooltipProvider>
          <AuditionInner />
        </TooltipProvider>
      </MidiProvider>
    </SequencerProvider>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: zero errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all tests pass (no test changes needed — this is a new page)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: static export succeeds, `/audition` page included in output

- [ ] **Step 5: Commit**

```
git add src/app/audition/page.tsx
git commit -m "Add audition page for pattern curation"
```

---

### Task 3: Manual Verification

**Prerequisites:** Dev server running (`npm run dev`)

- [ ] **Step 1: Navigate to `/audition`**

Open the audition page in the browser. Verify:
- Pattern name "House 01" and category "House" display in header
- BPM is set to 124
- StepGrid shows the pattern (kick on beats 1-2-3-4, hats on 8ths)

- [ ] **Step 2: Test playback**

Click PLAY. Verify the pattern plays back correctly. Click STOP.

- [ ] **Step 3: Test Reload Pattern**

Update `public/patterns/staging.json` with different step data. Click "Reload Pattern". Verify the grid updates to the new pattern.

- [ ] **Step 4: Test Approve Edited**

Edit a few steps on the grid (toggle some hits on/off). Click "Approve Edited". Verify:
- Toast shows "Copied to clipboard!"
- Paste clipboard contents — should be valid JSON with the edited step state

- [ ] **Step 5: Test Approve Edited with trig conditions**

Open a step popover, add a fill condition to a tom step. Click "Approve Edited". Verify the clipboard JSON includes the `trigConditions` field.

---

### Task 4: Pattern Curation (Interactive)

This task is the interactive audition loop. It happens in
conversation, not as automated steps.

**Process per category:**
1. AI writes a pattern to `public/patterns/staging.json`
2. AI describes the pattern (name, category, suggested BPM,
   character description)
3. User reloads audition page, plays pattern
4. User says "approve" or "skip" in chat, or edits and
   clicks Approve Edited (pastes JSON)
5. AI appends approved pattern to
   `src/app/data/approved-patterns.json`
6. Repeat for next pattern

**Category order and suggested BPMs:**

| Category          | Count | BPM Range |
|-------------------|-------|-----------|
| House             | 8     | 120-128   |
| Techno            | 8     | 128-140   |
| Drum & Bass       | 6     | 170-180   |
| Dubstep           | 4     | 140       |
| Trance            | 4     | 138-145   |
| Electro           | 4     | 120-130   |
| Breakbeat         | 4     | 120-140   |
| Garage            | 4     | 130-140   |
| IDM               | 4     | 90-140    |
| Ambient           | 4     | 70-100    |
| Boom Bap          | 8     | 85-95     |
| Trap              | 8     | 130-160   |
| Lo-Fi             | 6     | 70-90     |
| Drill             | 6     | 140-145   |
| R&B               | 6     | 60-80     |
| Reggaeton         | 6     | 90-100    |
| Phonk             | 5     | 130-160   |
| Pop               | 8     | 100-130   |
| Rock              | 8     | 100-140   |
| Indie             | 6     | 110-140   |
| Punk              | 4     | 160-200   |
| Metal             | 4     | 140-200   |
| New Wave          | 4     | 120-140   |
| Singer-Songwriter | 4     | 80-120    |
| Country           | 2     | 100-130   |
| Afrobeat          | 6     | 100-130   |
| Latin             | 6     | 100-140   |
| Funk              | 6     | 95-120    |
| Reggae            | 4     | 70-90     |
| Jazz              | 4     | 100-180   |
| Caribbean         | 4     | 100-130   |
| Middle Eastern    | 3     | 90-120    |
| Bollywood         | 2     | 100-140   |

**Pattern ordering within each category:** Simple patterns
first (plain binary steps), more complex patterns later
(incorporating fill conditions and cycle ratios).

---

### Task 5: Finalize Pattern Library

**Files:**
- Modify: `src/app/data/patterns.json`
- Delete: `src/app/data/approved-patterns.json`
- Delete: `public/patterns/staging.json`

- [ ] **Step 1: Replace patterns.json**

Replace the entire `patterns` array in `patterns.json` with
the contents of `approved-patterns.json`. This is a full
replacement — all 137 old patterns are removed.

- [ ] **Step 2: Update test snapshots**

Run: `npm test -- -u`
Expected: snapshots updated for new pattern data

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: zero errors

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: static export succeeds

- [ ] **Step 5: Manual verification**

Open the main app. Verify:
- Pattern picker shows new categories (House, Techno, Trap, etc.)
- Categories are sorted alphabetically
- Patterns within each category play correctly
- Default pattern (first in list) loads on page open

- [ ] **Step 6: Clean up staging files**

Delete `src/app/data/approved-patterns.json` and
`public/patterns/staging.json` — no longer needed.

- [ ] **Step 7: Commit**

```
git add src/app/data/patterns.json
git rm src/app/data/approved-patterns.json public/patterns/staging.json
git commit -m "Replace legacy patterns with modern library

170 patterns across 32 genres replacing the original 137
from a vintage drum machine pattern book. New categories
include house, techno, trap, lo-fi, drill, DnB, and more.
Some patterns use trig conditions (fill mode, cycle ratios)
for realistic variation."
```

---

### Task 6: Decide Audition Page Fate

- [ ] **Step 1: Ask user whether to keep or remove `/audition`**

Options:
- Keep it for future pattern additions
- Remove it (delete `src/app/audition/page.tsx`)
