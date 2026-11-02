# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when
working with code in this repository.

## Skills

Always load the `python-development` skill when working
on files in `scripts/`.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build (static export to /out/)
npm run lint     # ESLint
npm run typecheck  # tsc --noEmit (app + tests)
npm test         # Vitest (unit + integration)
npm run test:watch  # Vitest in watch mode
npm run save-pattern  # Grid menu > Copy pattern → patterns.json
uv run --extra dev ruff check scripts  # Python lint (also ruff format --check)
uv run --extra dev mypy scripts        # Python types (strict)
uv run --extra dev pytest scripts      # Python tests
```

## Keeping this file stable

Every agent session loads this whole file, and PRs open at the
same time conflict when each one edits it. Keep it to commands,
rules and the architecture below. Don't edit CLAUDE.md in a
feature PR unless a rule, convention or command changes. What a
folder's files do is described in that folder's `README.md`;
update that instead:

- `src/app/README.md` — components, supporting files, playback,
  saving and sharing, preferences, parameter locks and retrig
- `src/app/hooks/README.md` — every hook
- `src/app/data/README.md` — kits and preset patterns
- `src/__tests__/README.md` — the test areas

## Docs

Design specs live in `docs/specs/`, named by date and topic.
Implementation plans live in `plans/`. Plans are historical:
they record how a change was planned at the time and may name
files that no longer exist.

## Architecture

XOX is a step drum sequencer (16 steps by default, up
to 64 per track). Next.js 16 App Router with
static export to Cloudflare Pages. All app code lives in
`src/app/`.

Three-layer design:

**AudioEngine (`src/app/AudioEngine.ts`)** — Singleton managing
the Web Audio API. Implements a look-ahead scheduler (25ms timer,
100ms lookahead window) for sample-accurate playback. Preloads
and caches kit samples as AudioBuffers. Core loop:
`scheduler()` → `advanceStep()` → `playSound()`.
`start()` reads `currentTime` once and passes it to the
first `scheduler()` call: steps in the past are dropped
as late, so a second read could silence step 0.

**computeStep (`src/app/computeStep.ts`)** — Pure function
for step computation. Takes `ComputeStepDeps` (track states,
config, cycle counts, fill state, pattern mode refs) and
returns `ComputeStepResult` (sounds to play, triggered tracks,
pattern transition signals). No side effects.

**SequencerContext (`src/app/SequencerContext.tsx`)** — React
context orchestrator composing four focused hooks. One context;
consumer API is `useSequencer()` returning
`{ state, actions, meta }`. Each part and the value are
memoized and every action is a stable callback, so the
value changes only when state or config actually changes
(every consumer still re-renders then). Keep new actions
stable (read refs, not state) so memoized children that
take them as props can skip renders.

**SequencerConfig (`src/app/types.ts`)** — Canonical type for
all persistable state (kit, BPM, steps, mixer). Single source
of truth for serializable configuration. `configCodec.ts`
turns it into share links and `configStorage.ts` autosaves it
(the work); preferences (`preferences.ts`) are per device and
never in `SequencerConfig` or share links. Details in
`src/app/README.md`.

All custom hooks live in `src/app/hooks/`. Every hook that
manages resettable state must expose a `reset()` method; the
orchestrator's `clearAll` composes them (see
`src/app/hooks/README.md` for the exceptions).

## Testing

Tests live in `src/__tests__/` and run via Vitest + jsdom.
CI (`.github/workflows/ci.yml`) runs lint, typecheck,
tests, and a production build on every PR and push to
`main`. Vitest does not typecheck, so run
`npm run typecheck` locally too.

Run `npm test` after any logic change. Run `npm test --
-u` to update snapshots after intentional format changes.

The test areas are listed in `src/__tests__/README.md`.

## Testing Gotchas

- **jsdom lacks `document.elementFromPoint`.** Tests that
  mock it must define the function first:
  ```ts
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
  ```

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

## Deployment

Deploys to Cloudflare Pages automatically on push to
`main`. To verify a deployment succeeded:

```bash
gh api repos/memestreak/xox/commits/<SHA>/check-runs \
  --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
```

Dashboard:
https://dash.cloudflare.com/24104e90cc6b2473822a3e91479614cb/pages/view/xox

## Key Conventions

- State management is local React state only (no external stores)
- AudioContext must be resumed on a user gesture (it is
  created eagerly; see iOS audio in `src/app/README.md`)
- 12 track IDs: `ac bd sd ch oh cy ht mt lt rs cp cb`
  (`ac` is accent — hidden from UI, affects gain only)
- Patterns use binary step strings per track; tracks can
  have different lengths (1-64), and the pattern length is
  the longest track
- Tailwind CSS v4 for styling. The "Silkscreen" theme
  lives in `globals.css`: color tokens (`bg-panel`,
  `text-ink`, `text-muted`, `bg-accent`, step colors
  `bg-step1`..`bg-step4`) and fonts (`font-display` =
  Barlow Condensed for labels/captions, `font-sans` =
  Barlow, `font-mono` = JetBrains Mono, `font-logo` =
  Orbitron). Shared classes: `ss-key` (raised button),
  `ss-lcd-select`/`ss-lcd-list` (LCD dropdown, see
  `LcdSelect.tsx`), `ss-label`, `ss-cap`,
  `ss-panel`, `ss-menu`, `ss-led`, `ss-scroll`. Use
  these instead of raw `neutral-*`/`orange-*` colors.
  Never show a browser-default scrollbar: every
  scrolling element gets `ss-scroll` (or
  `hide-scrollbar`)
- Step keys are colored by group of four (808 style):
  `stepColors.ts` maps step index to group
- Every dropdown is an `LcdSelect`, never a native
  `<select>`
- Help text lives in `helpContent.ts`: **update it
  whenever a shortcut or gesture changes**
- UI options waiting for a pick are mocks
  (`src/app/mocks/`, `docs/specs/2026-11-01-mock-switcher-design.md`);
  a mock branch opens as a draft and stays red in CI
  (`noMocksLeft.test.ts`) until only the chosen option is left
- TypeScript strict mode

## Multi-PR Workflow

When shipping multiple related PRs that touch overlapping
files, **chain branches sequentially** — each branching
from the previous — rather than all from `main`. Merge in
order. This avoids rebase/conflict churn after each merge.

If PRs are truly independent (no file overlap), branching
from `main` is fine.

## Accessibility

- `globals.css` disables animations under
  `@media (prefers-reduced-motion: reduce)`
- `eslint-plugin-jsx-a11y` enforces a11y rules at
  error severity
- New components must include `aria-label` on
  interactive elements and keyboard navigation
- Use `:focus-visible` for new focus styles
  (`useInputModality` hides rings after a click)

## CSS / Layout Rules

- **Conditional borders cause layout shift.** Never add
  `border` only in one branch of a ternary. Always apply
  `border` unconditionally and toggle the color instead
  (e.g., `border-transparent` when invisible). This
  prevents 1px reflow when state changes.
  The custom lint rule `xox/no-conditional-border`
  (`eslint-rules/`) enforces this.
- **Always-mounted collapsible panels** (e.g., the pattern
  drawer) use `max-h-0`/`max-h-[Npx]` with
  `overflow-hidden` for animation. Don't use `gap` on the
  parent flex container when a collapsed child is present
  — gap still applies to 0-height children. Use `mt-*` on
  the panel (only when open) and on the next sibling
  instead.
- **Let phones scroll.** The grid uses
  `touch-action: pan-y`; don't set `none` on large touch
  areas, or phones can't scroll past them.
