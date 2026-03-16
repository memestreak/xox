"use client";

import { SequencerProvider } from './SequencerContext';
import TransportControls from './TransportControls';
import StepGrid from './StepGrid';

/**
 * Inner shell that composes the major UI sections.
 */
function SequencerInner() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-3 lg:p-8 font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-orange-600 focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
      <div className="max-w-none lg:max-w-4xl mx-auto space-y-4 lg:space-y-8">
        <TransportControls />
        <StepGrid />

        <footer className="text-center pt-4 lg:pt-8">
          <a
            href="https://github.com/memestreak/xox"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-neutral-600 uppercase tracking-[0.2em] font-bold hover:text-orange-500 transition-colors"
          >
            Source Code
          </a>
        </footer>
      </div>
    </div>
  );
}

/**
 * Top-level Sequencer component. Wraps the UI in the
 * SequencerProvider that owns all state and audio logic.
 */
export default function Sequencer() {
  return (
    <SequencerProvider>
      <SequencerInner />
    </SequencerProvider>
  );
}
