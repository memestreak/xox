"use client";

import { useCallback, useRef, useState } from 'react';
import { audioEngine } from '../AudioEngine';
import { checkSampleFile, decodeErrorMessage } from '../sampleFiles';
import { TRACK_IDS } from '../types';
import type { TrackId } from '../types';

export type CustomSamples = Partial<Record<TrackId, File>>;

export interface UseCustomSamplesReturn {
  /** Original file per custom track (name and bytes). */
  customSamples: CustomSamples;
  /** Why the last load was refused, if it was. */
  sampleError: string | null;
  loadSample: (track: TrackId, file: File) => Promise<void>;
  resetSample: (track: TrackId) => void;
  resetAllSamples: () => void;
  dismissSampleError: () => void;
}

/**
 * Samples loaded from files onto tracks. Memory only,
 * independent of the kit (a kit change keeps them).
 *
 * Deliberately has no reset(): Reset (clearAll) keeps
 * custom samples, like the master volume. Only
 * resetSample and resetAllSamples clear them.
 */
export function useCustomSamples(): UseCustomSamplesReturn {
  const [customSamples, setCustomSamples] =
    useState<CustomSamples>({});
  const [sampleError, setSampleError] =
    useState<string | null>(null);

  // Bumped by every load and reset of a track. A decode
  // that finishes after its track's count moved on is
  // stale and dropped, so the latest request wins.
  const requestIdsRef = useRef<Partial<Record<TrackId, number>>>(
    {}
  );
  const bump = useCallback((track: TrackId): number => {
    const next = (requestIdsRef.current[track] ?? 0) + 1;
    requestIdsRef.current[track] = next;
    return next;
  }, []);

  const loadSample = useCallback(
    async (track: TrackId, file: File) => {
      const requestId = bump(track);
      const isCurrent = () =>
        requestIdsRef.current[track] === requestId;

      const problem = checkSampleFile(file);
      if (problem) {
        setSampleError(problem);
        return;
      }

      let buffer: AudioBuffer;
      try {
        buffer = await audioEngine.decodeSample(file);
      } catch {
        if (isCurrent()) {
          setSampleError(decodeErrorMessage(file.name));
        }
        return;
      }
      if (!isCurrent()) return;

      audioEngine.setCustomSample(track, buffer);
      setCustomSamples(prev => ({ ...prev, [track]: file }));
      setSampleError(null);
    },
    [bump]
  );

  const resetSample = useCallback((track: TrackId) => {
    bump(track);
    audioEngine.clearCustomSample(track);
    setCustomSamples(prev => {
      if (!(track in prev)) return prev;
      const next = { ...prev };
      delete next[track];
      return next;
    });
  }, [bump]);

  const resetAllSamples = useCallback(() => {
    for (const id of TRACK_IDS) bump(id);
    audioEngine.clearCustomSamples();
    setCustomSamples({});
  }, [bump]);

  const dismissSampleError = useCallback(() => {
    setSampleError(null);
  }, []);

  return {
    customSamples,
    sampleError,
    loadSample,
    resetSample,
    resetAllSamples,
    dismissSampleError,
  };
}
