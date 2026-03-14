# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED: Use
> superpowers:subagent-driven-development (if subagents
> available) or superpowers:executing-plans to implement
> this plan. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Make XOX fully usable on phones (375px+) and
tablets by adding responsive layout below 1024px.

**Architecture:** Single breakpoint at 1024px. Below it:
2x8 step grid, sticky header, inline track controls,
toggle mixer panel. Above it: desktop layout unchanged.

**Tech Stack:** Next.js 16, Tailwind CSS v4, React local
state

**Spec:**
`docs/superpowers/specs/2026-03-14-mobile-responsive-design.md`

---

## Chunk 1: Foundation

### Task 1: Viewport and Safe Area Setup

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add viewport export to layout.tsx**

Add the viewport export after the existing `metadata`
export in `src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

Note: import `Viewport` on the same line as `Metadata`.

- [ ] **Step 2: Add safe area utility to globals.css**

Append to `src/app/globals.css`:

```css
@supports (padding-top: env(safe-area-inset-top)) {
  .safe-area-top {
    padding-top: env(safe-area-inset-top);
  }
  .safe-area-x {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

- [ ] **Step 3: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "Add viewport config and safe area utils"
```

---

### Task 2: Responsive Outer Shell and Header

**Files:**
- Modify: `src/app/Sequencer.tsx`
- Modify: `src/app/TempoController.tsx`

This task makes the outer container and header responsive.
Desktop layout must remain pixel-identical at >= 1024px.

- [ ] **Step 1: Make outer container responsive**

In `src/app/Sequencer.tsx`, change the outermost div and
its child:

```tsx
{/* Before */}
<div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
  <div className="max-w-4xl mx-auto space-y-8">

{/* After */}
<div className="min-h-screen bg-neutral-950 text-neutral-100 p-3 lg:p-8 font-sans">
  <div className="max-w-none lg:max-w-4xl mx-auto space-y-4 lg:space-y-8">
```

- [ ] **Step 2: Replace header and controls with responsive sticky layout**

Replace the entire `<header>` element AND the controls
`<div>` (kit/pattern selectors) that follows it with a
single sticky container. On desktop, the header and
controls render separately (matching current layout). On
mobile, both are inside the sticky zone.

```tsx
{/* --- Sticky Header (mobile) / Static Header (desktop) --- */}
<header className="sticky top-0 z-20 bg-neutral-950 safe-area-top safe-area-x border-b border-neutral-800 pb-3 lg:pb-6 lg:static space-y-2 lg:space-y-0">
  {/* Row 1: Logo + BPM + Play */}
  <div className="flex justify-between items-center lg:items-end">
    <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
      XOX
    </h1>
    <div className="flex gap-2 lg:gap-4 items-center lg:items-end">
      <TempoController bpm={bpm} setBpm={setBpm} />
      <button
        onClick={handleTogglePlay}
        disabled={!isLoaded}
        className={`px-4 lg:px-8 py-2 rounded-full font-bold text-sm lg:text-base transition-all ${isPlaying
          ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
          : 'bg-orange-600 hover:bg-orange-700 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
          } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
      >
        {isPlaying ? 'STOP' : 'PLAY'}
      </button>
    </div>
  </div>
  {/* Row 2: Kit + Pattern (inside sticky zone) */}
  <div className="grid grid-cols-2 gap-2 lg:gap-4 pt-2 lg:pt-0">
    <div className="bg-neutral-900/50 p-2 lg:p-4 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
      <label className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 lg:mb-2 block font-bold">Drum Kit</label>
      <select
        value={currentKit.id}
        onChange={(e) => setCurrentKit(kitsData.kits.find(k => k.id === e.target.value)!)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-sm focus:outline-none hover:border-neutral-600 transition-colors"
      >
        {kitsData.kits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>
    </div>
    <div className="bg-neutral-900/50 p-2 lg:p-4 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
      <label className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 lg:mb-2 block font-bold">Pattern</label>
      <select
        value={currentPattern.id}
        onChange={(e) => setCurrentPattern(patternsData.patterns.find(p => p.id === e.target.value)!)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-sm focus:outline-none hover:border-neutral-600 transition-colors"
      >
        {patternsData.patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  </div>
</header>
```

This replaces BOTH the old `<header>` and the controls
`<div>` that followed it. The kit/pattern selectors are
now inside the sticky header zone on mobile, satisfying
the spec requirement that they are always accessible.

On desktop (`lg:`), the header is `static` and
`space-y-0` collapses the gap, so the visual output
matches the original layout.

- [ ] **Step 3: Make TempoController responsive**

In `src/app/TempoController.tsx`, make the BPM label
inline on mobile and reduce input width:

```tsx
{/* Before */}
<div className="flex flex-col">
  <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 font-bold">BPM</label>
  <input
    ...
    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-20 text-orange-500 font-bold focus:outline-none focus:border-orange-500 transition-colors"
  />
</div>

{/* After */}
<div className="flex items-center gap-1 lg:flex-col lg:items-stretch">
  <label className="text-[10px] uppercase tracking-widest text-neutral-500 lg:mb-1 font-bold">BPM</label>
  <input
    ...
    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-14 lg:w-20 text-orange-500 font-bold focus:outline-none focus:border-orange-500 transition-colors"
  />
</div>
```

On mobile: horizontal layout with label and input side by
side, narrower input (w-14). On desktop: unchanged
vertical layout.

- [ ] **Step 4: Verify at desktop and mobile widths**

Run: `npm run dev`
Open browser at localhost:3000. Test:
- At 1024px+: layout should look identical to before
- At 375px: sticky header with compact BPM/play and
  kit/pattern selectors all in the sticky zone

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: Zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/Sequencer.tsx src/app/TempoController.tsx
git commit -m "Add responsive header and outer shell"
```

---

## Chunk 2: Grid and Running Light

### Task 3: Responsive 2x8 Step Grid

**Files:**
- Modify: `src/app/Sequencer.tsx:226-280`

This task converts the 16-step grid to 2x8 on mobile while
keeping 1x16 on desktop. The track info sidebar (name,
M/S, knob) moves above the grid on mobile.

- [ ] **Step 1: Restructure track layout for mobile**

Replace the track rendering block (the `TRACKS.map` and
its content) inside the grid section. The key structural
change: on mobile, track info (name + M/S) goes above the
grid in a separate row, and the knob is hidden. On
desktop, the existing sidebar layout is preserved.

```tsx
{TRACKS.map(track => (
  <div key={track.id}>
    {/* Mobile: track name + M/S above grid */}
    <div className="flex items-center gap-2 mb-1 lg:hidden">
      <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
        {track.name}
      </span>
      <div className="flex gap-1 ml-auto">
        <button
          onClick={() => setTrackStates(prev => ({
            ...prev, [track.id]: { ...prev[track.id], isMuted: !prev[track.id].isMuted }
          }))}
          className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[8px] rounded font-bold border transition-all ${trackStates[track.id].isMuted
            ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500'
            }`}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={() => setTrackStates(prev => ({
            ...prev, [track.id]: { ...prev[track.id], isSolo: !prev[track.id].isSolo }
          }))}
          className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[8px] rounded font-bold border transition-all ${trackStates[track.id].isSolo
            ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500'
            }`}
          title="Solo"
        >
          S
        </button>
      </div>
    </div>

    <div className="flex gap-4 items-center">
      {/* Desktop: sidebar with name, M/S, knob */}
      <div className="hidden lg:flex w-48 items-center gap-2">
        <span className="w-16 truncate text-xs font-bold uppercase text-neutral-400 tracking-wider">
          {track.name}
        </span>
        <button
          onClick={() => setTrackStates(prev => ({
            ...prev, [track.id]: { ...prev[track.id], isMuted: !prev[track.id].isMuted }
          }))}
          className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] rounded-md font-bold border transition-all ${trackStates[track.id].isMuted
            ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600'
            }`}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={() => setTrackStates(prev => ({
            ...prev, [track.id]: { ...prev[track.id], isSolo: !prev[track.id].isSolo }
          }))}
          className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] rounded-md font-bold border transition-all ${trackStates[track.id].isSolo
            ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600'
            }`}
          title="Solo"
        >
          S
        </button>
        <Knob
          value={trackStates[track.id].gain}
          onChange={(v) => setTrackStates(prev => ({
            ...prev,
            [track.id]: { ...prev[track.id], gain: v }
          }))}
        />
      </div>

      {/* Step grid: 2x8 on mobile, 1x16 on desktop */}
      <div className="flex-1">
        {/* Desktop: 1x16 */}
        <div className="hidden lg:grid grid-cols-16 gap-1.5">
          {currentPattern.steps[track.id].split('').map((step, i) => (
            <div
              key={i}
              onClick={() => toggleStep(track.id, i)}
              className={`h-12 rounded-sm transition-all duration-100 cursor-pointer ${step === '1'
                ? (i === currentStep ? 'bg-orange-400 scale-105 shadow-[0_0_20px_rgba(251,146,60,0.8)] z-10' : 'bg-orange-600')
                : (i === currentStep ? 'bg-neutral-700' : 'bg-neutral-800/40 hover:bg-neutral-800')
                } ${i % 4 === 0 ? 'border-l-2 border-neutral-700' : ''}`}
            />
          ))}
        </div>
        {/* Mobile: 2x8 */}
        <div className="lg:hidden space-y-[3px]">
          {[0, 8].map(rowStart => (
            <div key={rowStart} className="grid grid-cols-8 gap-[3px]">
              {currentPattern.steps[track.id].slice(rowStart, rowStart + 8).split('').map((step, posInRow) => {
                const i = rowStart + posInRow;
                return (
                  <div
                    key={i}
                    onClick={() => toggleStep(track.id, i)}
                    className={`h-8 rounded-sm transition-all duration-100 cursor-pointer ${step === '1'
                      ? (i === currentStep ? 'bg-orange-400 scale-105 shadow-[0_0_20px_rgba(251,146,60,0.8)] z-10' : 'bg-orange-600')
                      : (i === currentStep ? 'bg-neutral-700' : 'bg-neutral-800/40 hover:bg-neutral-800')
                      } ${posInRow % 4 === 0 ? 'border-l-2 border-neutral-700' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
))}
```

Key details:
- Mobile M/S buttons: `min-w-[44px] min-h-[44px]` for
  WCAG-compliant touch targets
- `posInRow % 4 === 0` for beat-group borders in 2x8
- Step height `h-8` (32px) on mobile vs `h-12` on desktop
- `lg:hidden` / `hidden lg:flex` / `hidden lg:grid` to
  toggle between layouts
- `grid-cols-16` and `grid-cols-8` both work in Tailwind
  v4 out of the box (no custom utilities needed)

- [ ] **Step 2: Update grid section spacing**

Change the grid section container:

```tsx
{/* Before */}
<div className="space-y-4 bg-neutral-900/30 p-6 rounded-2xl border border-neutral-800/50">

{/* After */}
<div className="space-y-2 lg:space-y-4 bg-neutral-900/30 p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-neutral-800/50">
```

- [ ] **Step 3: Verify at mobile and desktop widths**

Run: `npm run dev`
- At 375px: each track shows name+M/S above a 2x8 grid,
  no volume knob visible, steps are tappable
- At 1024px+: unchanged 1x16 with sidebar

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/Sequencer.tsx
git commit -m "Add responsive 2x8 step grid for mobile"
```

---

### Task 4: Responsive Running Light

**Files:**
- Modify: `src/app/Sequencer.tsx:282-294`

- [ ] **Step 1: Update running light to 2x8 on mobile**

Replace the running light block:

```tsx
{/* Running Light (Visual Step Indicator) */}
<div className="flex gap-4 items-center pt-2">
  {/* Desktop spacer for sidebar alignment */}
  <div className="hidden lg:block w-48" />
  <div className="flex-1">
    {/* Desktop: 1x16 */}
    <div className="hidden lg:grid grid-cols-16 gap-1.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-100 ${i === currentStep ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-900'}`}
        />
      ))}
    </div>
    {/* Mobile: 2x8 */}
    <div className="lg:hidden space-y-[3px]">
      {[0, 8].map(rowStart => (
        <div key={rowStart} className="grid grid-cols-8 gap-[3px]">
          {Array.from({ length: 8 }).map((_, posInRow) => {
            const i = rowStart + posInRow;
            return (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-100 ${i === currentStep ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-900'}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify running light animates in 2x8**

Run: `npm run dev`
Start playback at 375px. The running light should animate
through the top row (steps 1-8) then the bottom row
(steps 9-16).

- [ ] **Step 3: Commit**

```bash
git add src/app/Sequencer.tsx
git commit -m "Add responsive 2x8 running light"
```

---

## Chunk 3: Mixer Panel

### Task 5: Mixer Panel with Volume Sliders

**Files:**
- Modify: `src/app/Sequencer.tsx`

This task adds the `showMixer` state and the mixer panel
that appears in place of the grid on mobile.

- [ ] **Step 1: Add showMixer state**

Add after the existing state declarations (around line
42):

```tsx
// --- Mobile Mixer Panel ---
const [showMixer, setShowMixer] = useState(false);
```

- [ ] **Step 2: Add mixer toggle button (mobile only)**

After the grid section's closing `</div>` (after the
running light, before the footer), add:

```tsx
{/* Mobile Mixer Toggle */}
<button
  onClick={() => setShowMixer(prev => !prev)}
  className="lg:hidden w-full bg-neutral-800 border border-neutral-700 rounded-lg py-3 text-[10px] uppercase tracking-widest font-bold text-neutral-400 transition-colors hover:border-neutral-600"
>
  {showMixer ? 'BACK TO SEQUENCER' : 'MIXER'}
</button>
```

Wait -- per spec, the mixer replaces the grid. So wrap
the grid section and the mixer in a conditional:

```tsx
{showMixer ? (
  /* Mixer Panel */
  ...
) : (
  /* Sequencer Grid Section (existing) */
  ...
)}
```

But the mixer should only show on mobile. On desktop,
always show the grid. So the logic is:

```tsx
{/* Mobile: toggle between grid and mixer */}
{/* Desktop: always show grid */}
```

The simplest approach: always render the grid section
with its existing `hidden`/`lg:` responsive classes. On
mobile, conditionally show grid OR mixer. On desktop,
always show grid.

- [ ] **Step 3: Implement the full conditional rendering**

Wrap the grid section in a conditional for mobile:

```tsx
{/* Desktop always sees grid. Mobile toggles. */}
<div className={showMixer ? 'hidden lg:block' : ''}>
  {/* --- Sequencer Grid Section --- */}
  <div className="space-y-2 lg:space-y-4 bg-neutral-900/30 p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-neutral-800/50">
    {/* ... existing track grid and running light ... */}
  </div>
</div>

{/* Mobile Mixer Panel */}
{showMixer && (
  <div className="lg:hidden space-y-2 bg-neutral-900/30 p-3 rounded-xl border border-neutral-800/50">
    {TRACKS.map(track => (
      <div key={track.id} className="flex items-center gap-2 bg-neutral-900 rounded-lg p-2 border border-neutral-800">
        <span className="w-12 text-[10px] font-bold uppercase text-neutral-400 tracking-wider truncate">
          {track.name}
        </span>
        <button
          onClick={() => setTrackStates(prev => ({
            ...prev, [track.id]: { ...prev[track.id], isMuted: !prev[track.id].isMuted }
          }))}
          className={`shrink-0 w-[26px] h-[22px] flex items-center justify-center text-[9px] rounded font-bold border transition-all ${trackStates[track.id].isMuted
            ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500'
            }`}
        >
          M
        </button>
        <button
          onClick={() => setTrackStates(prev => ({
            ...prev, [track.id]: { ...prev[track.id], isSolo: !prev[track.id].isSolo }
          }))}
          className={`shrink-0 w-[26px] h-[22px] flex items-center justify-center text-[9px] rounded font-bold border transition-all ${trackStates[track.id].isSolo
            ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500'
            }`}
        >
          S
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={trackStates[track.id].gain}
          onChange={(e) => setTrackStates(prev => ({
            ...prev,
            [track.id]: { ...prev[track.id], gain: Number(e.target.value) }
          }))}
          className="flex-1"
        />
      </div>
    ))}
  </div>
)}

{/* Mobile Mixer Toggle Button */}
<button
  onClick={() => setShowMixer(prev => !prev)}
  className={`lg:hidden w-full rounded-lg py-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${showMixer
    ? 'bg-orange-600 text-white'
    : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:border-neutral-600'
    }`}
>
  {showMixer ? 'BACK TO SEQUENCER' : 'MIXER'}
</button>
```

The toggle button styling changes based on state:
- Grid view: neutral "MIXER" button
- Mixer view: orange "BACK TO SEQUENCER" button

- [ ] **Step 4: Style the range input for dark theme**

The native `<input type="range">` needs dark-theme
styling. Add to `src/app/globals.css`:

```css
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  height: 44px;
}

input[type="range"]::-webkit-slider-runnable-track {
  height: 6px;
  background: #262626;
  border-radius: 3px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  margin-top: -5px;
}

input[type="range"]::-moz-range-track {
  height: 6px;
  background: #262626;
  border-radius: 3px;
  border: none;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  border: none;
}
```

The 44px height on the input ensures a large enough
touch target without affecting the visual track height.

- [ ] **Step 5: Verify mixer panel**

Run: `npm run dev`
At 375px:
- "MIXER" button visible below grid
- Tap it: grid hides, mixer panel appears with all 11
  tracks, each with M/S buttons and volume slider
- Button changes to orange "BACK TO SEQUENCER"
- Tap back: grid reappears
- Start playback, open mixer: audio continues, no
  visual glitches
At 1024px+:
- No mixer button visible
- Grid always shown with sidebar knobs

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: Zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/Sequencer.tsx src/app/globals.css
git commit -m "Add mobile mixer panel with volume sliders"
```

---

## Chunk 4: Final Polish and Verification

### Task 6: Footer and Final Checks

**Files:**
- Modify: `src/app/Sequencer.tsx:297-307`

- [ ] **Step 1: Make footer responsive**

```tsx
{/* Before */}
<footer className="text-center pt-8">

{/* After */}
<footer className="text-center pt-4 lg:pt-8">
```

- [ ] **Step 2: Full verification at all breakpoints**

Run: `npm run dev`

Test at **375px** (iPhone SE):
- [ ] Sticky header visible with XOX logo, BPM, play/stop
- [ ] Kit/pattern selectors in sticky header zone
- [ ] All 11 tracks visible via vertical scroll
- [ ] 2x8 step grid with tappable buttons
- [ ] Beat-group borders at positions 0, 4 in each row
- [ ] M/S buttons work per track
- [ ] Mixer panel opens and closes
- [ ] Volume sliders work in mixer
- [ ] Running light animates in 2x8 during playback
- [ ] Playback continues when mixer is open

Test at **768px** (iPad portrait):
- [ ] Same mobile layout as 375px

Test at **1024px** (desktop breakpoint):
- [ ] Desktop layout with sidebar, 1x16 grid, knobs
- [ ] No mixer button visible
- [ ] Layout identical to before this work

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Zero lint errors, successful static export.

- [ ] **Step 4: Commit**

```bash
git add src/app/Sequencer.tsx
git commit -m "Add responsive footer spacing"
```

- [ ] **Step 5: Shut down dev server**

Stop the `npm run dev` process started for testing.
