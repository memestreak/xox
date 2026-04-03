"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useSequencer } from './SequencerContext';
import { encodeConfig } from './configCodec';
import Tooltip from './Tooltip';
import SettingsModal from './SettingsModal';

/**
 * Gear icon button with a dropdown popover for settings.
 *
 * Contains an Export action that encodes the current config
 * as a URL hash, copies the full URL to clipboard, and
 * updates the address bar.
 */
export default function SettingsPopover() {
  const { meta } = useSequencer();
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
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

  const handleExport = useCallback(async () => {
    try {
      const hash = await encodeConfig(meta.config);
      const url =
        window.location.origin +
        window.location.pathname +
        '#' +
        hash;
      window.history.replaceState(
        null, '', '#' + hash
      );
      await navigator.clipboard.writeText(url);
      setFeedback('Copied!');
      setTimeout(() => setFeedback(''), 1500);
    } catch {
      setFeedback('Failed');
      setTimeout(() => setFeedback(''), 1500);
    }
  }, [meta.config]);

  return (
    <div className="relative">
      <Tooltip tooltipKey="settings" position="bottom">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Settings"
          aria-expanded={isOpen}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
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
          className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={handleExport}
            className="w-full text-left px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
          >
            {feedback || 'Export URL'}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setSettingsKey((k) => k + 1);
              setSettingsOpen(true);
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors border-t border-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
          >
            Settings…
          </button>
        </div>
      )}
      <SettingsModal
        key={settingsKey}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
