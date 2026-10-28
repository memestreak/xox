"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useSequencer } from './SequencerContext';
import { encodeConfig } from './configCodec';
import { FEEDBACK_TIMEOUT_MS } from './constants';
import Tooltip from './Tooltip';
import SettingsModal from './SettingsModal';
import ExportKitDialog from './ExportKitDialog';
import { useHelp } from './HelpContext';

/**
 * Gear icon button with a dropdown popover for settings.
 *
 * Contains an Export action that encodes the current config
 * as a URL hash, copies the full URL to clipboard, and
 * updates the address bar.
 */
export default function SettingsPopover() {
  const { state, meta } = useSequencer();
  const help = useHelp();
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportKey, setExportKey] = useState(0);
  const hasCustomSamples =
    Object.keys(state.customSamples).length > 0;
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Dismiss on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(
          e.target as Node
        ) &&
        buttonRef.current &&
        !buttonRef.current.contains(
          e.target as Node
        )
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener(
      'mousedown', handleClick
    );
    return () =>
      document.removeEventListener(
        'mousedown', handleClick
      );
  }, [isOpen]);

  // Dismiss on Escape. If focus was in the menu, put it
  // back on the gear so keyboard users don't lose it.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const focusInMenu = popoverRef.current?.contains(
        document.activeElement
      );
      setIsOpen(false);
      if (focusInMenu) buttonRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () =>
      document.removeEventListener(
        'keydown', handleKeyDown
      );
  }, [isOpen]);

  const handleExport = useCallback(async () => {
    try {
      const hash = await encodeConfig(meta.config);
      const url =
        window.location.origin +
        window.location.pathname +
        '#' +
        hash;
      await navigator.clipboard.writeText(url);
      setFeedback(hasCustomSamples
        ? "Copied! Custom samples aren't included."
        : 'Copied!');
      setTimeout(() => setFeedback(''), FEEDBACK_TIMEOUT_MS);
    } catch {
      setFeedback('Failed');
      setTimeout(() => setFeedback(''), FEEDBACK_TIMEOUT_MS);
    }
  }, [meta.config, hasCustomSamples]);

  return (
    <div className="relative">
      <Tooltip tooltipKey="settings" position="bottom">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Settings"
          aria-expanded={isOpen}
          className="ss-key w-10 h-10 lg:w-11 lg:h-11 rounded-lg flex items-center justify-center text-muted hover:text-ink"
        >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-[18px] h-[18px]"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            clipRule="evenodd"
          />
        </svg>
        </button>
      </Tooltip>
      {isOpen && (
        <div
          ref={popoverRef}
          role="menu"
          className="ss-menu absolute right-0 top-full mt-2 w-60 p-1.5 z-30 flex flex-col"
        >
          <button
            role="menuitem"
            onClick={handleExport}
            className="w-full text-left px-2.5 py-2 rounded-[5px] text-sm text-ink hover:bg-[#2f2c27] flex items-center gap-2.5 focus-visible:outline-none focus-visible:bg-[#2f2c27]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-muted shrink-0">
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            {feedback || 'Copy share link'}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setExportKey((k) => k + 1);
              setExportOpen(true);
              setIsOpen(false);
            }}
            className="w-full text-left px-2.5 py-2 rounded-[5px] text-sm text-ink hover:bg-[#2f2c27] flex items-center gap-2.5 focus-visible:outline-none focus-visible:bg-[#2f2c27]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted shrink-0">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            Export kit…
          </button>
          <div className="h-px bg-line mx-1.5 my-1" />
          <button
            role="menuitem"
            onClick={() => {
              setSettingsKey((k) => k + 1);
              setSettingsOpen(true);
              setIsOpen(false);
            }}
            className="w-full text-left px-2.5 py-2 rounded-[5px] text-sm text-ink hover:bg-[#2f2c27] flex items-center gap-2.5 focus-visible:outline-none focus-visible:bg-[#2f2c27]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-muted shrink-0">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
            Settings…
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              // The menu item unmounts; park focus on the
              // gear so closing Help returns there.
              buttonRef.current?.focus();
              help.open();
            }}
            className="w-full text-left px-2.5 py-2 rounded-[5px] text-sm text-ink hover:bg-[#2f2c27] flex items-center gap-2.5 focus-visible:outline-none focus-visible:bg-[#2f2c27]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-muted shrink-0">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8" />
              <path d="M12 17h.01" />
            </svg>
            Help
          </button>
        </div>
      )}
      <SettingsModal
        key={settingsKey}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      {exportOpen && (
        <ExportKitDialog
          key={exportKey}
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          kit={state.currentKit}
          customSamples={state.customSamples}
          disabledSamples={state.disabledSamples}
        />
      )}
    </div>
  );
}
