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

## Testing

Tests live in `src/__tests__/` and run via Vitest + jsdom.
A pre-push git hook runs `npm test` and `npm run lint`
before every push.

Test areas:
- `configCodec.test.ts` — round-trip, defensive decoding,
  field validation
- `configCodec.golden.test.ts` — backward-compatible
  serialization (golden hashes, base64url safety)
- `types.test.ts` — TRACK_IDS ordering snapshot
- `SequencerContext.test.tsx` — state actions, derived
  state, pattern state machine, URL hash import
- `handleStep.test.ts` — solo/mute priority, accent gain
- `audioEngine.test.ts` — timing math, step wrapping
- UI tests — SettingsPopover, TransportControls,
  TempoController

Run `npm test` after any logic change. Run `npm test --
-u` to update snapshots after intentional format changes.

## Issue Workflow

Issues are tracked on GitHub with priority labels
(`P0-critical` through `P3-low`) and status labels
(`ready`, `needs-spec`, `blocked`).

**Branch naming:** `issue-<number>-<short-kebab-description>`
(e.g., `issue-42-fix-tempo-crash`)

**One PR per issue.** Use `Fixes #<number>` in the PR body
to auto-close the issue on merge. **Never put
`Fixes #<number>` in a commit message pushed directly to
`main`** — it auto-closes the issue before the fix is
verified. Instead, close issues manually with `gh issue
close` after verification.

**Worktrees for concurrent work:**
```bash
git worktree add .worktrees/issue-<N> -b issue-<N>-<desc>
```

See `@skills/github-issues/SKILL.md` for the full workflow.

## Deployment

Deploys to Cloudflare Pages automatically on push to
`main`. To verify a deployment succeeded:

```bash
gh api repos/memestreak/xox/commits/<SHA>/check-runs \
  --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
```

Dashboard:
https://dash.cloudflare.com/24104e90cc6b2473822a3e91479614cb/pages/view/xox

## iOS Audio

iOS routes Web Audio through the "ambient" audio session
by default, which obeys the hardware Silent Mode switch.
`AudioEngine.bypassSilentMode()` forces the "playback"
category by playing a looping silent `<audio>` element
(WAV data URI) on first `start()`. This runs within the
user gesture context and requires no external library.

The AudioContext is created eagerly in `preloadKit()` —
`decodeAudioData` works on a suspended context, so
deferring init to a user gesture is unnecessary and
introduces race conditions.

## Key Conventions

- State management is local React state only (no external stores)
- AudioContext must be created/resumed on user gesture
- 12 track IDs: `ac bd sd ch oh cy ht mt lt rs cp cb`
  (`ac` is accent — hidden from UI, affects gain only)
- Patterns use 16-char binary strings per track
- Tailwind CSS v4 for styling
- TypeScript strict mode
