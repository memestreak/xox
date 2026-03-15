# XOX Testing Plan

What to test, why, and what each test protects against —
informed by the URL-serializable config implementation
session where several issues were caught only through
manual browser testing.

## Priority 1: configCodec (pure functions, highest ROI)

The codec is the backbone of URL sharing. It's pure,
isolated, and has the most edge cases. Every bug here
silently corrupts shared URLs.

### Round-trip fidelity

- Encode then decode returns identical config
- Test with default config, modified patterns, mixed
  mixer states, edge BPM values
- **Why:** During implementation, this was the first thing
  we tested manually. An automated round-trip test would
  have given immediate confidence.

### Defensive decoding

- Corrupted base64 string → falls back to default config
- Valid base64 but invalid JSON → falls back
- Valid JSON but wrong shape (missing fields, extra fields,
  wrong types) → merges with defaults per field
- `null`, `undefined`, empty string → handled gracefully
- **Why:** We manually tested `#CORRUPTED_HASH` in the
  browser. This is trivially automatable.

### Field-level validation

- `kitId`: unknown string → falls back to "808"
- `bpm`: below 20 → clamped to 20; above 300 → clamped;
  NaN/Infinity → default; float → rounded
- `steps`: wrong length string → fallback; non-binary
  chars → fallback; missing tracks → filled from default
- `mixer.gain`: negative → clamped to 0; above 1 → clamped;
  NaN → default
- `mixer.isMuted`/`isSolo`: non-boolean → default
- **Why:** The validate functions have many branches. Unit
  tests here prevent silent data corruption.

### Base64url encoding

- Output contains no `+`, `/`, or `=` characters
- Output is deterministic (same input → same output)
- **Why:** Non-URL-safe chars in the hash would break
  when pasted into browsers or messaging apps.

## Priority 2: SequencerContext state logic

The context manages all app state. Bugs here affect every
component. These tests need React testing library with a
test wrapper.

### Derived state correctness

- `currentKit` lookup: config.kitId "808" → kit object
  with correct name/folder; unknown ID → fallback to first
  kit
- `currentPattern`: steps come from config.steps; id/name
  come from selectedPatternId
- `trackStates`: merges config.mixer with TRACK_NAMES;
  produces full TrackState shape (id, name, gain, isMuted,
  isSolo)
- **Why:** Derived state is computed via useMemo. If the
  memo dependencies are wrong, consumers get stale data.
  This was a concern during the spec review (reviewer
  flagged that TrackState shape could break).

### Action isolation

- `setBpm(150)` → only config.bpm changes
- `toggleStep('bd', 0)` → only that track/step flips;
  also resets selectedPatternId to 'custom'
- `setPattern(preset)` → copies steps into config, sets
  selectedPatternId to preset.id
- `toggleMute`/`toggleSolo`/`setGain` → only affect the
  targeted track in config.mixer
- `setKit(kit)` → only config.kitId changes
- **Why:** With a single config object, a bug in one
  action's spread could clobber unrelated state. This was
  a risk identified during the context refactor.

### Pattern selector state machine

- Load preset → selectedPatternId = preset.id
- Edit a step → selectedPatternId = 'custom'
- Load another preset → selectedPatternId = new preset.id
- Import from URL → selectedPatternId = 'custom'
- **Why:** The pattern dropdown binding was flagged as a
  breaking change during spec review. The "Custom" option
  only appears conditionally. This state machine is the
  most likely regression point.

### URL hash import

- Mount with valid hash → config matches decoded hash
- Mount with corrupted hash → config is default
- Mount with no hash → config is default
- **Why:** The async nature of decodeConfig (uses
  CompressionStream) means there's a timing window where
  the app renders defaults before the import completes.
  We saw this during Playwright testing.

## Priority 3: Audio engine timing

These tests need Web Audio API mocks but protect the core
user experience — accurate playback.

### Solo/mute priority logic

- No solos, no mutes → all tracks audible
- One track soloed → only that track plays
- Multiple tracks soloed → all soloed tracks play
- One track muted, no solos → that track silent
- One track muted AND soloed → it plays (solo wins)
- **Why:** This logic lives in handleStep and is easy to
  get wrong. It's critical to the musical output.

### Accent gain

- Accented step → gain multiplied by 1.5
- Non-accented step → gain unchanged
- Accent + cubic gain curve → correct combined value
- **Why:** The accent track is hidden from the UI, making
  gain bugs hard to notice visually.

### BPM timing math

- `secondsPerBeat = 60 / bpm`
- 16th note interval = `secondsPerBeat * 0.25`
- Step advancement wraps at 16
- **Why:** Timing precision is the difference between a
  usable drum machine and a toy.

## Priority 4: UI components

Lower priority because most UI behavior is already
exercised by the above tests indirectly.

### SettingsPopover

- Click gear → popover opens
- Click outside → popover closes
- Export → clipboard receives full URL with hash
- Export → browser URL hash updates
- Export → "Copied!" feedback appears, clears after ~1.5s
- Export failure → "Failed" feedback
- **Why:** The export flow involves async compression +
  clipboard + history API. Any step failing silently would
  make sharing appear to work but produce broken URLs.

### TransportControls pattern dropdown

- When selectedPatternId is 'custom' → "Custom" option
  appears in dropdown and is selected
- When selectedPatternId matches a preset → that preset is
  selected, no "Custom" option shown
- Selecting a preset from dropdown → calls setPattern
- **Why:** The conditional "Custom" option was a late
  addition caught during spec review. It's the kind of
  thing that regresses when the dropdown is refactored.

## What's brittle and worth protecting

These are areas where small changes can cause subtle
breakage:

1. **Config serialization format.** Any change to
   SequencerConfig's shape must remain backward-compatible
   with existing encoded URLs. A round-trip test suite is
   the best guard.

2. **TRACK_IDS ordering.** The constant is declared
   append-only. If someone reorders it, serialized mixer
   data maps to the wrong tracks. A snapshot test of the
   constant's value would catch this.

3. **Ref sync for audio callback.** The handleStep callback
   uses `[]` dependencies and reads from refs synced via
   useEffect. If someone adds a dependency or changes the
   ref sync, audio playback breaks subtly (stale data or
   unnecessary re-creation). This is hard to unit test but
   important to document as a known fragile point.

4. **useMemo dependency arrays.** The derived state
   (currentKit, currentPattern, trackStates) depends on
   specific config sub-objects. Wrong dependencies cause
   either stale data or excessive re-renders. Testing
   derived state correctness after actions catches this.

5. **CompressionStream format string.** The codec uses
   `'deflate-raw'`. If changed to `'deflate'` or `'gzip'`,
   all existing URLs break silently. A golden-file test
   (known input → known output) would catch this.
