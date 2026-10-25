# Data Directory (`src/app/data`)

This directory contains static configuration for the sequencer.

## Files

- [`kits.json`](./kits.json): Defines the available drum kits. Each kit specifies a display name and a folder path relative to `/public/kits/`.
- [`patterns.json`](./patterns.json): Defines the available 16-step patterns. Each pattern contains a sequence of 0s (no trigger) and 1s (trigger) for each track.
  A pattern may also set track volume and pan with an optional `mixer` object. Values run from 0 to 1 (pan 0.5 is center). Any track or field left out gets full volume and center pan when the preset loads:

  ```json
  "mixer": {
    "ch": { "gain": 0.7, "pan": 0.35 },
    "oh": { "pan": 0.65 }
  }
  ```

## Data Schemas

Reference the [`types.ts`](../types.ts) file for the TypeScript interfaces corresponding to these JSON structures (`Kit` and `Pattern`).
