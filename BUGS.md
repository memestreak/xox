# Known Bugs

## 1. Visual step indicator highlights step 0 when stopped

**Location:** `src/app/Sequencer.tsx:124`

When the sequencer is stopped, `setCurrentStep(0)` is called. This makes step 0 appear highlighted in both the grid and the running light, even though nothing is playing.

**Fix:** Use a sentinel value like `-1` for "no active step" and only apply the highlight class when `currentStep >= 0` and `isPlaying` is true.
