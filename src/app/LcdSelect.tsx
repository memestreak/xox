"use client";

import {
  useCallback, useEffect, useId, useLayoutEffect,
  useRef, useState,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTooltips } from './TooltipContext';
import {
  DROPDOWN_HINT_DELAY_MS,
  DROPDOWN_HINT_GAP_PX,
  DROPDOWN_LIST_GAP_PX as LIST_GAP_PX,
  DROPDOWN_LIST_MAX_HEIGHT_PX as LIST_MAX_HEIGHT_PX,
  DROPDOWN_TYPEAHEAD_RESET_MS as TYPEAHEAD_RESET_MS,
  DROPDOWN_VIEWPORT_MARGIN_PX as VIEWPORT_MARGIN_PX,
} from './constants';

export interface LcdSelectOption<T extends string> {
  value: T;
  label: string;
  /** Help shown beside the row when it is hovered or
   *  arrowed to (hidden when tooltips are off). */
  hint?: string;
}

interface LcdSelectProps<T extends string> {
  value: T;
  options: readonly LcdSelectOption<T>[];
  onChange: (value: T) => void;
  /** Lets a <label htmlFor> name the control. */
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Passed through (Tooltip sets it). */
  'aria-describedby'?: string;
  disabled?: boolean;
  /** Size and width classes for the closed key. */
  className?: string;
}

interface ListPosition {
  left: number;
  top: number;
  minWidth: number;
  maxHeight: number;
}

/**
 * Dropdown styled as an amber LCD readout. Replaces the
 * native <select> so every browser shows the same list.
 *
 * Follows the WAI-ARIA select-only combobox pattern:
 * focus stays on the key, the open list's highlighted
 * row is announced via aria-activedescendant. Closed,
 * ↓ ↑ Enter open it (Space stays the play/stop key).
 * Open, ↑ ↓ Home End and typing move the highlight,
 * Enter or Space picks, Esc and Tab close.
 */
export default function LcdSelect<T extends string>({
  value,
  options,
  onChange,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  disabled = false,
  className = '',
}: LcdSelectProps<T>) {
  const listId = useId();
  const optionIdPrefix = useId();
  const keyRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<ListPosition | null>(
    null
  );
  const typeahead = useRef({ text: '', time: 0 });
  const { tooltipsEnabled } = useTooltips();
  // Row help: shown for the highlighted row once the
  // pointer or the arrow keys moved the highlight (not
  // just because the list opened), after a short rest.
  const hintRef = useRef<HTMLDivElement>(null);
  const [hintArmed, setHintArmed] = useState(false);
  // True once the rest delay has passed; cleared when
  // the pointer leaves the list or the list opens/closes.
  const [hintRested, setHintRested] = useState(false);
  const [hintPos, setHintPos] = useState<{
    left: number; top: number;
  } | null>(null);

  const selectedIndex = Math.max(
    0, options.findIndex(o => o.value === value)
  );
  const selected = options[selectedIndex];

  const open = useCallback(() => {
    if (disabled || options.length === 0) return;
    setActiveIndex(selectedIndex);
    setHintArmed(false);
    setHintRested(false);
    setIsOpen(true);
  }, [disabled, options.length, selectedIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setPos(null);
    setHintArmed(false);
    setHintRested(false);
  }, []);

  const pick = useCallback((index: number) => {
    const opt = options[index];
    close();
    if (opt && opt.value !== value) onChange(opt.value);
  }, [options, value, onChange, close]);

  // Place the list under the key, or above it when
  // there is more room there. Fixed positioning keeps it
  // clear of scrolling parents (Settings, step editor).
  useLayoutEffect(() => {
    if (!isOpen) return;
    const key = keyRef.current;
    const list = listRef.current;
    if (!key || !list) return;
    const r = key.getBoundingClientRect();
    const spaceBelow =
      window.innerHeight - r.bottom - VIEWPORT_MARGIN_PX;
    const spaceAbove = r.top - VIEWPORT_MARGIN_PX;
    const wanted = Math.min(
      list.scrollHeight, LIST_MAX_HEIGHT_PX
    );
    const below = spaceBelow >= wanted
      || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(
      LIST_MAX_HEIGHT_PX,
      (below ? spaceBelow : spaceAbove) - LIST_GAP_PX,
    );
    const height = Math.min(wanted, maxHeight);
    const width = Math.max(r.width, list.offsetWidth);
    setPos({
      left: Math.max(
        VIEWPORT_MARGIN_PX,
        Math.min(
          r.left,
          window.innerWidth - width - VIEWPORT_MARGIN_PX,
        ),
      ),
      top: below
        ? r.bottom + LIST_GAP_PX
        : r.top - LIST_GAP_PX - height,
      minWidth: r.width,
      maxHeight,
    });
  }, [isOpen]);

  // Show the highlighted row's help after a rest; once
  // one is showing, moving to another row shows its help
  // straight away.
  const activeHint = options[activeIndex]?.hint;
  const wantHint = isOpen && pos !== null && hintArmed
    && tooltipsEnabled && !!activeHint;
  const hintIndex = wantHint && hintRested
    ? activeIndex
    : null;
  useEffect(() => {
    if (!wantHint || hintRested) return;
    const t = setTimeout(
      () => setHintRested(true),
      DROPDOWN_HINT_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [wantHint, hintRested]);

  // Place the help to the right of the list, beside its
  // row; to the left when the right has no room; under
  // the list when neither side does (phones).
  useLayoutEffect(() => {
    if (hintIndex === null) return;
    const list = listRef.current;
    const row = list?.children[hintIndex];
    const hint = hintRef.current;
    if (!list || !hint || !(row instanceof HTMLElement)) {
      return;
    }
    const l = list.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const w = hint.offsetWidth;
    const h = hint.offsetHeight;
    const maxRight = window.innerWidth - VIEWPORT_MARGIN_PX;
    let left = l.right + DROPDOWN_HINT_GAP_PX;
    let top = r.top + (r.height - h) / 2;
    if (left + w > maxRight) {
      left = l.left - DROPDOWN_HINT_GAP_PX - w;
      if (left < VIEWPORT_MARGIN_PX) {
        left = Math.max(
          VIEWPORT_MARGIN_PX, Math.min(l.left, maxRight - w)
        );
        top = l.bottom + DROPDOWN_HINT_GAP_PX;
      }
    }
    setHintPos({ left, top });
  }, [hintIndex]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!isOpen || !pos) return;
    const row = listRef.current?.children[activeIndex];
    if (row instanceof HTMLElement) {
      row.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isOpen, pos, activeIndex]);

  // Close on a press outside, a page scroll or a resize.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (keyRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) {
        return;
      }
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener(
        'pointerdown', onPointerDown
      );
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen, close]);

  /** Index of the next option whose label starts with
   *  the typed text, searching from the highlight. */
  const findByTyping = (char: string): number | null => {
    const now = Date.now();
    const t = typeahead.current;
    t.text = now - t.time > TYPEAHEAD_RESET_MS
      ? char
      : t.text + char;
    t.time = now;
    // One letter pressed again and again ("ddd") cycles
    // through the rows starting with it, as native
    // selects do; it starts after the highlight.
    const repeated = [...t.text].every(c => c === char);
    const text = (repeated ? char : t.text).toLowerCase();
    const start = repeated ? activeIndex + 1 : activeIndex;
    for (let i = 0; i < options.length; i++) {
      const idx = (start + i) % options.length;
      if (
        options[idx].label.toLowerCase().startsWith(text)
      ) {
        return idx;
      }
    }
    return null;
  };

  const handleKeyDown = (
    e: ReactKeyboardEvent<HTMLButtonElement>
  ) => {
    if (!isOpen) {
      if (
        e.key === 'ArrowDown' || e.key === 'ArrowUp'
        || e.key === 'Enter'
      ) {
        stopKey(e);
        open();
      }
      return;
    }
    const last = options.length - 1;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        setActiveIndex(i => Math.min(last, i + 1));
        setHintArmed(true);
        break;
      case 'ArrowUp':
        setActiveIndex(i => Math.max(0, i - 1));
        setHintArmed(true);
        break;
      case 'Home':
      case 'PageUp':
        setActiveIndex(0);
        setHintArmed(true);
        break;
      case 'End':
      case 'PageDown':
        setActiveIndex(last);
        setHintArmed(true);
        break;
      case 'Enter':
      case ' ':
        pick(activeIndex);
        break;
      case 'Escape':
        close();
        break;
      case 'Tab':
        // Close and let focus move on.
        close();
        return;
      default:
        if (
          e.key.length === 1
          && !e.ctrlKey && !e.metaKey && !e.altKey
        ) {
          const idx = findByTyping(e.key);
          if (idx !== null) setActiveIndex(idx);
        } else {
          handled = false;
        }
    }
    // Keep page shortcuts (Space, letters, Esc) away
    // while the list is open.
    if (handled) stopKey(e);
  };

  return (
    <>
      <button
        ref={keyRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={
          isOpen
            ? `${optionIdPrefix}-${activeIndex}`
            : undefined
        }
        disabled={disabled}
        data-open={isOpen || undefined}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        className={`ss-lcd-select ${className}`}
      >
        <span className="block truncate">
          {selected?.label ?? ''}
        </span>
        <LcdCaret open={isOpen} />
      </button>
      {isOpen && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          data-select-open=""
          className="ss-lcd-list ss-scroll"
          onPointerLeave={() => {
            setHintArmed(false);
            setHintRested(false);
          }}
          style={pos
            ? {
              left: pos.left,
              top: pos.top,
              minWidth: pos.minWidth,
              maxHeight: pos.maxHeight,
            }
            // First frame: measure off-screen.
            : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {options.map((opt, i) => (
            // Focus stays on the key (combobox), which
            // handles the keyboard for these rows.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div
              key={opt.value}
              id={`${optionIdPrefix}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === selectedIndex}
              aria-describedby={
                opt.hint ? `${optionIdPrefix}-${i}-hint` : undefined
              }
              data-active={i === activeIndex || undefined}
              onPointerMove={(e) => {
                setActiveIndex(i);
                // A touch has no hover: no help for taps.
                if (e.pointerType === 'mouse') {
                  setHintArmed(true);
                }
              }}
              // Keep focus on the key.
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(i)}
            >
              {opt.label}
              {opt.hint && (
                <span id={`${optionIdPrefix}-${i}-hint`} hidden>
                  {opt.hint}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {isOpen && hintIndex !== null && (
        <div
          ref={hintRef}
          aria-hidden="true"
          data-testid="lcd-select-hint"
          className="ss-lcd-hint"
          style={hintPos
            ? { left: hintPos.left, top: hintPos.top }
            : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {options[hintIndex]?.hint}
        </div>
      )}
    </>
  );
}

/**
 * Swallow a key the dropdown used. The app's page
 * shortcuts listen on `document`, which is also where
 * React listens (Next hydrates the whole document), so
 * stopPropagation alone does not reach them.
 */
function stopKey(e: ReactKeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
}

/** Small amber triangle shared by LCD dropdown keys. */
export function LcdCaret({ open = false }: {
  open?: boolean;
}) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={
        'ss-lcd-caret shrink-0 transition-transform'
        + (open ? ' rotate-180' : '')
      }
    >
      <path d="M1.5 3h7L5 7.5z" fill="currentColor" />
    </svg>
  );
}
