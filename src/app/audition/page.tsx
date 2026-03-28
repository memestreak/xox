"use client";

import { useCallback, useRef, useState } from 'react';
import { SequencerProvider, useSequencer } from '../SequencerContext';
import { TooltipProvider } from '../TooltipContext';
import { MidiProvider } from '../MidiContext';
import StepGrid from '../StepGrid';
import TempoController from '../TempoController';
import type { Pattern, TrackId } from '../types';
import { TRACK_IDS } from '../types';

interface StagingPattern extends Pattern {
  suggestedBpm: number;
}

function AuditionInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { state, actions, meta } = useSequencer();
  const { isPlaying, bpm, isLoaded } = state;
  const { togglePlay, setBpm, setPattern } = actions;

  const [patternName, setPatternName] = useState('');
  const [patternId, setPatternId] = useState('');
  const [patternCategory, setPatternCategory] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [waiting, setWaiting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>(
    null
  );

  const applyStagingPattern = useCallback(
    (staging: StagingPattern) => {
      const pattern: Pattern = {
        id: staging.id,
        name: staging.name,
        category: staging.category,
        steps: staging.steps,
        trigConditions: staging.trigConditions,
        parameterLocks: staging.parameterLocks,
      };

      setPatternId(staging.id);
      setPatternName(staging.name);
      setPatternCategory(staging.category ?? '');
      setBpm(staging.suggestedBpm);
      setPattern(pattern);
    },
    [setBpm, setPattern],
  );

  const fetchStaging = useCallback(async () => {
    const res = await fetch(
      `/patterns/staging.json?t=${Date.now()}`,
      { cache: 'no-store' },
    );
    return (await res.json()) as StagingPattern;
  }, []);

  const loadStagingPattern = useCallback(async () => {
    try {
      const staging = await fetchStaging();
      applyStagingPattern(staging);
    } catch {
      setToastMessage('Failed to load staging pattern');
      setTimeout(() => setToastMessage(''), 3000);
    }
  }, [applyStagingPattern, fetchStaging]);

  const waitForNextPattern = useCallback(
    (currentId: string) => {
      setWaiting(true);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      pollingRef.current = setInterval(async () => {
        try {
          const staging = await fetchStaging();
          if (staging.id !== currentId) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setWaiting(false);
            applyStagingPattern(staging);
          }
        } catch {
          // keep polling
        }
      }, 1500);
    },
    [applyStagingPattern, fetchStaging],
  );

  const hasLoadedRef = useRef<boolean | null>(null);
  if (hasLoadedRef.current == null) {
    hasLoadedRef.current = true;
    loadStagingPattern();
  }

  const handleApproveEdited = useCallback(async () => {
    const { config } = meta;
    const steps: Record<string, string> = {};
    for (const id of TRACK_IDS) {
      steps[id] = config.steps[id];
    }

    const pattern: Pattern = {
      id: state.currentPattern.id,
      name: patternName,
      category: patternCategory || undefined,
      steps: steps as Record<TrackId, string>,
    };

    const tc = config.trigConditions;
    if (tc && Object.keys(tc).length > 0) {
      pattern.trigConditions = tc;
    }

    const pl = config.parameterLocks;
    if (pl && Object.keys(pl).length > 0) {
      pattern.parameterLocks = pl;
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(pattern, null, 2)
      );
      setToastMessage('Copied to clipboard!');
      setTimeout(() => setToastMessage(''), 2000);
    } catch {
      setToastMessage('Clipboard write failed');
      setTimeout(() => setToastMessage(''), 3000);
    }
  }, [meta, state.currentPattern.id, patternName,
    patternCategory]);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950 text-neutral-100 font-sans">
      <div className="max-w-none lg:max-w-4xl w-full mx-auto px-3 lg:px-8 pt-3 lg:pt-4 flex flex-col flex-1 min-h-0">
        {/* Header: pattern info */}
        <div className="border-b border-neutral-800 pb-3 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                XOX Audition
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                <span className="text-neutral-100 font-medium">
                  {patternName}
                </span>
                {patternCategory && (
                  <span className="ml-2 text-neutral-500">
                    {patternCategory}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <TempoController bpm={bpm} setBpm={setBpm} />
              <button
                onClick={togglePlay}
                disabled={!isLoaded}
                className={`w-20 py-2 rounded-full font-bold text-sm text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                  isPlaying
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isPlaying ? 'STOP' : 'PLAY'}
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-3"
        >
          <StepGrid
            scrollContainerRef={scrollRef}
            pageOffset={0}
            autoFollow={false}
            setPage={() => {}}
          />
        </div>

        {/* Action bar */}
        <div className="border-t border-neutral-800 py-3 flex gap-3 items-center">
          <button
            onClick={() => {
              setToastMessage(
                `Approved: ${patternName}`
              );
              setTimeout(() => setToastMessage(''), 2000);
              waitForNextPattern(patternId);
            }}
            disabled={waiting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => {
              setToastMessage(
                `Rejected: ${patternName}`
              );
              setTimeout(() => setToastMessage(''), 2000);
              waitForNextPattern(patternId);
            }}
            disabled={waiting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={handleApproveEdited}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-sm transition-colors"
          >
            Approve Edited
          </button>
          <button
            onClick={loadStagingPattern}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg font-bold text-sm transition-colors"
          >
            Reload
          </button>
          {waiting && (
            <span className="text-sm text-yellow-400 ml-2 animate-pulse">
              Waiting for next pattern...
            </span>
          )}
          {toastMessage && !waiting && (
            <span className="text-sm text-green-400 ml-2">
              {toastMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditionPage() {
  return (
    <SequencerProvider>
      <MidiProvider>
        <TooltipProvider>
          <AuditionInner />
        </TooltipProvider>
      </MidiProvider>
    </SequencerProvider>
  );
}
