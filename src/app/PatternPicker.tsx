"use client";

import {
  useState,
  useRef,
  useEffect,
} from 'react';
import type { Pattern } from './types';
import type { PatternCategory } from './patternUtils';

interface PatternPickerProps {
  categories: PatternCategory[];
  currentPattern: Pattern;
  onSelect: (pattern: Pattern) => void;
}

/**
 * Centered modal pattern picker with category pills
 * (pinned top zone), columns-first pattern grid
 * (scrollable), and footer. Stays open for auditioning.
 * Escape/backdrop/X to close.
 */
export default function PatternPicker({
  categories,
  currentPattern,
  onSelect,
}: PatternPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    string | null
  >(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isCustom = currentPattern.id === 'custom';
  const displayName = isCustom ? 'Custom' : currentPattern.name;

  // Derive initial category when opening (avoids
  // setState-in-effect lint violation)
  const handleOpen = () => {
    if (isCustom) {
      setSelectedCategory(null);
    } else {
      const cat = categories.find(g =>
        g.patterns.some(p => p.id === currentPattern.id),
      );
      setSelectedCategory(cat?.category ?? null);
    }
    setIsOpen(true);
  };

  // Effect 2: Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () =>
      document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Effect 3: Focus modal on open, return focus on close
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  const activeCategory = categories.find(g =>
    g.patterns.some(p => p.id === currentPattern.id),
  );

  const patternsToShow = selectedCategory
    ? (categories.find(g => g.category === selectedCategory)
        ?.patterns ?? [])
    : [];

  const rowCount = patternsToShow.length > 0
    ? Math.min(
        patternsToShow.length,
        Math.ceil(patternsToShow.length / 4),
      )
    : 0;

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Pattern"
        className="w-full flex items-center justify-between
          bg-neutral-800 border border-neutral-700 rounded
          p-1 lg:p-2 text-sm text-left
          hover:border-neutral-600 transition-colors
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-orange-500"
      >
        <span className="truncate">{displayName}</span>
        <svg
          className={`w-4 h-4 ml-1 shrink-0 text-neutral-400
            transition-transform
            ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10
              11.168l3.71-3.938a.75.75 0
              111.08 1.04l-4.25 4.5a.75.75 0
              01-1.08 0l-4.25-4.5a.75.75 0
              01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          {/* Backdrop */}
          <div
            data-testid="pattern-picker-backdrop"
            className="fixed inset-0 bg-black/60 pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            ref={modalRef}
            role="dialog"
            aria-label="Pattern picker"
            tabIndex={-1}
            className="relative z-50 pointer-events-auto
              w-full max-w-[680px] mx-3
              flex flex-col max-h-[80vh]
              bg-neutral-900 border border-neutral-700
              rounded-xl shadow-2xl
              focus-visible:outline-none"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 p-1 z-10
                text-neutral-500 hover:text-neutral-300
                transition-colors"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06
                  1.06L8.94 10l-3.72 3.72a.75.75 0
                  101.06 1.06L10 11.06l3.72 3.72a.75.75
                  0 101.06-1.06L11.06 10l3.72-3.72a.75.75
                  0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>

            {/* Zone 1: Category pills (pinned) */}
            <div className="p-4 pb-3 flex flex-wrap gap-1.5">
              {categories.map(group => {
                const isSelected =
                  selectedCategory === group.category;
                const hasActive =
                  !isSelected &&
                  activeCategory?.category === group.category;
                return (
                  <button
                    key={group.category}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(
                        isSelected ? null : group.category,
                      )
                    }
                    data-has-active={hasActive || undefined}
                    className={`px-3 py-1.5 text-sm
                      rounded-lg font-medium transition-colors
                      ${isSelected
                        ? 'bg-orange-600 text-white'
                        : hasActive
                          ? 'bg-neutral-700 text-orange-400 border border-orange-600/40'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100'
                      }`}
                  >
                    {group.category}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-neutral-800" />

            {/* Zone 2: Pattern grid (scrollable) */}
            <div className="overflow-y-auto flex-1 p-4">
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
                    className="gap-px"
                  >
                    {patternsToShow.map(p => {
                      const isActive =
                        p.id === currentPattern.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => onSelect(p)}
                          className={`text-left px-2 py-1
                            text-sm rounded transition-colors
                            ${isActive
                              ? 'text-orange-400 bg-neutral-800 font-semibold'
                              : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'
                            }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )
                : (
                  <p className="text-sm text-neutral-500 italic">
                    Select a category
                  </p>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-800
              px-4 py-2 flex items-center justify-between
              text-xs text-neutral-500"
            >
              <span>
                Active:{' '}
                <span
                  data-testid="active-label"
                  className="text-orange-400 font-medium"
                >
                  {displayName}
                </span>
              </span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
