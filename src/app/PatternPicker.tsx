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
        className={
          'ss-key h-9 w-full pl-3 pr-2.5 text-sm font-medium'
          + ' flex items-center justify-between gap-2'
          + (isOpen ? ' border-accent' : ' border-edge')
        }
      >
        <span className="block truncate">{displayName}</span>
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
        className="ss-panel h-[240px] flex flex-col rounded-xl focus-visible:outline-none"
      >
        {/* Category keys */}
        <div className="p-3 pb-2.5 flex flex-wrap gap-1.5">
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
                        className={
                          'ss-led'
                          + (isActive ? ' ss-led-on' : ' bg-transparent')
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
