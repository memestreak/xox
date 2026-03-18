"use client";

import { useRef } from 'react';
import { SequencerProvider } from './SequencerContext';
import TransportControls from './TransportControls';
import StepGrid from './StepGrid';

/**
 * Inner shell that composes the major UI sections.
 */
function SequencerInner() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950 text-neutral-100 font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-orange-600 focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
      <div className="max-w-none lg:max-w-4xl w-full mx-auto px-3 lg:px-8 pt-3 lg:pt-4 flex flex-col flex-1 min-h-0">
        <TransportControls />
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-3 lg:py-4 track-scroll-region"
        >
          <StepGrid scrollContainerRef={scrollRef} />
          <footer className="grid grid-cols-3 items-center pt-4 lg:pt-8">
            <div />
            <a
              href="https://github.com/memestreak/xox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-neutral-600 uppercase tracking-[0.2em] font-bold hover:text-orange-500 transition-colors text-center"
            >
              Source Code
            </a>
            <span className="text-[10px] text-neutral-600 uppercase tracking-[0.2em] font-bold font-mono text-right">
              Built at commit {process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev'}
            </span>
          </footer>
        </div>
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
