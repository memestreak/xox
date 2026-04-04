"use client";

import {
  useState,
  useRef,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import type { Pattern } from './types';
import type { PatternCategory } from './patternUtils';
import Tooltip from './Tooltip';

interface PatternPickerProps {
  categories: PatternCategory[];
  selectedPatternId: string;
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
  onSelect,
  children,
}: PatternPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    string | null
  >(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isCustom = selectedPatternId === 'custom';
  // Find the pattern name from categories
  const matchedPattern = categories
    .flatMap(g => g.patterns)
    .find(p => p.id === selectedPatternId);
  const displayName = isCustom
    ? 'Custom'
    : (matchedPattern?.name ?? selectedPatternId);

  const handleOpen = () => {
    if (isCustom) {
      setSelectedCategory(null);
    } else {
      const cat = categories.find(g =>
        g.patterns.some(p => p.id === selectedPatternId),
      );
      setSelectedCategory(cat?.category ?? null);
    }
    setIsOpen(true);
    requestAnimationFrame(() => {
      drawerRef.current?.focus();
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () =>
      document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const activeCategory = categories.find(g =>
    g.patterns.some(p => p.id === selectedPatternId),
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

  const trigger = (
    <Tooltip tooltipKey="pattern" position="bottom">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => isOpen ? handleClose() : handleOpen()}
        aria-expanded={isOpen}
        aria-label="Pattern"
        className={`w-32 lg:w-40 px-3 lg:px-4 py-2 rounded-full
          font-bold text-xs lg:text-sm font-[family-name:var(--font-orbitron)]
          transition-colors
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-orange-500
          focus-visible:ring-offset-2
          focus-visible:ring-offset-neutral-950
          ${isOpen
            ? 'bg-orange-600 text-white hover:bg-orange-700'
            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
          }`}
      >
        <span className="block truncate">
          {isOpen ? `▲ ${displayName}` : displayName}
        </span>
      </button>
    </Tooltip>
  );

  const drawer = (
    <div
      data-testid="pattern-drawer"
      role="region"
      aria-label="Pattern browser"
      aria-hidden={!isOpen}
      className={`overflow-hidden
        ${isOpen ? 'max-h-[240px] opacity-100 mt-3 lg:mt-4' : 'max-h-0 opacity-0'}
        motion-safe:transition-all motion-safe:duration-100 ease-out`}
    >
      <div
        ref={drawerRef}
        role="listbox"
        aria-label="Pattern list"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.code === 'Space') e.preventDefault();
        }}
        className="h-[240px] flex flex-col
          bg-neutral-900/50 border border-neutral-800
          rounded-lg lg:rounded-xl shadow-inner
          focus-visible:outline-none"
      >
        {/* Category pills */}
        <div className="p-3 pb-2 flex flex-wrap gap-1.5">
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
                className={`px-3 py-1.5 text-sm border
                  rounded-lg font-medium transition-colors
                  ${isSelected
                    ? 'bg-orange-600 text-white border-transparent'
                    : hasActive
                      ? 'bg-neutral-700 text-orange-400 border-orange-600/40'
                      : 'bg-neutral-800 text-neutral-300 border-transparent hover:bg-neutral-700 hover:text-neutral-100'
                  }`}
              >
                {group.category}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-800" />

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
                className="gap-px"
              >
                {patternsToShow.map(p => {
                  const isActive =
                    p.id === selectedPatternId;
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
      </div>
    </div>
  );

  return <>{children({ trigger, drawer })}</>;
}
