# Known Bugs

## 1. No cleanup on component unmount

**Location:** `src/app/Sequencer.tsx`

There is no `useEffect` cleanup that stops the audio engine when the component unmounts. Since `audioEngine` is a module-level singleton, the `setTimeout`-based scheduler keeps running indefinitely after the component is removed from the DOM. This causes continued CPU usage and stale callbacks.

**Fix:** Add a cleanup effect:
```ts
useEffect(() => {
  return () => { audioEngine.stop(); };
}, []);
```

## 2. Visual step indicator highlights step 0 when stopped

**Location:** `src/app/Sequencer.tsx:124`

When the sequencer is stopped, `setCurrentStep(0)` is called. This makes step 0 appear highlighted in both the grid and the running light, even though nothing is playing.

**Fix:** Use a sentinel value like `-1` for "no active step" and only apply the highlight class when `currentStep >= 0` and `isPlaying` is true.
