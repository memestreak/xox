# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when
working with code in this repository.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build (static export to /out/)
npm run lint     # ESLint
npm test         # Vitest (unit + integration)
npm run test:watch  # Vitest in watch mode
```

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

**SequencerContext (`src/app/SequencerContext.tsx`)** — React
context provider managing all state. Split into two internal
contexts for render isolation: ConfigContext (serializable
state via `SequencerConfig`) and TransientContext (playback/UI).
Consumer API is `useSequencer()` returning `{ state, actions,
meta }`. Uses `requestAnimationFrame` for visual step sync.
Solo/mute priority: if any track is soloed, only soloed tracks
play; otherwise non-muted tracks play. Accented steps play at
1.5x gain.

**SequencerConfig (`src/app/types.ts`)** — Canonical type for
all persistable state (kit, BPM, steps, mixer). Single source
of truth for serializable configuration.

**configCodec (`src/app/configCodec.ts`)** — Encodes/decodes
`SequencerConfig` as compressed JSON + base64url for URL hash
sharing. Uses `CompressionStream('deflate-raw')`.

Supporting files:
- `types.ts` — `TrackId`, `Kit`, `Pattern`, `TrackState`,
  `SequencerConfig`, `TrackMixerState` types
- `TempoController.tsx` — BPM input (clamped 20-300)
- `SettingsPopover.tsx` — Gear icon settings menu with Export
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
