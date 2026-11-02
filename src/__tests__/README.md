# Tests (`src/__tests__/`)

Vitest + jsdom. How to run them and the testing rules are in
`CLAUDE.md`. A PR that adds a test area worth knowing about
updates this file, not `CLAUDE.md`.

Test areas (not exhaustive; most components have a
matching `<Component>.test.tsx`):
- `configCodec.test.ts` — round-trip, defensive decoding,
  field validation, version status
- `configCodec.golden.test.ts` — backward-compatible
  serialization (golden hashes, base64url safety)
- `types.test.ts` — TRACK_IDS ordering, cellKey/parseCellKey
- `SequencerContext.test.tsx` — state actions, derived
  state, pattern state machine, URL hash import, autosave,
  context memoization
- `computeStep.test.ts` — pure unit tests: swing,
  solo/mute, trig conditions, accent, parameter locks,
  cycle counts, pattern boundary signals
- `computeStep.integration.test.ts` — ref-threading
  wiring between SequencerContext and computeStep
- `audioEngine.test.ts` — timing math, step wrapping
- `trackUtils.test.ts` — computeEffectiveStep, formatPan
- `hooks/` — per-hook tests for useFillMode,
  usePatternMode, useTrackConfig, usePlayback
  (useSelection and useDragPaint tests sit at the top level)
- `helpers/` — `TestWrapper`, compression polyfill,
  `encodeRaw` for building arbitrary share links
- `constants.test.ts` — snapshot of every constant
- `HelpModal.test.tsx`, `HelpContext.test.tsx`,
  `helpContent.test.ts` — help dialog, `?` key, tabs
- `RetrigEditor.test.tsx`, `retrig.test.ts` — the retrig
  editor (on/off, rate, length, resets) and roll timing
