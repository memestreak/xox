# Application Root (`src/app`)

This directory contains the main application logic and UI components for the XOX-16 Playback Engine.

## Key Files

- [`AudioEngine.ts`](./AudioEngine.ts): The "brain" of the application. It handles the Web Audio API context, sample preloading, and high-precision timing using a Look-Ahead Scheduler.
- [`Sequencer.tsx`](./Sequencer.tsx): The primary React component. It manages the UI state (BPM, Kit, Pattern, Step visualization) and handles the Solo/Mute logic before triggering sounds via the `AudioEngine`.
- [`types.ts`](./types.ts): Shared TypeScript interfaces and types used throughout the app.
- [`globals.css`](./globals.css): Global Tailwind CSS styles and custom font configurations.
- [`layout.tsx`](./layout.tsx) & [`page.tsx`](./page.tsx): Next.js App Router entry points.
