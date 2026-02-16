# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when
working with code in this repository.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build (static export to /out/)
npm run lint     # ESLint
```

No test framework is configured.

## Architecture

XOX is a 16-step drum sequencer. Next.js 16 App Router with
static export to Cloudflare Pages. All app code lives in
`src/app/`.

Two-layer design:

**AudioEngine (`src/app/AudioEngine.ts`)** — Singleton managing
the Web Audio API. Implements a look-ahead scheduler (25ms timer,
100ms lookahead window) for sample-accurate playback. Preloads
and caches kit samples as AudioBuffers. Core loop:
`scheduler()` → `advanceStep()` → `playSound()`.

**Sequencer (`src/app/Sequencer.tsx`)** — Main React component
owning all UI state (playback, BPM, kit/pattern selection, track
mixer). Uses `requestAnimationFrame` for visual step sync.
Solo/mute priority: if any track is soloed, only soloed tracks
play; otherwise non-muted tracks play. Accented steps play at
1.5x gain.

Supporting files:
- `types.ts` — `TrackId`, `Kit`, `Pattern`, `TrackState` types
- `TempoController.tsx` — BPM input (clamped 20–300)
- `data/kits.json` — Kit definitions (id, name, folder path)
- `data/patterns.json` — 16-step patterns as binary strings
  (`"1010101010101010"`)
- `public/kits/{808,electro}/` — .wav samples per kit

## Key Conventions

- State management is local React state only (no external stores)
- AudioContext must be created/resumed on user gesture
- 12 track IDs: `ac bd sd ch oh cy ht mt lt rs cp cb`
  (`ac` is accent — hidden from UI, affects gain only)
- Patterns use 16-char binary strings per track
- Tailwind CSS v4 for styling
- TypeScript strict mode
