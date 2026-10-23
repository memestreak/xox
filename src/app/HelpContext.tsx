"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import HelpModal from './HelpModal';
import { shouldIgnoreShortcut } from './keyboardUtils';

interface OpenOptions {
  /**
   * Opened by a mouse or touch click. Focus then goes
   * back to the opener on close without a focus ring.
   */
  viaPointer?: boolean;
}

interface HelpContextValue {
  isOpen: boolean;
  open: (options?: OpenOptions) => void;
  close: () => void;
  toggle: () => void;
}

const HelpContext = createContext<HelpContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

/**
 * Owns the Help dialog: its open state, the `?` key,
 * and the dialog itself. UI state only, not part of
 * SequencerConfig.
 */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // Bumped on each open so the dialog starts on its
  // first tab every time.
  const [openCount, setOpenCount] = useState(0);
  const isOpenRef = useRef(false);
  const [viaPointer, setViaPointer] = useState(false);

  const open = useCallback((options?: OpenOptions) => {
    if (isOpenRef.current) return;
    isOpenRef.current = true;
    setViaPointer(options?.viaPointer ?? false);
    setOpenCount((n) => n + 1);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isOpenRef.current) close();
    else open();
  }, [open, close]);

  // `?` opens and closes Help (listed in helpContent.ts).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isOpenRef.current) {
        e.preventDefault();
        close();
        return;
      }
      if (shouldIgnoreShortcut(e)) return;
      e.preventDefault();
      open();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <HelpContext value={value}>
      {children}
      {openCount > 0 && (
        <HelpModal
          key={openCount}
          isOpen={isOpen}
          onClose={close}
          blurOpenerOnClose={viaPointer}
        />
      )}
    </HelpContext>
  );
}

export function useHelp() {
  return useContext(HelpContext);
}
