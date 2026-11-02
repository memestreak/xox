# URL-Serializable Sequencer Configuration

## Problem

XOX has no way to save or share sequencer configurations.
Users cannot bookmark a pattern or send a link to someone
that reproduces their exact setup (pattern, kit, tempo, mix).

## Solution

Introduce a canonical `SequencerConfig` type as the single
source of truth for all persistable state. Provide an Export
action (in a new settings popover) that encodes the config as
compressed JSON in a URL hash, copies the full URL to
clipboard, and updates the address bar. Loading a URL with a
hash restores the config. Inspired by Falstad's circuit
simulator.

## What Gets Serialized

```typescript
export interface TrackMixerState {
  gain: number;      // 0.0 - 1.0
  isMuted: boolean;
  isSolo: boolean;
}

export interface SequencerConfig {
  kitId: string;     // e.g., "808", "electro"
  bpm: number;       // 20-300
  steps: Record<TrackId, string>;  // 16-char binary strings
  mixer: Record<TrackId, TrackMixerState>;
}
```

| Field | Notes |
|-------|-------|
| kitId | String ID, not numeric index |
| bpm | Clamped 20-300 |
| steps | 12 tracks x 16 binary chars, always embedded |
| mixer | gain + mute + solo per track |

**Not serialized** (transient): `isPlaying`, `isLoaded`,
`showMixer`, `stepRef`.

**Not serialized** (config-adjacent, lives in ConfigContext):
`selectedPatternId` — tracks which preset was last loaded
for UI display purposes only.

## Encoding Format

Compressed JSON + Base64url:

1. `JSON.stringify(config)` (~800-1000 chars)
2. Deflate compress via `CompressionStream('deflate-raw')`
   (~200-300 bytes)
3. Base64url encode (~270-400 chars)
4. Store in URL hash: `https://xox.example.com/#eJy...`

**Compression pipeline pseudocode:**
```
// encode
const json = JSON.stringify(config);
const stream = new Blob([json]).stream()
  .pipeThrough(new CompressionStream('deflate-raw'));
const bytes = new Uint8Array(
  await new Response(stream).arrayBuffer()
);
return base64url(bytes);

// decode (reverse)
const bytes = base64urlDecode(hash);
const stream = new Blob([bytes]).stream()
  .pipeThrough(
    new DecompressionStream('deflate-raw')
  );
const json = await new Response(stream).text();
return JSON.parse(json);
```

**Why not custom binary?** Compressed JSON is self-describing,
trivially handles string kit IDs, is easy to debug (decode
any URL in the browser console), and is straightforward to
evolve. The URL length (~300-400 chars) is acceptable for
web sharing.

**Versioning:** Include a `version: 1` field in the JSON.
Future format changes bump the version. The decoder checks
the version and dispatches to the appropriate parser.

## Import / Export Flow

**Import (page load only — not a runtime action):**
1. App loads, reads `window.location.hash`
2. If hash present: decode, decompress, parse JSON
3. Apply config to state (replacing defaults)
4. Hash stays in URL (user can re-share by copying address
   bar)
5. On decode failure: silently fall back to default config

Import only happens at page load. It cannot race with active
playback since the sequencer starts stopped.

**Export (user-initiated):**
1. User clicks gear icon in transport bar
2. Settings popover appears with "Export" action
3. User clicks Export
4. Config is encoded to hash string
5. Full URL (`origin + path + #hash`) copied to clipboard
6. Browser URL hash updated via `history.replaceState()`
7. Brief "Copied!" feedback shown (~1.5s)

**Key behavior:** The URL does NOT auto-update during editing.
The hash only changes on initial import or explicit Export.
This means the URL can become stale after edits — that's
intentional. Export is the explicit "snapshot" action.

## Architecture Changes

### Before

`SequencerContext` owns 8 independent `useState` hooks.
Serializable state is spread across `bpm`, `currentKit`,
`currentPattern`, and `trackStates`.

### After

**Two contexts** for render isolation:

1. **ConfigContext** — owns `useState<SequencerConfig>` plus
   `selectedPatternId` (non-serialized UI state) and derived
   state (`currentKit`, `currentPattern`, `trackStates`,
   `bpm`). Changes when the user edits pattern, mixer, kit,
   or tempo.

2. **TransientContext** — owns `isPlaying`, `isLoaded`,
   `showMixer`, `stepRef`. Changes during playback and UI
   toggling, without triggering config consumers.

This prevents config mutations (step toggles, gain changes)
from re-rendering components that only care about playback
state, and vice versa.

### State Derivation

The `SequencerState` interface is unchanged — consumers see
the same API. Fields are derived from config internally:

- `currentKit`: looked up from `kitsData` by `config.kitId`
- `currentPattern`: `{ id: selectedPatternId, name: ...,
  steps: config.steps }`. The `selectedPatternId` tracks
  which preset was last loaded. Selecting a preset copies
  its steps into config and records its ID. Editing a step
  resets the ID to `'custom'`.
- `trackStates`: `Record<TrackId, TrackState>` — each entry
  merges `config.mixer[id]` (gain, mute, solo) with `id` and
  `name` from the existing `TRACKS` constant. The result is
  the same `TrackState` shape consumers already expect.
- `bpm`: directly from `config.bpm`

### Pattern Selector Behavior

The pattern dropdown currently binds to `currentPattern.id`.
After this refactor:
- Selecting a preset: copies steps into config, sets
  `selectedPatternId` to the preset's ID. Dropdown shows
  the preset name.
- Editing any step: `selectedPatternId` resets to `'custom'`.
  Dropdown shows "Custom".
- `selectedPatternId` is transient (not serialized). On
  import, the dropdown starts as "Custom" since the loaded
  steps may not match any preset.

### Audio Ref Sync

The audio callback (`handleStep`) reads pattern and
trackStates via refs to avoid stale closures. After the
refactor:

- `useMemo` derives `currentPattern` and `trackStates` from
  config (stable references when sub-state hasn't changed)
- `useEffect` syncs refs from the memoized values
- `handleStep` keeps empty dependency array `[]`

This belt-and-suspenders approach guarantees the audio
callback always reads fresh, stable data.

### New Module: `configCodec.ts`

Marked `'use client'`. Pure functions, no React dependencies:

- `encodeConfig(config: SequencerConfig): Promise<string>`
  — JSON stringify, deflate compress, base64url encode
- `decodeConfig(hash: string): Promise<SequencerConfig>`
  — reverse

Both are async (CompressionStream is stream-based).

Defensive decoding:
- Malformed base64: throws (caller catches, uses default)
- Decompression failure: throws
- Missing/invalid fields: fall back to defaults per field
- Unknown kit ID: fall back to "808"
- BPM out of range: clamp to 20-300

### Settings Popover

New gear icon in the transport bar. Clicking it opens a
dropdown/popover anchored to the icon. Initially contains:

- **Export** — encodes config, copies URL to clipboard,
  updates hash, shows "Copied!" feedback

Designed to hold future settings (the user has additional
features planned). Dismisses on click-outside.

## New Types

Add to `src/app/types.ts`:

```typescript
export const TRACK_IDS: readonly TrackId[] = [
  'ac','bd','sd','ch','oh','cy',
  'ht','mt','lt','rs','cp','cb',
] as const;

export interface TrackMixerState {
  gain: number;      // 0.0 - 1.0
  isMuted: boolean;
  isSolo: boolean;
}

export interface SequencerConfig {
  version: number;   // 1
  kitId: string;
  bpm: number;
  steps: Record<TrackId, string>;
  mixer: Record<TrackId, TrackMixerState>;
}
```

`TRACK_IDS` provides canonical ordering. `KIT_IDS` is no
longer needed — kit IDs are stored as strings.

## Files

| File | Change |
|------|--------|
| `src/app/types.ts` | Add `TRACK_IDS`, `TrackMixerState`, `SequencerConfig` |
| `src/app/configCodec.ts` | **New**: encode/decode with compressed JSON |
| `src/app/SequencerContext.tsx` | Split into ConfigContext + TransientContext |
| `src/app/SettingsPopover.tsx` | **New**: gear icon + popover with Export |
| `src/app/TransportControls.tsx` | Add gear icon / SettingsPopover; add conditional "Custom" option to pattern `<select>` when `currentPattern.id === 'custom'` |
| `CLAUDE.md` | Document config architecture |

## Edge Cases

- Corrupted/truncated hash: graceful fallback to default
- Unknown kit ID string: fall back to "808"
- BPM out of range: clamp to 20-300
- Missing config fields: merge with defaults per field
- CompressionStream unavailable (old browsers): show error
  or fall back to uncompressed JSON + base64url
- Clipboard API denied: show the URL in a selectable text
  field as fallback

## Verification

1. `npm run lint` — zero errors
2. `npm run build` — static export succeeds
3. Manual testing:
   a. Load with no hash — default state, clean URL
   b. Edit steps, change BPM, adjust mixer — URL unchanged
   c. Click gear icon, click Export — URL updates, clipboard
      has full URL, "Copied!" feedback shown
   d. Paste URL in new tab — config restored, pattern and
      mix match
   e. Select a preset in new tab — dropdown shows preset
      name; toggle one step — dropdown switches to "Custom"
   f. Load with corrupted hash — graceful fallback to default
   g. Test round-trip fidelity: export, import, export again
      — hashes should match
