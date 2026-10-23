"use client";

import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  getHelpTabs, isApplePlatform, keyLabel, platformText,
} from './helpContent';
import type {
  HelpCard, HelpRow, HelpSection, HelpTab,
} from './helpContent';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Touch-first device: lead with gestures. */
function prefersTouch(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

function isApple(): boolean {
  if (typeof navigator === 'undefined') return true;
  return isApplePlatform(navigator.userAgent);
}

/**
 * Help dialog: keyboard shortcuts, pointer gestures and
 * a short tour, in tabs. Full screen below `sm`.
 * Remount it (change its key) to start on the first tab.
 */
export default function HelpModal({
  isOpen,
  onClose,
}: HelpModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabs] = useState(() => getHelpTabs(prefersTouch()));
  const [apple] = useState(isApple);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose]
  );

  const selectTab = useCallback((index: number) => {
    setActiveIndex(index);
    tabRefs.current[index]?.focus();
  }, []);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const last = tabs.length - 1;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectTab(activeIndex === last ? 0 : activeIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTab(activeIndex === 0 ? last : activeIndex - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        selectTab(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        selectTab(last);
      }
    },
    [activeIndex, selectTab, tabs.length]
  );

  const active = tabs[activeIndex];

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="help-title"
      onClose={onClose}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className={
        'ss-menu backdrop:bg-black/70 text-ink p-0'
        + ' m-0 w-full max-w-none h-dvh max-h-none rounded-none'
        + ' sm:m-auto sm:max-w-[760px] sm:h-fit'
        + ' sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl'
      }
    >
      <div className="flex flex-col h-full sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] pr-3 pl-4 sm:pt-[18px] sm:pr-5 sm:pl-6">
          <div className="flex items-baseline gap-3">
            <h2 id="help-title" className="ss-cap text-[22px]">
              Help
            </h2>
            <span className="ss-label text-faint hidden sm:inline">
              Shortcuts and tips
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="ss-key w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center text-muted hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Help sections"
          className="flex gap-[22px] px-4 sm:px-6 pt-3 border-b border-line"
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`help-tab-${tab.id}`}
              aria-selected={i === activeIndex}
              aria-controls={`help-panel-${tab.id}`}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => setActiveIndex(i)}
              onKeyDown={handleTabKeyDown}
              className={
                'ss-cap text-sm sm:text-[14px] pt-1.5 pb-2.5 border-b-2'
                + ' transition-colors focus-visible:outline-2'
                + ' focus-visible:outline-accent'
                + (i === activeIndex
                  ? ' border-accent text-accent-hi'
                  : ' border-transparent text-muted hover:text-ink')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`help-panel-${active.id}`}
          aria-labelledby={`help-tab-${active.id}`}
          // Scrollable region must be reachable by keyboard.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] focus-visible:outline-none"
        >
          <TabBody tab={active} apple={apple} />
        </div>
      </div>
    </dialog>
  );
}

function TabBody({ tab, apple }: { tab: HelpTab; apple: boolean }) {
  if (tab.cards) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {tab.cards.map((card) => (
          <Card key={card.title} card={card} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-x-9 gap-y-5">
      {tab.sections?.map((section) => (
        <Section
          key={section.title}
          section={section}
          apple={apple}
        />
      ))}
    </div>
  );
}

function Section({
  section, apple,
}: { section: HelpSection; apple: boolean }) {
  return (
    <section aria-label={section.title}>
      <h3 className="ss-label pb-1">{section.title}</h3>
      <ul>
        {section.rows.map((row, i) => (
          <Row key={i} row={row} apple={apple} />
        ))}
      </ul>
    </section>
  );
}

function Row({ row, apple }: { row: HelpRow; apple: boolean }) {
  return (
    <li className="flex items-center gap-3.5 py-2 border-b border-[#2b2925] last:border-b-0">
      <span className="flex items-center gap-1 w-[132px] sm:w-[150px] shrink-0 flex-wrap">
        {row.keys?.map((token, i) => (
          token === '+' || token === '/'
            ? (
              <span key={i} className="font-mono text-[11px] text-faint">
                {token}
              </span>
            )
            : (
              <kbd
                key={i}
                className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-[7px] rounded-[5px] border border-edge border-b-2 bg-linear-to-b from-[#2e2b27] to-[#24221f] font-mono text-xs font-medium text-ink"
              >
                {keyLabel(token, apple)}
              </kbd>
            )
        ))}
        {row.gesture && (
          <span className="font-mono text-xs text-lcd">
            {row.gesture}
          </span>
        )}
      </span>
      <span className="text-[15px] sm:text-sm leading-snug text-ink">
        {row.text}
        {row.note && (
          <span className="text-muted ml-1">
            {platformText(row.note, apple)}
          </span>
        )}
      </span>
    </li>
  );
}

function Card({ card }: { card: HelpCard }) {
  return (
    <div className="ss-panel rounded-lg px-4 py-3.5 sm:last:odd:col-span-2">
      <h3 className="font-display font-bold text-base uppercase tracking-[0.08em] text-ink">
        {card.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {card.body}
      </p>
    </div>
  );
}
