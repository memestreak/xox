# XOX

XOX is a 16-step drum sequencer web application, built with Next.js and the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

## Features

- **Precision Timing**: Implements a Look-Ahead Scheduler to ensure consistent playback even under heavy UI load.
- **16-Step Sequences**: Preconfigured patterns for rhythm creation.
- **Dynamic Kit Loading**: Switch between different drum kits (808, 909, etc.) on the fly.
- **Mixer**: Individual solo and mute controls per track with proper priority logic.
- **Real-time BPM Sync**: Adjust tempo smoothly during playback.
- **Visual Feedback**: Running light indicator and active step highlighting.

## Tech Stack

- **Framework**: [Next.js (App Router)](https://nextjs.org/)
- **Audio**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons & UI**: Custom SVG icons and a premium glassmorphic design.

## Architecture

The application is split into two main layers:

1.  **Audio Engine ([`AudioEngine.ts`](./src/app/AudioEngine.ts))**:
    - Manages the `AudioContext` lifecycle.
    - Decodes and caches audio samples.
    - Runs a high-priority scheduling loop that "looks ahead" in time to avoid audio dropouts.

2.  **UI Component ([`Sequencer.tsx`](./src/app/Sequencer.tsx))**:
    - Manages the React state for playback, mixing, and visuals.
    - Renders the responsive 16-step grid.
    - Synchronizes visual updates with audio triggers using `requestAnimationFrame`.

## Project Structure

- `/public/kits/`: Static .wav samples organized by drum kit.
- [`src/app/`](./src/app/README.md): Core application source code.
- [`src/app/data/`](./src/app/data/README.md): JSON configuration for kits and patterns.

## Local Development

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run the development server**:
    ```bash
    npm run dev
    ```

3.  **Open in browser**:
    Navigate to [http://localhost:3000](http://localhost:3000).
