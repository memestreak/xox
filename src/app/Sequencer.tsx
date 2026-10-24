"use client";

import {
  useMemo, useRef, useState,
} from 'react';
import { SequencerProvider, useSequencer }
  from './SequencerContext';
import { TooltipProvider } from './TooltipContext';
import { HelpProvider } from './HelpContext';
import { MidiProvider } from './MidiContext';
import TransportControls from './TransportControls';
import StepGrid from './StepGrid';
import ErrorBoundary from './ErrorBoundary';
import StatusBanner from './StatusBanner';
import type { PageNav } from './PageIndicator';
import { getPatternLength } from './types';
import PatternPicker from './PatternPicker';
import patternsData from './data/patterns.json';
import { getCategorizedPatterns } from './patternUtils';
import { useBlurOnEscape } from './hooks/useBlurOnEscape';
import type { Pattern } from './types';

const categories = getCategorizedPatterns(
  patternsData.patterns as Pattern[]
);

function SequencerInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { state, actions, meta } = useSequencer();
  const { selectedPatternId } = state;
  const { setPattern } = actions;
  const patternLength = getPatternLength(meta.config.tracks);

  const [currentPage, setCurrentPage] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);

  const pageCount = Math.ceil(patternLength / 16);
  const clampedPage = Math.min(
    currentPage, pageCount - 1
  );
  const pageOffset = clampedPage * 16;

  // Memoized so the memoized header can skip renders.
  const page = useMemo<PageNav>(() => ({
    currentPage: clampedPage,
    pageCount,
    autoFollow,
    setPage: setCurrentPage,
    setAutoFollow,
  }), [clampedPage, pageCount, autoFollow]);

  const liveMessage = state.isPlaying
    ? `Playing at ${state.bpm} BPM`
    : 'Stopped';
  // Read out latch changes, including ones made with a
  // shortcut (the latch buttons' aria-pressed only
  // speaks when they have focus).
  const latchMessage =
    `Fill ${state.isFillLatched ? 'latched' : 'not latched'}.`
    + ` Temp ${state.isTempLatched ? 'latched' : 'not latched'}.`;

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-ground text-ink font-sans bg-[radial-gradient(1200px_500px_at_50%_-10%,#1f1d1a_0%,transparent_60%)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-accent focus:text-[#1a0d05] focus:rounded"
      >
        Skip to main content
      </a>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMessage}
      </div>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {latchMessage}
      </div>
      <div className="max-w-none lg:max-w-5xl w-full mx-auto px-3 lg:px-8 pt-3 lg:pt-6 flex flex-col flex-1 min-h-0">
        <PatternPicker
          categories={categories}
          selectedPatternId={selectedPatternId}
          onSelect={setPattern}
        >
          {({ trigger, drawer }) => (
            <>
              <TransportControls
                page={page}
                patternTrigger={trigger}
              />
              {drawer}
            </>
          )}
        </PatternPicker>
        <StatusBanner
          message={state.loadError ?? state.importNotice}
          onDismiss={
            state.loadError
              ? actions.dismissError
              : actions.dismissImportNotice
          }
        />
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto mt-3 lg:mt-4 pb-3 lg:pb-4 track-scroll-region"
        >
          <StepGrid
            scrollContainerRef={scrollRef}
            pageOffset={pageOffset}
            autoFollow={autoFollow}
            setPage={setCurrentPage}
          />
          <footer className="grid grid-cols-3 items-center pt-4 lg:pt-8">
            <div />
            <a
              href="https://github.com/memestreak/xox"
              target="_blank"
              rel="noopener noreferrer"
              className="ss-label text-faint hover:text-accent transition-colors text-center"
            >
              Source Code
            </a>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint text-right">
              Built at commit{' '}
              {process.env.NEXT_PUBLIC_COMMIT_SHA ? (
                <a
                  href={`https://github.com/memestreak/xox/commit/${process.env.NEXT_PUBLIC_COMMIT_SHA}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View commit ${process.env.NEXT_PUBLIC_COMMIT_HASH} on GitHub`}
                  className="underline decoration-dotted underline-offset-2 hover:text-accent transition-colors"
                >
                  {process.env.NEXT_PUBLIC_COMMIT_HASH}
                </a>
              ) : (
                process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev'
              )}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default function Sequencer() {
  // No lingering focus ring after a click, then Esc.
  useBlurOnEscape();

  return (
    <ErrorBoundary>
      <SequencerProvider>
        <MidiProvider>
          <TooltipProvider>
            <HelpProvider>
              <SequencerInner />
            </HelpProvider>
          </TooltipProvider>
        </MidiProvider>
      </SequencerProvider>
    </ErrorBoundary>
  );
}
