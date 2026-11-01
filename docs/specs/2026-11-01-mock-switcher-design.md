# Mock switcher: Design

Status: shipped (2026-11-01). Ported from frets
([memestreak/frets#280](https://github.com/memestreak/frets/pull/280)).

## Why

When a UI change isn't fully specified, a branch offers two
to four options as mocks in the real app, so Jeremy judges
them with real patterns and real playback. Each option has
its own link (`?mock=b`), and a small card in the page
switches between them without editing the URL.

## Pieces

- `src/app/mocks/useMock.ts`: `useMock(mock)` declares a mock
  while the component is mounted and returns the chosen
  value. A mock is a module constant:

  ```ts
  const STEP_LOOK: Mock = {
    param: 'mock', label: 'Steps',
    options: [
      { value: 'a', label: 'a Flat' },   // default
      { value: 'b', label: 'b Raised' },
    ],
  };
  const look = useMock(STEP_LOOK);       // 'a' | 'b'
  ```

  The link picks the option; an unknown or missing value
  gives the first. Independent choices get their own
  parameter (`?mock=b&led=2`) so they combine. Never read
  the query string by hand.
- `src/app/mocks/MockSwitcher.tsx`: the card, mounted once by
  `Sequencer` (outside the error boundary, so a crashing
  option can still be switched away from). Bottom right,
  styled as an `ss-menu` with `ss-key` options; the chosen
  one is lit like a pressed category key. Pressing an option
  rewrites the link with `history.replaceState` (no reload,
  no new history entry, hash kept); Back and Forward are
  followed. The title folds it to one line naming the
  choices. It carries `data-chooser-area`, so pressing it
  doesn't close the pattern chooser.
- Shown only when asked for: the card appears only when the
  link names one of the declared mocks. Without them the
  page looks as it would ship.

## Links

- The branch preview is
  `https://<branch-slug>.xox-bm9.pages.dev` (the stable
  alias, which follows later pushes; see the Cloudflare
  Pages check run).
- One labelled link per option, e.g.
  `Mock: a Flat` → `…pages.dev/?mock=a`, and `Preview` for
  the branch's own behaviour with no mock parameter.
- A share-link hash still works after the query
  (`/?mock=b#<share link>`), so a mock link can open on a
  pattern that shows the change. The hash is removed after
  loading; the query stays.
- XOX is dark only, so no theme needs pinning.

## Mocks never merge

`src/__tests__/noMocksLeft.test.ts` fails while any source
file outside `src/app/mocks/` and the tests calls
`useMock(`. A branch carrying mocks stays red in CI by
design: open its PR as a draft and say "CI is red until you
pick". After the pick, delete every declaration and the
losing options' code, keeping only the chosen option.
