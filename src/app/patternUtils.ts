import type { Pattern } from './types';
import { PATTERN_LIST_COLUMNS } from './constants';

/**
 * A group of patterns sharing the same category.
 */
export interface PatternCategory {
  category: string;
  patterns: Pattern[];
}

/**
 * Group patterns by their `category` field, sorted
 * alphabetically with "Other" pinned to the end.
 *
 * @param patterns - Array of patterns to categorize
 * @returns Array of category groups, sorted A-Z,
 *   "Other" last
 */
export function getCategorizedPatterns(
  patterns: Pattern[]
): PatternCategory[] {
  const map = new Map<string, Pattern[]>();
  for (const p of patterns) {
    const cat = p.category ?? 'Other';
    const list = map.get(cat);
    if (list) {
      list.push(p);
    } else {
      map.set(cat, [p]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const groups = Array.from(
    map, ([category, patterns]) => ({
      category,
      patterns,
    })
  );
  groups.sort((a, b) => {
    if (a.category === 'Other') return 1;
    if (b.category === 'Other') return -1;
    return a.category.localeCompare(b.category);
  });
  return groups;
}


/**
 * Rows in the chooser's pattern list: enough for about
 * PATTERN_LIST_COLUMNS columns. The list fills
 * top-to-bottom, then left-to-right, so pattern `i`
 * sits at row `i % rows`, column `floor(i / rows)`.
 */
export function patternListRowCount(
  patternCount: number
): number {
  return Math.ceil(patternCount / PATTERN_LIST_COLUMNS);
}

/**
 * Where the keyboard cursor is in the pattern chooser:
 * on a category key, or on a pattern in the list below.
 * `index` counts into the categories, or into the list
 * of the category that is showing.
 */
export type ChooserCursor =
  | { zone: 'category'; index: number }
  | { zone: 'pattern'; index: number };

export interface ChooserLayout {
  categoryCount: number;
  /** Patterns in the category that is showing. */
  patternCount: number;
  /** Index of the category that is showing, or -1. */
  shownCategoryIndex: number;
}

/** Step `index` by `delta` in 0..count-1, wrapping. */
function wrap(index: number, delta: number, count: number) {
  return (index + delta + count) % count;
}

/**
 * Move the chooser cursor for one key press. Returns
 * null when the key doesn't move it. Moves wrap around,
 * except ↑ on the list's top row, which goes up to the
 * category keys.
 */
export function moveChooserCursor(
  cursor: ChooserCursor,
  key: string,
  layout: ChooserLayout,
): ChooserCursor | null {
  const {
    categoryCount, patternCount, shownCategoryIndex,
  } = layout;

  if (cursor.zone === 'category') {
    const at = (index: number): ChooserCursor =>
      ({ zone: 'category', index });
    switch (key) {
      case 'ArrowRight':
        return at(wrap(cursor.index, 1, categoryCount));
      case 'ArrowLeft':
        return at(wrap(cursor.index, -1, categoryCount));
      case 'Home':
        return at(0);
      case 'End':
        return at(categoryCount - 1);
      case 'ArrowDown':
        return patternCount > 0
          ? { zone: 'pattern', index: 0 }
          : null;
      default:
        return null;
    }
  }

  if (patternCount === 0) return null;
  const rows = patternListRowCount(patternCount);
  const columns = Math.ceil(patternCount / rows);
  const row = cursor.index % rows;
  const column = Math.floor(cursor.index / rows);
  const at = (index: number): ChooserCursor =>
    ({ zone: 'pattern', index });
  // Same row in another column. The last column can be
  // shorter: then land on its last pattern.
  const inColumn = (col: number) =>
    at(Math.min(col * rows + row, patternCount - 1));

  switch (key) {
    case 'ArrowDown':
      return at(wrap(cursor.index, 1, patternCount));
    case 'ArrowUp':
      if (row > 0) return at(cursor.index - 1);
      return shownCategoryIndex >= 0
        ? { zone: 'category', index: shownCategoryIndex }
        : null;
    case 'ArrowRight':
      return inColumn(wrap(column, 1, columns));
    case 'ArrowLeft':
      return inColumn(wrap(column, -1, columns));
    case 'Home':
      return at(0);
    case 'End':
      return at(patternCount - 1);
    default:
      return null;
  }
}
