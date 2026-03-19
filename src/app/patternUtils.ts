import type { Pattern } from './types';

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
