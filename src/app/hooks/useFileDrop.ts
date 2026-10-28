"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';

/** True when a drag carries files (not text, links or steps). */
export function dragHasFiles(e: { dataTransfer: DataTransfer | null }) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export interface FileDropHandlers {
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

export interface UseFileDropReturn {
  /** A file drag is over the element. */
  isOver: boolean;
  handlers: FileDropHandlers;
}

/**
 * HTML drag-and-drop of files onto one element. Only drags
 * carrying files react. `onFile` gets the first dropped
 * file. Enter/leave fire for every child the drag crosses,
 * so a depth count keeps `isOver` steady.
 */
export function useFileDrop(
  onFile: ((file: File) => void) | undefined
): UseFileDropReturn {
  const [isOver, setIsOver] = useState(false);
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setIsOver(false);
  }, []);

  // A drag that ends elsewhere (Esc, dropped outside the
  // window) never sends a leave to the last child.
  useEffect(() => {
    if (!isOver) return;
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);
    return () => {
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop', reset);
    };
  }, [isOver, reset]);

  const handlers = useMemo<FileDropHandlers>(() => ({
    onDragEnter: e => {
      if (!onFile || !dragHasFiles(e)) return;
      e.preventDefault();
      depthRef.current += 1;
      setIsOver(true);
    },
    onDragOver: e => {
      if (!onFile || !dragHasFiles(e)) return;
      // Marks the element as a drop target.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: e => {
      if (!onFile || !dragHasFiles(e)) return;
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setIsOver(false);
    },
    onDrop: e => {
      if (!onFile || !dragHasFiles(e)) return;
      e.preventDefault();
      reset();
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
  }), [onFile, reset]);

  return { isOver, handlers };
}

/**
 * Stops the browser from opening a file dropped anywhere
 * that isn't a drop target. Mounted once in Sequencer.
 */
export function usePreventFileNavigation() {
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => {
      if (dragHasFiles(e)) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);
}
