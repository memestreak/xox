"use client";

import {
  useState,
  useRef,
  useEffect,
} from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import type { Pattern } from './types';
import {
  moveChooserCursor,
  patternListRowCount,
} from './patternUtils';
import type {
  ChooserCursor,
  PatternCategory,
} from './patternUtils';
import {
  isModalDialogOpen,
  isPopupOpen,
  PATTERN_CHOOSER_OPEN_ATTR,
  shouldIgnoreShortcut,
} from './keyboardUtils';
import Tooltip from './Tooltip';

interface PatternPickerProps {
  categories: PatternCategory[];
  selectedPatternId: string;
  /** Pattern cued for the next bar (Sequential mode). */
  pendingPatternId?: string | null;
  onSelect: (pattern: Pattern) => void;
  children: (props: {
    trigger: ReactNode;
    drawer: ReactNode;
  }) => ReactNode;
}

/**
 * Render-prop pattern picker. Exposes a trigger button and
 * an inline drawer via children function so the parent
 * controls layout placement.
 */
export default function PatternPicker({
  categories,
  selectedPatternId,
  pendingPatternId = null,
  onSelect,
  children,
}: PatternPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    string | null
  >(null);
  // The keyboard cursor. It is real focus on a category
  // or pattern button; this state says which one owns
  // the Tab stop and where the arrows move from.
  const [cursor, setCursor] = useState<ChooserCursor>(
    { zone: 'category', index: 0 },
  );

  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Set when a key moves the cursor, so the effect below
  // moves focus after the list has re-rendered.
  const focusCursorRef = useRef(false);
  // The latest render's handlers, for key listeners that
  // are registered once.
  const latestRef = useRef<{
    isOpen: boolean;
    handleOpen: (fromKeyboard: boolean) => void;
    handleClose: () => void;
    handleDrawerKeyDown: (e: KeyboardEvent) => void;
  } | null>(null);

  const isCustom = selectedPatternId === 'custom';
  // Find the pattern name from categories
  const matchedPattern = categories
    .flatMap(g => g.patterns)
    .find(p => p.id === selectedPatternId);
  const displayName = isCustom
    ? 'Custom'
    : (matchedPattern?.name ?? selectedPatternId);
  const pendingPattern = pendingPatternId
    ? categories
      .flatMap(g => g.patterns)
      .find(p => p.id === pendingPatternId)
    : undefined;
  const pendingName = pendingPattern?.name ?? pendingPatternId;

  /**
   * Open on the cued pattern if one is waiting for the
   * next bar, else on the current pattern. With neither
   * (Custom), open on the first category.
   */
  const handleOpen = (fromKeyboard: boolean) => {
    const startId = pendingPatternId ?? selectedPatternId;
    const categoryIndex = categories.findIndex(g =>
      g.patterns.some(p => p.id === startId),
    );
    if (categoryIndex >= 0) {
      const group = categories[categoryIndex];
      setSelectedCategory(group.category);
      setCursor({
        zone: 'pattern',
        index: group.patterns.findIndex(
          p => p.id === startId,
        ),
      });
    } else {
      setSelectedCategory(null);
      setCursor({ zone: 'category', index: 0 });
    }
    setIsOpen(true);
    if (fromKeyboard) {
      // Letter keys leave the "pointer" mark from
      // useInputModality in place, which hides focus
      // rings. The cursor is a focus ring, so show it.
      delete document.documentElement.dataset.input;
      focusCursorRef.current = true;
    } else {
      requestAnimationFrame(() => {
        drawerRef.current?.focus();
      });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Enter or Space on the key fires a click with
  // detail 0; a mouse click has detail 1 or more.
  const handleTriggerClick = (e: ReactMouseEvent) => {
    if (isOpen) handleClose();
    else handleOpen(e.detail === 0);
  };

  // P opens and closes the chooser (listed in
  // helpContent.ts). It waits while a menu or the step
  // editor is open.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey) return;
      if (shouldIgnoreShortcut(e) || isPopupOpen()) return;
      e.preventDefault();
      const latest = latestRef.current;
      if (!latest) return;
      if (latest.isOpen) latest.handleClose();
      else latest.handleOpen(true);
    };
    document.addEventListener('keydown', handleKey);
    return () =>
      document.removeEventListener('keydown', handleKey);
  }, []);

  // Close on Escape. Help, Settings, a menu or the step
  // editor on top closes first; the step selection is
  // cleared only on a later Esc (useSelection checks
  // isPatternChooserOpen).
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isModalDialogOpen() || isPopupOpen()) return;
      handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () =>
      document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const activeCategory = categories.find(g =>
    g.patterns.some(p => p.id === selectedPatternId),
  );
  const shownCategoryIndex = categories.findIndex(
    g => g.category === selectedCategory,
  );

  const patternsToShow = selectedCategory
    ? (categories.find(g => g.category === selectedCategory)
        ?.patterns ?? [])
    : [];

  const rowCount = patternListRowCount(patternsToShow.length);

  // Move focus to the cursor after a key moved it.
  useEffect(() => {
    if (!isOpen || !focusCursorRef.current) return;
    focusCursorRef.current = false;
    const el = drawerRef.current?.querySelector<HTMLElement>(
      `[data-cursor="${cursor.zone}-${cursor.index}"]`,
    );
    el?.focus();
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, cursor, selectedCategory]);

  const moveCursor = (next: ChooserCursor) => {
    // The list follows the cursor across categories.
    if (next.zone === 'category') {
      setSelectedCategory(categories[next.index].category);
    }
    setCursor(next);
    focusCursorRef.current = true;
  };

  // Where the category keys sit now, for ↑ / ↓ between
  // their wrapped lines.
  const categoryKeyBoxes = () =>
    categories.map((_, i) => {
      const el = drawerRef.current?.querySelector(
        `[data-cursor="category-${i}"]`,
      );
      const r = el?.getBoundingClientRect();
      return {
        top: r?.top ?? 0,
        left: r?.left ?? 0,
        width: r?.width ?? 0,
      };
    });

  const handleDrawerKeyDown = (e: KeyboardEvent) => {
    // Space stays play/stop: don't scroll the list or
    // press the focused button.
    if (e.code === 'Space') {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Opened with the mouse, focus is on the panel and
    // there is no cursor yet: the first arrow shows it
    // where P would have put it.
    if (e.target === drawerRef.current) {
      if (e.key.startsWith('Arrow') || e.key === 'Home'
        || e.key === 'End') {
        e.preventDefault();
        focusCursorRef.current = true;
        setCursor(c => ({ ...c }));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor.zone === 'pattern') {
        const pattern = patternsToShow[cursor.index];
        if (pattern) onSelect(pattern);
      } else if (patternsToShow.length > 0) {
        moveCursor({ zone: 'pattern', index: 0 });
      }
      return;
    }

    const next = moveChooserCursor(cursor, e.key, {
      categoryCount: categories.length,
      categoryBoxes: cursor.zone === 'category'
        ? categoryKeyBoxes()
        : undefined,
      patternCount: patternsToShow.length,
      shownCategoryIndex,
    });
    if (next) {
      e.preventDefault();
      moveCursor(next);
    }
  };

  // Each zone is one Tab stop: the cursor's button if
  // the cursor is there, else the shown category or the
  // playing pattern (else the first pattern).
  const categoryTabStop = cursor.zone === 'category'
    ? cursor.index
    : Math.max(shownCategoryIndex, 0);
  const activePatternIndex = patternsToShow.findIndex(
    p => p.id === selectedPatternId,
  );
  const patternTabStop = cursor.zone === 'pattern'
    ? cursor.index
    : Math.max(activePatternIndex, 0);

  useEffect(() => {
    latestRef.current = {
      isOpen, handleOpen, handleClose, handleDrawerKeyDown,
    };
  });

  // Keys inside the panel: arrows, Home/End, Enter.
  useEffect(() => {
    const panel = drawerRef.current;
    if (!panel) return;
    const handleKeyDown = (e: KeyboardEvent) =>
      latestRef.current?.handleDrawerKeyDown(e);
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
    };
    panel.addEventListener('keydown', handleKeyDown);
    panel.addEventListener('keyup', handleKeyUp);
    return () => {
      panel.removeEventListener('keydown', handleKeyDown);
      panel.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const trigger = (
    <Tooltip tooltipKey="pattern" position="bottom">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-expanded={isOpen}
        aria-label={
          pendingPatternId
            ? `Pattern, ${pendingName} cued for the next bar`
            : 'Pattern'
        }
        className={
          'ss-key h-9 w-full pl-3 pr-2.5 text-sm font-medium'
          + ' flex items-center justify-between gap-2'
          + (isOpen ? ' border-accent' : ' border-edge')
        }
      >
        <span className="block truncate">{displayName}</span>
        {pendingPatternId && (
          <span
            aria-hidden="true"
            data-testid="pattern-cue-led"
            className="ss-led ss-led-cue animate-temp-blink ml-auto"
          />
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={
            'shrink-0 text-muted transition-transform'
            + (isOpen ? ' rotate-180' : '')
          }
        >
          <path
            d="M3 4.5l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </Tooltip>
  );

  const drawer = (
    <div
      data-testid="pattern-drawer"
      role="region"
      aria-label="Pattern browser"
      aria-hidden={!isOpen}
      {...(isOpen ? { [PATTERN_CHOOSER_OPEN_ATTR]: '' } : {})}
      className={`overflow-hidden
        ${isOpen ? 'max-h-[240px] opacity-100 mt-3 lg:mt-4' : 'max-h-0 opacity-0'}
        motion-safe:transition-all motion-safe:duration-100 ease-out`}
    >
      <div
        ref={drawerRef}
        role="group"
        aria-label="Categories and patterns"
        tabIndex={-1}
        className="ss-panel h-[240px] flex flex-col rounded-xl focus-visible:outline-none"
      >
        {/* Category keys */}
        <div
          role="group"
          aria-label="Pattern categories"
          className="p-3 pb-2.5 flex flex-wrap gap-1.5"
        >
          {categories.map((group, i) => {
            const isSelected =
              selectedCategory === group.category;
            const hasActive =
              !isSelected &&
              activeCategory?.category === group.category;
            return (
              <button
                key={group.category}
                type="button"
                aria-pressed={isSelected}
                tabIndex={i === categoryTabStop ? 0 : -1}
                data-cursor={`category-${i}`}
                onFocus={() =>
                  setCursor({ zone: 'category', index: i })
                }
                onClick={() => {
                  setSelectedCategory(
                    isSelected ? null : group.category,
                  );
                  setCursor({ zone: 'category', index: i });
                }}
                data-has-active={hasActive || undefined}
                className={
                  'ss-key h-8 px-3 text-sm font-medium'
                  + (isSelected
                    ? ' bg-none bg-accent border-accent-hi text-[#1a0d05]'
                    : hasActive
                      ? ' border-accent/60 text-accent-hi'
                      : ' border-edge text-ink')
                }
              >
                {group.category}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-line" />

        {/* Pattern grid (scrollable) */}
        <div className="overflow-y-auto flex-1 min-h-0 p-3 hide-scrollbar">
          {selectedCategory && patternsToShow.length > 0
            ? (
              <div
                style={{
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows:
                    `repeat(${rowCount}, auto)`,
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(120px, 1fr))',
                }}
                role="listbox"
                aria-label="Patterns"
                className="gap-px"
              >
                {patternsToShow.map((p, i) => {
                  const isActive =
                    p.id === selectedPatternId;
                  const isCued = p.id === pendingPatternId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      aria-label={
                        isCued ? `${p.name}, cued` : undefined
                      }
                      tabIndex={i === patternTabStop ? 0 : -1}
                      data-cursor={`pattern-${i}`}
                      onFocus={() =>
                        setCursor({ zone: 'pattern', index: i })
                      }
                      onClick={() => {
                        setCursor({ zone: 'pattern', index: i });
                        onSelect(p);
                      }}
                      className={
                        'text-left px-2 py-1.5 text-sm rounded-md'
                        + ' flex items-center gap-2 transition-colors'
                        + (isActive
                          ? ' bg-raised text-ink font-semibold'
                          : ' text-muted hover:bg-raised hover:text-ink')
                      }
                    >
                      <span
                        aria-hidden="true"
                        data-cued={isCued || undefined}
                        className={
                          'ss-led'
                          + (isCued
                            ? ' ss-led-cue animate-temp-blink'
                            : isActive
                              ? ' ss-led-on'
                              : ' bg-transparent')
                        }
                      />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )
            : (
              <p className="text-sm text-faint">
                Select a category
              </p>
            )}
        </div>
      </div>
    </div>
  );

  return <>{children({ trigger, drawer })}</>;
}
