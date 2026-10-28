"use client";

import { useCallback, useRef, useState } from 'react';
import { audioEngine } from '../AudioEngine';
import { checkSampleFile, decodeErrorMessage } from '../sampleFiles';
import { TRACK_IDS } from '../types';
import type { TrackId } from '../types';

export type CustomSamples = Partial<Record<TrackId, File>>;
/** Custom tracks switched back to the kit sample. */
export type DisabledSamples = Partial<Record<TrackId, true>>;

export interface UseCustomSamplesReturn {
  /** Original file per custom track (name and bytes). */
  customSamples: CustomSamples;
  /** Custom tracks that play the kit sample for now. */
  disabledSamples: DisabledSamples;
  /** Why the last load was refused, if it was. */
  sampleError: string | null;
  loadSample: (track: TrackId, file: File) => Promise<void>;
  resetSample: (track: TrackId) => void;
  /** Switch a track between its custom and kit sample. */
  toggleSample: (track: TrackId) => void;
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
 *
 * toggleSample switches a track to the kit sample and
 * back without forgetting the file: the decoded buffer
 * stays here, so turning it back on needs no decode.
 */
export function useCustomSamples(): UseCustomSamplesReturn {
  const [customSamples, setCustomSamples] =
    useState<CustomSamples>({});
  const [disabledSamples, setDisabledSamples] =
    useState<DisabledSamples>({});
  const [sampleError, setSampleError] =
    useState<string | null>(null);

  // Decoded buffer per custom track, on or off.
  const buffersRef = useRef<
    Partial<Record<TrackId, AudioBuffer>>
  >({});
  // Mirrors disabledSamples so toggleSample can read it
  // without a state updater that touches the engine.
  const disabledRef = useRef<DisabledSamples>({});
  const setDisabled = useCallback(
    (track: TrackId, off: boolean) => {
      if (Boolean(disabledRef.current[track]) === off) return;
      const next = { ...disabledRef.current };
      if (off) next[track] = true;
      else delete next[track];
      disabledRef.current = next;
      setDisabledSamples(next);
    },
    []
  );

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

      buffersRef.current[track] = buffer;
      audioEngine.setCustomSample(track, buffer);
      setCustomSamples(prev => ({ ...prev, [track]: file }));
      setDisabled(track, false);
      setSampleError(null);
    },
    [bump, setDisabled]
  );

  const resetSample = useCallback((track: TrackId) => {
    bump(track);
    delete buffersRef.current[track];
    audioEngine.clearCustomSample(track);
    setCustomSamples(prev => {
      if (!(track in prev)) return prev;
      const next = { ...prev };
      delete next[track];
      return next;
    });
    setDisabled(track, false);
  }, [bump, setDisabled]);

  const resetAllSamples = useCallback(() => {
    for (const id of TRACK_IDS) bump(id);
    buffersRef.current = {};
    audioEngine.clearCustomSamples();
    setCustomSamples({});
    disabledRef.current = {};
    setDisabledSamples({});
  }, [bump]);

  const toggleSample = useCallback((track: TrackId) => {
    const buffer = buffersRef.current[track];
    if (!buffer) return;
    if (disabledRef.current[track]) {
      audioEngine.setCustomSample(track, buffer);
      setDisabled(track, false);
    } else {
      audioEngine.clearCustomSample(track);
      setDisabled(track, true);
    }
  }, [setDisabled]);

  const dismissSampleError = useCallback(() => {
    setSampleError(null);
  }, []);

  return {
    customSamples,
    disabledSamples,
    sampleError,
    loadSample,
    resetSample,
    toggleSample,
    resetAllSamples,
    dismissSampleError,
  };
}
