# XOX Feature Roadmap

## Context

XOX is a 16-step web drum sequencer. The goal is to evolve
it into a deeper creative tool and live performance
instrument, inspired by Elektron drum machines.

**Guiding principle:** All playback-affecting features must
be represented in `SequencerConfig` and round-trip through
`configCodec` URL serialization.

## Phases

| Phase | Scope | Spec |
|-------|-------|------|
| 0 | Tap Tempo | [tap-tempo-design.md](2026-03-15-tap-tempo-design.md) |
| 1 | Pattern Engine: variable track lengths, Euclidean generator, swing | [pattern-engine-design.md](2026-03-15-pattern-engine-design.md) |
| 2 | Trig Conditions: full Elektron condition set | [trig-conditions-design.md](2026-03-15-trig-conditions-design.md) |
| 3 | Performance Mode + MIDI (out + clock/transport in) | [performance-midi-design.md](2026-03-15-performance-midi-design.md) |

Implementation starts with Phase 1 (variable track lengths).

## Data Model Version Summary

| Version | Added Fields | Phase |
|---------|-------------|-------|
| 1 (current) | kitId, bpm, steps, mixer | — |
| 2 | trackLengths, swing | 1 |
| 3 | trigConditions | 2 |
| 4 | (no new serialized fields) | 3 |

Backward compatibility: `validateConfig` fills missing
fields with defaults. v1 URLs work in a v4 app.

Forward compatibility: if a decoded config's `version`
exceeds the app's `CONFIG_VERSION`, show a warning toast
but still load what can be validated.

## Key Files

| File | Role |
|------|------|
| `src/app/types.ts` | TrackId, SequencerConfig, TrigCondition types |
| `src/app/SequencerContext.tsx` | State, actions, handleStep logic |
| `src/app/AudioEngine.ts` | Scheduler, sound playback |
| `src/app/configCodec.ts` | URL serialization/deserialization |
| `src/app/TrackRow.tsx` | Step grid row UI |
| `src/app/StepButton.tsx` | Individual step button (new file) |
| `src/app/TempoController.tsx` | BPM + tap tempo |
| `src/app/TransportControls.tsx` | Header transport bar |
| `src/app/StepGrid.tsx` | Grid container |
