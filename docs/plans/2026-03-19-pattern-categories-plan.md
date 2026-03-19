# Pattern Categories Implementation Plan

> **For agentic workers:** REQUIRED: Use
> subagent-driven-development (if subagents available) or
> executing-plans to implement this plan. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat pattern `<select>` dropdown with a
centered-modal picker that organizes 127 patterns into 16
alphabetically-sorted categories.

**Architecture:** Add a `category` field to `patterns.json`
and `Pattern` type. Update `patternUtils.ts` to sort
categories and use "Other" as fallback. Rewrite
`PatternPicker.tsx` as a centered modal with pill-based
category navigation and a columns-first pattern grid. Wire
into `TransportControls.tsx` replacing the `<select>`.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4,
Vitest + @testing-library/react

**Spec:** `docs/specs/2026-03-18-pattern-categories-design.md`

---

### Task 1: Data layer — patterns.json and types.ts

**Why:** All downstream code depends on the `category` field
existing in patterns.json and the Pattern type. This must land
first.

**Files:**
- Modify: `src/app/types.ts` (line 32-39, Pattern interface)
- Modify: `src/app/data/patterns.json` (all 127 patterns)

- [ ] **Step 1: Add `category` to Pattern interface**

In `src/app/types.ts`, add `category?: string;` after the
`name` field:

```typescript
export interface Pattern {
  id: string;
  name: string;
  category?: string;
  steps: Record<TrackId, string>;
  trigConditions?: Partial<
    Record<TrackId, Record<number, StepConditions>>
  >;
}
```

- [ ] **Step 2: Write a script to add categories to
patterns.json**

Create `/tmp/add-categories.js`:

```javascript
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '../src/app/data/patterns.json'
);
// Adjust path for where the script is run from:
const data = JSON.parse(
  fs.readFileSync(
    'src/app/data/patterns.json', 'utf8'
  )
);

const categoryMap = {
  'afro-cub': 'Afro-Cuban',
  'afro-cuban': 'Afro-Cuban',
  'boogie': 'Boogie',
  'bossa': 'Bossa',
  'cha-cha': 'Cha-Cha',
  'disco': 'Disco',
  'funk': 'Funk',
  'paso': 'Paso',
  'pop': 'Pop',
  'r-b': 'R&B',
  'reggae': 'Reggae',
  'rock': 'Rock',
  'samba': 'Samba',
  'ska': 'Ska',
  'slow': 'Slow',
  'twist': 'Twist',
};

// These exact IDs go to "Other"
const otherIds = new Set([
  'charleston', 'house-01', 'march-2',
  'tango', 'techno-01',
]);

for (const p of data.patterns) {
  if (otherIds.has(p.id)) {
    p.category = 'Other';
    continue;
  }
  // Find longest matching prefix
  let matched = null;
  for (const prefix of Object.keys(categoryMap)) {
    if (
      p.id === prefix ||
      p.id.startsWith(prefix + '-')
    ) {
      if (
        !matched ||
        prefix.length > matched.length
      ) {
        matched = prefix;
      }
    }
  }
  if (matched) {
    p.category = categoryMap[matched];
  } else {
    p.category = 'Other';
  }
}

// Rename Afro-Cub display names
for (const p of data.patterns) {
  if (
    p.id.startsWith('afro-cub-') &&
    p.name.startsWith('Afro-Cub ')
  ) {
    const num = p.name.replace('Afro-Cub ', '');
    p.name = `Afro-Cuban ${num}`;
  }
}
// Rename afro-cuban-1 to Afro-Cuban 10
const ac1 = data.patterns.find(
  p => p.id === 'afro-cuban-1'
);
if (ac1) ac1.name = 'Afro-Cuban 10';

fs.writeFileSync(
  'src/app/data/patterns.json',
  JSON.stringify(data, null, 2) + '\n'
);
console.log('Done. Verify with:');
console.log(
  '  node -e "const d=require(\'./src/app/data/' +
  'patterns.json\');console.log(d.patterns.slice(0,3))"'
);
```

Run: `node /tmp/add-categories.js`

- [ ] **Step 3: Verify the data transformation**

Run:
```bash
node -e "
  const d = require('./src/app/data/patterns.json');
  // Check category field exists on all patterns
  const missing = d.patterns.filter(p => !p.category);
  console.log('Missing category:', missing.length);
  // Check Afro-Cuban names
  const afro = d.patterns.filter(
    p => p.category === 'Afro-Cuban'
  );
  afro.forEach(p => console.log(p.id, p.name));
  // Check Other bucket
  const other = d.patterns.filter(
    p => p.category === 'Other'
  );
  other.forEach(p => console.log(p.id, p.name));
  // Count total
  console.log('Total:', d.patterns.length);
"
```

Expected:
- Missing category: 0
- Afro-Cuban patterns named "Afro-Cuban 1" through
  "Afro-Cuban 10"
- Other contains: charleston, house-01, march-2, tango,
  techno-01
- Total: 127

- [ ] **Step 4: Run existing tests**

Run: `npm test`

Expected: `patternUtils.test.ts` will fail on category names
(expects "Misc", data now has real categories). Other tests
pass. The patternUtils failures are expected and fixed in
Task 2.

- [ ] **Step 5: Commit**

```
git add src/app/types.ts src/app/data/patterns.json
git commit -m "Add category field to patterns and Pattern type

Add category to all 127 patterns in patterns.json.
Merge single-pattern categories into Other.
Rename Afro-Cub display names to Afro-Cuban.
Renumber afro-cuban-1 to Afro-Cuban 10."
```

---

### Task 2: Update patternUtils — sorting and fallback

**Why:** The grouping utility needs to sort alphabetically
with "Other" last, and use "Other" as the fallback instead of
"Misc". Tests must be updated to match.

**Files:**
- Modify: `src/app/patternUtils.ts`
- Modify: `src/__tests__/patternUtils.test.ts`

- [ ] **Step 1: Update the failing tests first**

Replace `src/__tests__/patternUtils.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import patternsData from '../app/data/patterns.json';
import {
  getCategorizedPatterns,
} from '../app/patternUtils';
import type { Pattern } from '../app/types';

const patterns = patternsData.patterns as Pattern[];

describe('getCategorizedPatterns', () => {
  const result = getCategorizedPatterns(patterns);

  it('returns non-empty groups', () => {
    expect(result.length).toBeGreaterThan(0);
    for (const group of result) {
      expect(group.patterns.length).toBeGreaterThan(0);
    }
  });

  it('every pattern appears exactly once', () => {
    const ids = result.flatMap(
      g => g.patterns.map(p => p.id)
    );
    expect(ids).toHaveLength(patterns.length);
    expect(new Set(ids).size).toBe(patterns.length);
  });

  it('preserves order within categories', () => {
    for (const group of result) {
      const groupIds = group.patterns.map(p => p.id);
      const sourceIds = patterns
        .filter(
          p => (p.category ?? 'Other') ===
            group.category
        )
        .map(p => p.id);
      expect(groupIds).toEqual(sourceIds);
    }
  });

  it('handles empty input', () => {
    expect(getCategorizedPatterns([])).toEqual([]);
  });

  it('falls back to Other for missing category', () => {
    const noCategory = [
      { id: 'x', name: 'X', steps: {} },
    ] as Pattern[];
    const groups = getCategorizedPatterns(noCategory);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('Other');
  });

  it('has expected categories', () => {
    const categories = result.map(g => g.category);
    expect(categories).toContain('Funk');
    expect(categories).toContain('Rock');
    expect(categories).toContain('Disco');
    expect(categories).toContain('Other');
  });

  it('categories are sorted alphabetically', () => {
    const categories = result.map(g => g.category);
    const withoutOther = categories.filter(
      c => c !== 'Other'
    );
    const sorted = [...withoutOther].sort(
      (a, b) => a.localeCompare(b)
    );
    expect(withoutOther).toEqual(sorted);
  });

  it('Other is the last category', () => {
    const categories = result.map(g => g.category);
    expect(categories[categories.length - 1]).toBe(
      'Other'
    );
  });

  it('accounts for all 127 patterns', () => {
    const total = result.reduce(
      (sum, g) => sum + g.patterns.length, 0
    );
    expect(total).toBe(127);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/patternUtils.test.ts`

Expected: Failures on "falls back to Other", "categories are
sorted alphabetically", and "Other is the last category"
(implementation still uses "Misc" and doesn't sort).

- [ ] **Step 3: Update patternUtils.ts implementation**

Replace `src/app/patternUtils.ts` with:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/patternUtils.test.ts`

Expected: All pass.

- [ ] **Step 5: Commit**

```
git add src/app/patternUtils.ts \
  src/__tests__/patternUtils.test.ts
git commit -m "Sort pattern categories alphabetically

Change fallback from Misc to Other. Sort categories A-Z
with Other pinned last. Update tests to match."
```

---

### Task 3: PatternPicker component — tests

**Why:** TDD — write the component tests first, then implement
to make them pass.

**Files:**
- Create: `src/__tests__/PatternPicker.test.tsx`

- [ ] **Step 1: Write PatternPicker tests**

Create `src/__tests__/PatternPicker.test.tsx`:

```tsx
import {
  render, screen, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PatternPicker from '../app/PatternPicker';
import type { PatternCategory } from '../app/patternUtils';
import type { Pattern } from '../app/types';

// Minimal test categories
const funkPatterns: Pattern[] = [
  {
    id: 'funk-1', name: 'Funk 1',
    category: 'Funk',
    steps: { ac: '', bd: '', sd: '', ch: '',
      oh: '', cy: '', ht: '', mt: '', lt: '',
      rs: '', cp: '', cb: '' },
  },
  {
    id: 'funk-2', name: 'Funk 2',
    category: 'Funk',
    steps: { ac: '', bd: '', sd: '', ch: '',
      oh: '', cy: '', ht: '', mt: '', lt: '',
      rs: '', cp: '', cb: '' },
  },
];

const rockPatterns: Pattern[] = [
  {
    id: 'rock-1', name: 'Rock 1',
    category: 'Rock',
    steps: { ac: '', bd: '', sd: '', ch: '',
      oh: '', cy: '', ht: '', mt: '', lt: '',
      rs: '', cp: '', cb: '' },
  },
];

const categories: PatternCategory[] = [
  { category: 'Funk', patterns: funkPatterns },
  { category: 'Rock', patterns: rockPatterns },
];

const customPattern: Pattern = {
  id: 'custom', name: 'Custom',
  steps: { ac: '', bd: '', sd: '', ch: '',
    oh: '', cy: '', ht: '', mt: '', lt: '',
    rs: '', cp: '', cb: '' },
};

function renderPicker(
  currentPattern: Pattern = funkPatterns[0],
  onSelect = vi.fn(),
) {
  return {
    onSelect,
    ...render(
      <PatternPicker
        categories={categories}
        currentPattern={currentPattern}
        onSelect={onSelect}
      />
    ),
  };
}

describe('PatternPicker', () => {
  describe('trigger button', () => {
    it('shows current pattern name', () => {
      renderPicker(funkPatterns[0]);
      expect(
        screen.getByRole('button', { name: /pattern/i })
      ).toHaveTextContent('Funk 1');
    });

    it('shows Custom when pattern is custom', () => {
      renderPicker(customPattern);
      expect(
        screen.getByRole('button', { name: /pattern/i })
      ).toHaveTextContent('Custom');
    });
  });

  describe('modal open/close', () => {
    it('modal is hidden initially', () => {
      renderPicker();
      expect(
        screen.queryByRole('dialog')
      ).not.toBeInTheDocument();
    });

    it('opens on trigger click', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      expect(
        screen.getByRole('dialog')
      ).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      await user.keyboard('{Escape}');
      expect(
        screen.queryByRole('dialog')
      ).not.toBeInTheDocument();
    });

    it('closes on X button click', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      await user.click(
        screen.getByRole('button', { name: /close/i })
      );
      expect(
        screen.queryByRole('dialog')
      ).not.toBeInTheDocument();
    });

    it('closes on backdrop click', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      // Click the backdrop (first fixed overlay)
      const backdrop = screen.getByTestId(
        'pattern-picker-backdrop'
      );
      await user.click(backdrop);
      expect(
        screen.queryByRole('dialog')
      ).not.toBeInTheDocument();
    });
  });

  describe('category pills', () => {
    it('renders all category pills', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByRole(
          'button', { name: 'Funk' }
        )
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole(
          'button', { name: 'Rock' }
        )
      ).toBeInTheDocument();
    });

    it(
      'auto-selects category of current pattern on open',
      async () => {
        const user = userEvent.setup();
        renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        // Funk patterns should be visible
        expect(
          screen.getByRole('option', { name: 'Funk 1' })
        ).toBeInTheDocument();
      }
    );

    it(
      'no category pre-selected for Custom pattern',
      async () => {
        const user = userEvent.setup();
        renderPicker(customPattern);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        // No pattern options should be shown
        expect(
          screen.queryByRole('option')
        ).not.toBeInTheDocument();
      }
    );

    it('clicking a category shows its patterns',
      async () => {
        const user = userEvent.setup();
        renderPicker(customPattern);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        await user.click(
          screen.getByRole('button', { name: 'Rock' })
        );
        expect(
          screen.getByRole('option', { name: 'Rock 1' })
        ).toBeInTheDocument();
      }
    );

    it(
      'has-active pill state when different category ' +
      'is selected',
      async () => {
        const user = userEvent.setup();
        renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        // Switch to Rock category
        await user.click(
          screen.getByRole('button', { name: 'Rock' })
        );
        // Funk pill should have has-active indicator
        const funkPill = screen.getByRole(
          'button', { name: 'Funk' }
        );
        expect(
          funkPill.getAttribute('data-has-active')
        ).toBe('true');
      }
    );
  });

  describe('pattern selection', () => {
    it(
      'clicking a pattern calls onSelect',
      async () => {
        const user = userEvent.setup();
        const { onSelect } = renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        await user.click(
          screen.getByRole('option', { name: 'Funk 2' })
        );
        expect(onSelect).toHaveBeenCalledWith(
          funkPatterns[1]
        );
      }
    );

    it(
      'modal stays open after pattern selection',
      async () => {
        const user = userEvent.setup();
        renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        await user.click(
          screen.getByRole('option', { name: 'Funk 2' })
        );
        expect(
          screen.getByRole('dialog')
        ).toBeInTheDocument();
      }
    );

    it(
      'active pattern has aria-selected',
      async () => {
        const user = userEvent.setup();
        renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button',
            { name: /pattern/i })
        );
        expect(
          screen.getByRole('option', { name: 'Funk 1' })
        ).toHaveAttribute('aria-selected', 'true');
        expect(
          screen.getByRole('option', { name: 'Funk 2' })
        ).toHaveAttribute('aria-selected', 'false');
      }
    );
  });

  describe('footer', () => {
    it('shows active pattern name', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      expect(
        screen.getByText('Funk 1')
      ).toBeInTheDocument();
    });

    it('shows Custom for custom pattern', async () => {
      const user = userEvent.setup();
      renderPicker(customPattern);
      await user.click(
        screen.getByRole('button', { name: /pattern/i })
      );
      expect(screen.getByTestId('active-label'))
        .toHaveTextContent('Custom');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/PatternPicker.test.tsx`

Expected: All fail (PatternPicker is the old throwaway draft
that doesn't match these test expectations).

- [ ] **Step 3: Commit test file**

```
git add src/__tests__/PatternPicker.test.tsx
git commit -m "Add PatternPicker component tests

Tests for modal open/close, category pills, pattern
selection, has-active state, Custom pattern handling,
and footer display. All currently failing — TDD red phase."
```

---

### Task 4: PatternPicker component — implementation

**Why:** Implement the component to make all tests from Task 3
pass.

**Files:**
- Rewrite: `src/app/PatternPicker.tsx`

- [ ] **Step 1: Rewrite PatternPicker.tsx**

Replace the entire file `src/app/PatternPicker.tsx` with:

```tsx
"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import type { Pattern } from './types';
import type { PatternCategory } from './patternUtils';

interface PatternPickerProps {
  categories: PatternCategory[];
  currentPattern: Pattern;
  onSelect: (pattern: Pattern) => void;
}

/**
 * Pattern picker with centered modal. Category pills
 * across the top, pattern grid below. Stays open for
 * auditioning.
 */
export default function PatternPicker({
  categories,
  currentPattern,
  onSelect,
}: PatternPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Auto-select category of current pattern on open
  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory(null);
      return;
    }
    if (currentPattern.id === 'custom') return;
    const cat = categories.find(g =>
      g.patterns.some(p => p.id === currentPattern.id)
    );
    setSelectedCategory(cat?.category ?? null);
  }, [isOpen, categories, currentPattern.id]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () =>
      document.removeEventListener(
        'keydown', handleKey
      );
  }, [isOpen]);

  // Focus modal on open, return focus on close
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  const handleCategoryClick = useCallback(
    (category: string) => {
      setSelectedCategory(prev =>
        prev === category ? null : category
      );
    },
    []
  );

  const activeGroup = selectedCategory
    ? categories.find(
      g => g.category === selectedCategory
    )
    : null;

  const displayName =
    currentPattern.id === 'custom'
      ? 'Custom'
      : currentPattern.name;

  // Compute row count for columns-first grid
  const patternCount =
    activeGroup?.patterns.length ?? 0;
  const rowCount = Math.min(
    patternCount,
    Math.ceil(patternCount / 4)
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Pattern"
        className="w-full flex items-center
          justify-between bg-neutral-800 border
          border-neutral-700 rounded p-1 lg:p-2
          text-sm text-left hover:border-neutral-600
          transition-colors focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-orange-500"
      >
        <span className="truncate">{displayName}</span>
        <svg
          className={`w-4 h-4 ml-1 shrink-0
            text-neutral-400 transition-transform
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

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            data-testid="pattern-picker-backdrop"
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div
            ref={modalRef}
            role="dialog"
            aria-label="Pattern picker"
            tabIndex={-1}
            className="fixed z-50 inset-x-3 top-20
              bottom-6 lg:inset-x-12 lg:top-24
              lg:bottom-12 flex items-center
              justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto
                bg-neutral-900 border
                border-neutral-700 rounded-xl
                shadow-2xl w-full max-w-[680px]
                max-h-full flex flex-col p-4 lg:p-6"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="absolute top-3 right-3 p-1
                  text-neutral-500
                  hover:text-neutral-300
                  transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0
                    00-1.06 1.06L8.94 10l-3.72
                    3.72a.75.75 0 101.06 1.06L10
                    11.06l3.72 3.72a.75.75 0
                    101.06-1.06L11.06 10l3.72-3.72
                    a.75.75 0 00-1.06-1.06L10
                    8.94 6.28 5.22z" />
                </svg>
              </button>

              {/* Zone 1: Category pills (pinned) */}
              <div className="shrink-0 mb-4">
                <div className="text-[9px] uppercase
                  tracking-[0.1em] text-neutral-500
                  font-bold mb-2"
                >
                  Category
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(group => {
                    const isSelected =
                      selectedCategory ===
                      group.category;
                    const hasActive =
                      !isSelected &&
                      group.patterns.some(
                        p => p.id ===
                          currentPattern.id
                      );
                    return (
                      <button
                        key={group.category}
                        type="button"
                        onClick={() =>
                          handleCategoryClick(
                            group.category
                          )
                        }
                        data-has-active={
                          hasActive || undefined
                        }
                        className={`px-3 py-1.5
                          text-sm rounded-lg
                          font-semibold
                          transition-colors
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
              </div>

              {/* Divider */}
              <div className="border-t
                border-neutral-800 mb-4 shrink-0" />

              {/* Zone 2: Pattern grid (scrollable) */}
              <div className="flex-1 overflow-y-auto
                min-h-0"
              >
                {activeGroup ? (
                  <div
                    className="grid gap-1"
                    style={{
                      gridAutoFlow: 'column',
                      gridTemplateRows:
                        `repeat(${rowCount}, auto)`,
                      gridTemplateColumns:
                        `repeat(auto-fill, minmax(120px, 1fr))`,
                    }}
                  >
                    {activeGroup.patterns.map(p => {
                      const isActive =
                        p.id === currentPattern.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => onSelect(p)}
                          className={`px-2 py-1.5
                            text-sm rounded text-left
                            truncate max-w-[16ch]
                            transition-colors
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
                ) : (
                  <p className="text-sm
                    text-neutral-500 px-1"
                  >
                    Select a category
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="border-t
                border-neutral-800 pt-3 mt-4
                shrink-0 flex justify-between
                items-center"
              >
                <div className="text-xs
                  text-neutral-500"
                >
                  Active:{' '}
                  <span
                    data-testid="active-label"
                    className="text-orange-400
                      font-semibold"
                  >
                    {displayName}
                  </span>
                </div>
                <div className="text-[10px]
                  text-neutral-600"
                >
                  Esc to close
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run PatternPicker tests**

Run: `npm test -- src/__tests__/PatternPicker.test.tsx`

Expected: All pass. If any fail, fix the component to match
the test expectations. Common issues:
- `role="dialog"` must be on the element with `ref={modalRef}`
- `aria-label="Pattern"` on trigger button
- `data-testid="pattern-picker-backdrop"` on backdrop
- `data-testid="active-label"` on footer name span
- `data-has-active="true"` on category pills

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: All pass.

- [ ] **Step 4: Commit**

```
git add src/app/PatternPicker.tsx
git commit -m "Rewrite PatternPicker as centered modal

Centered modal with category pills (pinned top zone),
columns-first pattern grid (scrollable), and footer.
Stays open for auditioning. Escape/backdrop/X to close."
```

---

### Task 5: Integration — TransportControls + Space bar fix

**Why:** Wire PatternPicker into the transport bar and fix the
Space bar conflict.

**Files:**
- Modify: `src/app/TransportControls.tsx`
- Modify: `src/app/SequencerContext.tsx` (line 443-463)
- Modify: `src/__tests__/TransportControls.test.tsx`

- [ ] **Step 1: Update TransportControls.test.tsx**

Replace `src/__tests__/TransportControls.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TransportControls from '../app/TransportControls';
import { TestWrapper } from './helpers/sequencer-wrapper';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
  },
}));

function renderTransport() {
  return render(
    <TestWrapper>
      <TransportControls />
    </TestWrapper>
  );
}

describe('TransportControls pattern picker', () => {
  it('shows pattern picker trigger button', () => {
    renderTransport();
    expect(
      screen.getByRole('button', { name: /pattern/i })
    ).toBeInTheDocument();
  });

  it('opens modal on trigger click', async () => {
    const user = userEvent.setup();
    renderTransport();
    await user.click(
      screen.getByRole('button', { name: /pattern/i })
    );
    expect(
      screen.getByRole('dialog')
    ).toBeInTheDocument();
  });

  it('shows category pills in modal', async () => {
    const user = userEvent.setup();
    renderTransport();
    await user.click(
      screen.getByRole('button', { name: /pattern/i })
    );
    expect(
      screen.getByRole('button', { name: 'Funk' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rock' })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npm test -- src/__tests__/TransportControls.test.tsx`

Expected: Fails because TransportControls still has `<select>`.

- [ ] **Step 3: Update TransportControls.tsx**

Replace `src/app/TransportControls.tsx`:

```tsx
"use client";

import { memo } from 'react';
import kitsData from './data/kits.json';
import patternsData from './data/patterns.json';
import TempoController from './TempoController';
import SettingsPopover from './SettingsPopover';
import GlobalControls from './GlobalControls';
import FillButton from './FillButton';
import PatternPicker from './PatternPicker';
import {
  getCategorizedPatterns,
} from './patternUtils';
import { useSequencer } from './SequencerContext';
import type { Pattern } from './types';

const categories = getCategorizedPatterns(
  patternsData.patterns as Pattern[]
);

/**
 * Header section with logo, BPM, play/stop, kit and
 * pattern selectors.
 */
function TransportControlsInner() {
  const { state, actions } = useSequencer();
  const {
    isPlaying, bpm, currentKit,
    currentPattern, isLoaded,
  } = state;
  const {
    togglePlay, setBpm, setKit, setPattern,
  } = actions;

  return (
    <header className="bg-neutral-950 safe-area-top safe-area-x border-b border-neutral-800 pb-3 lg:pb-4 space-y-2 lg:space-y-4">
      {/* Row 1: Logo + BPM + Play */}
      <div className="flex justify-between items-center lg:items-end">
        <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
          XOX
        </h1>
        <div className="flex gap-2 lg:gap-4 items-center lg:items-end">
          <TempoController bpm={bpm} setBpm={setBpm} />
          <button
            onClick={togglePlay}
            disabled={!isLoaded}
            className={`px-4 lg:px-8 py-2 rounded-full font-bold text-sm lg:text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${isPlaying
              ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
              : 'bg-orange-600 hover:bg-orange-700 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
              } ${!isLoaded ? 'opacity-50 cursor-wait' : ''}`}
          >
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
          <FillButton />
          <SettingsPopover />
        </div>
      </div>
      {/* Row 2: Kit + Pattern */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4 pt-2 lg:pt-0">
        <GlobalControls />
        <div className="bg-neutral-900/50 p-2 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
          <label
            htmlFor="kit-select"
            className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold"
          >
            Drum Kit
          </label>
          <select
            id="kit-select"
            value={currentKit.id}
            onChange={(e) => {
              const kit = kitsData.kits.find(
                k => k.id === e.target.value
              );
              if (kit) setKit(kit);
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded p-1 lg:p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 hover:border-neutral-600 transition-colors"
          >
            {kitsData.kits.map(k => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-neutral-900/50 p-2 border border-neutral-800 rounded-lg lg:rounded-xl shadow-inner">
          <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block font-bold">
            Pattern
          </span>
          <PatternPicker
            categories={categories}
            currentPattern={currentPattern}
            onSelect={setPattern}
          />
        </div>
      </div>
    </header>
  );
}

const TransportControls = memo(TransportControlsInner);
export default TransportControls;
```

- [ ] **Step 4: Fix Space bar handler in
SequencerContext.tsx**

In `src/app/SequencerContext.tsx`, find the Space bar handler
(the `useEffect` starting around line 443). Replace the tag
check:

```typescript
// Before:
const tag =
  (event.target as HTMLElement)?.tagName;
if (
  tag === 'INPUT' ||
  tag === 'TEXTAREA' ||
  tag === 'SELECT'
) return;

// After:
const target = event.target as HTMLElement;
const tag = target?.tagName;
if (
  tag === 'INPUT' ||
  tag === 'TEXTAREA' ||
  tag === 'SELECT'
) return;
if (target?.closest('[role="dialog"]')) return;
```

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: All pass.

- [ ] **Step 6: Commit**

```
git add src/app/TransportControls.tsx \
  src/app/SequencerContext.tsx \
  src/__tests__/TransportControls.test.tsx
git commit -m "Wire PatternPicker into TransportControls

Replace pattern <select> with PatternPicker modal.
Suppress Space bar playback toggle inside dialogs."
```

---

### Task 6: Lint, build, and visual verification

**Why:** Final verification before the branch is ready.

**Files:** None (verification only)

- [ ] **Step 1: Run linter**

Run: `npm run lint`

Expected: Zero errors.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Builds successfully.

- [ ] **Step 3: Start dev server and verify in browser**

Run: `npm run dev`

Verify in browser:
1. Pattern trigger button shows current pattern name
2. Clicking opens centered modal with backdrop
3. Category pills are alphabetically sorted, "Other" last
4. Clicking a category shows patterns in columns-first grid
5. Active pattern highlighted in orange
6. Clicking a pattern changes the sound immediately
7. Modal stays open after selection
8. Escape closes the modal
9. Backdrop click closes the modal
10. X button closes the modal
11. "Custom" shown after editing a step, no category
    pre-selected on reopen
12. Space bar does NOT toggle playback when focused
    inside the modal
13. Mobile: pills wrap, grid scrolls independently

- [ ] **Step 4: Commit any fixes from visual verification**

If any visual issues are found, fix and commit:

```
git add -A
git commit -m "Fix visual issues from browser testing"
```

- [ ] **Step 5: Shut down dev server**
