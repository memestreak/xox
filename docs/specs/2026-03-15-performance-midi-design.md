# Phase 3: Performance Mode + MIDI

Part of the [XOX Feature Roadmap](2026-03-15-feature-roadmap-design.md).

## Context

XOX's current UI is optimized for pattern programming.
This phase adds a live performance view with mute groups,
pattern chaining, queued changes, and a fill button, plus
MIDI out and clock/transport sync.

---

## 3a. Performance View

A dedicated view (toggled from main sequencer) focused
on live control.

### View Switching

Switching between sequencer and performance view is
purely visual. **All transient state is preserved:**
playback continues, cycle counters maintain position,
queued changes remain staged, fill state persists. Like
switching tabs — no interruption.

### Layout

```
+-----------------------------------+
| Transport (BPM, Play, Kit)        |
+-----------------+-----------------+
|  Mute Pads      |  Mix Faders     |
|  [BD] [SD]      |  BD ====--      |
|  [CH] [OH]      |  SD ======-     |
|  [CY] [HT]      |  CH ========   |
|  [MT] [LT]      |  ...            |
|  [RS] [CP]      |                 |
|  [CB]           |                 |
+-----------------+-----------------+
|  Patterns: [1][2][3]...[25]       |
|  [FILL]  [QUEUE]                  |
+-----------------------------------+
```

### Mute Pads

- Large, touch-friendly buttons, one per visible track
- Tap = immediate mute toggle
- With QUEUE modifier: stage the change (blinking state)
- All staged changes apply on next loop boundary
  (globalStep wraps to 0)

### Queued Changes

```typescript
// Transient state (refs)
queuedMutesRef: Record<TrackId, boolean | null>
queuedSolosRef: Record<TrackId, boolean | null>
queuedPatternIdRef: string | null
```

**Apply mechanism:** Queued state is stored in refs (not
React state). Inside `handleStep`, when
`globalStep === 0`, read the queued refs and apply
mute/solo changes directly in the audibility logic
*before* playing sounds. This eliminates the rAF timing
gap — audio is immediate. React state catches up on the
next render via a `loopBoundaryRef` flag that the rAF
loop observes.

Apply order:
1. Apply queued pattern change
2. Apply queued mute/solo changes
3. Reset cycle counters (per-track: only tracks that
   actually changed)
4. Clear all queued state

Queue modifier: toggle button ("QUEUE") or hold Shift.

### Pattern Chaining

- Row of pattern buttons from patterns.json (presets
  only for now; user pattern saving is a future feature)
- Tap = queue pattern (blinking), fires on next loop
- If QUEUE is off, tap = immediate pattern change
- URLs control a single pattern only

### Fill Button

- **Dual mode:** tap = latch on/off; hold = momentary
  (active while held, release deactivates)
- While active, FILL trig conditions fire, !FILL
  conditions suppress
- Keyboard shortcut
- Visual: distinct color when latched vs momentary
  (e.g., solid vs pulsing)

### Mix Faders

- Horizontal gain sliders per track, larger than current
  knobs
- Uses existing `setGain` action

---

## 3b. Tap Tempo

See [Phase 0: Tap Tempo](2026-03-15-tap-tempo-design.md).
Fits naturally in performance mode transport controls.

---

## 3c. MIDI (Web MIDI API)

### Scope

- **MIDI Out:** Note triggers to external gear
- **MIDI In:** Clock and transport only (no note input,
  no recording)

### MIDI Out

- When a step fires, optionally send a short MIDI note
  trigger (fixed duration, ~10ms or one 16th-note)
- Per-track config: channel (1-16), note number (0-127),
  velocity derived from gain
- Stored in localStorage (not URL — device-specific)
- No note-off tracking needed beyond a short timeout

### MIDI Clock In

- Receive 24 PPQN MIDI clock pulses
- Derive BPM from rolling average of pulse intervals
  (smoothed display)
- When slaved, internal scheduler syncs to external
  clock
- Display shows smoothed BPM value (not "EXT")

### MIDI Transport In

- Respond to MIDI Start, Stop, Continue messages
- Start = begin playback from step 0
- Stop = stop playback
- Continue = resume from current step

### Files Affected

- New: `src/app/MidiEngine.ts` (Web MIDI API wrapper)
- New: `src/app/MidiSettings.tsx` (config UI)
- Modified: `handleStep` in SequencerContext (MIDI out)
- MIDI config in localStorage, not SequencerConfig

---

## Verification

1. Toggle mute pads -> tracks mute/unmute immediately
2. Enable QUEUE, toggle 3 mute pads, wait for loop
   boundary -> all 3 changes apply simultaneously at
   step 0 with no audible delay
3. Queue a pattern change -> new pattern starts on next
   loop boundary
4. Tap FILL button -> latches on; tap again -> off
5. Hold FILL button -> active while held, deactivates
   on release (overrides latch state)
6. Switch to sequencer view mid-playback -> switch back
   -> all state preserved (queued changes, cycle
   counters, fill)
7. Cycle counters: queue hi-hat mute while kick has 1:4
   condition at cycle 3 -> kick's counter continues,
   only hi-hat's resets
8. Connect MIDI device -> notes trigger from XOX
   patterns with short duration
9. MIDI clock in -> XOX follows external tempo (smoothed
   BPM display)
10. MIDI Start/Stop -> XOX starts/stops playback
11. `npm test` passes, `npm run lint` passes
