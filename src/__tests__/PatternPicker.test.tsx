import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PatternPicker from '../app/PatternPicker';
import type { Pattern } from '../app/types';
import type { PatternCategory } from '../app/patternUtils';

// --------------- fixtures ---------------

const emptySteps = {
  ac: '', bd: '', sd: '', ch: '', oh: '',
  cy: '', ht: '', mt: '', lt: '', rs: '', cp: '', cb: '',
};

const funkPatterns: Pattern[] = [
  {
    id: 'funk-1',
    name: 'Funk 1',
    category: 'Funk',
    steps: { ...emptySteps },
  },
  {
    id: 'funk-2',
    name: 'Funk 2',
    category: 'Funk',
    steps: { ...emptySteps },
  },
];

const rockPatterns: Pattern[] = [
  {
    id: 'rock-1',
    name: 'Rock 1',
    category: 'Rock',
    steps: { ...emptySteps },
  },
];

const categories: PatternCategory[] = [
  { category: 'Funk', patterns: funkPatterns },
  { category: 'Rock', patterns: rockPatterns },
];

const customPattern: Pattern = {
  id: 'custom',
  name: 'Custom',
  steps: { ...emptySteps },
};

// --------------- helpers ---------------

function renderPicker(
  currentPattern: Pattern = funkPatterns[0],
  onSelect = vi.fn(),
) {
  return render(
    <PatternPicker
      categories={categories}
      currentPattern={currentPattern}
      onSelect={onSelect}
    />,
  );
}

// --------------- tests ---------------

describe('PatternPicker', () => {
  describe('trigger button', () => {
    it('shows current pattern name', () => {
      renderPicker(funkPatterns[0]);
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveTextContent('Funk 1');
    });

    it('shows Custom for custom pattern', () => {
      renderPicker(customPattern);
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveTextContent('Custom');
    });
  });

  describe('modal open/close', () => {
    it('dialog hidden initially', () => {
      renderPicker();
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });

    it('opens on trigger click', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.keyboard('{Escape}');
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });

    it('closes on backdrop click', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.click(
        screen.getByTestId('pattern-picker-backdrop'),
      );
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });
  });

  describe('category pills', () => {
    it('renders all category pills', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(
        screen.getByRole('button', { name: 'Funk' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Rock' }),
      ).toBeInTheDocument();
    });

    it('auto-selects active category on open', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      // Funk patterns should be visible
      expect(
        screen.getByRole('option', { name: 'Funk 1' }),
      ).toBeInTheDocument();
    });

    it('does not pre-select category for Custom pattern',
      async () => {
        const user = userEvent.setup();
        renderPicker(customPattern);
        await user.click(
          screen.getByRole('button', { name: /pattern/i }),
        );
        // No pattern options visible — no category selected
        expect(
          screen.queryByRole('option'),
        ).not.toBeInTheDocument();
      },
    );

    it('clicking a pill shows its patterns', async () => {
      const user = userEvent.setup();
      renderPicker(customPattern);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Rock' }),
      );
      expect(
        screen.getByRole('option', { name: 'Rock 1' }),
      ).toBeInTheDocument();
    });

    it('has-active pill when category contains active pattern'
      + ' but is not selected', async () => {
        const user = userEvent.setup();
        // funk-1 is active; open and switch to Rock
        renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button', { name: /pattern/i }),
        );
        await user.click(
          screen.getByRole('button', { name: 'Rock' }),
        );
        const funkPill = screen.getByRole('button', {
          name: 'Funk',
        });
        expect(
          funkPill.getAttribute('data-has-active'),
        ).toBe('true');
      },
    );

    it('selected pill does not have data-has-active',
      async () => {
        const user = userEvent.setup();
        renderPicker(funkPatterns[0]);
        await user.click(
          screen.getByRole('button', { name: /pattern/i }),
        );
        const funkPill = screen.getByRole('button', {
          name: 'Funk',
        });
        // Funk is both selected and active — no has-active flag
        expect(
          funkPill.getAttribute('data-has-active'),
        ).toBeNull();
      },
    );
  });

  describe('pattern selection', () => {
    it('calls onSelect with the chosen pattern', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderPicker(funkPatterns[0], onSelect);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.click(
        screen.getByRole('option', { name: 'Funk 2' }),
      );
      expect(onSelect).toHaveBeenCalledWith(funkPatterns[1]);
    });

    it('modal stays open after selection', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.click(
        screen.getByRole('option', { name: 'Funk 2' }),
      );
      expect(
        screen.getByRole('dialog'),
      ).toBeInTheDocument();
    });

    it('active pattern has aria-selected=true', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      const activeOption = screen.getByRole('option', {
        name: 'Funk 1',
      });
      expect(activeOption).toHaveAttribute(
        'aria-selected', 'true',
      );
    });

    it('inactive patterns have aria-selected=false', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      const inactiveOption = screen.getByRole('option', {
        name: 'Funk 2',
      });
      expect(inactiveOption).toHaveAttribute(
        'aria-selected', 'false',
      );
    });
  });

  describe('footer', () => {
    it('shows active pattern name in footer', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(
        screen.getByTestId('active-label'),
      ).toHaveTextContent('Funk 1');
    });

    it('shows Custom in footer for custom pattern', async () => {
      const user = userEvent.setup();
      renderPicker(customPattern);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(
        screen.getByTestId('active-label'),
      ).toHaveTextContent('Custom');
    });
  });

  describe('scrollbar', () => {
    it('pattern grid has hide-scrollbar class', async () => {
      const user = userEvent.setup();
      renderPicker(funkPatterns[0]);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      const option = screen.getByRole('option', {
        name: 'Funk 1',
      });
      const scrollContainer =
        option.closest('.overflow-y-auto');
      expect(scrollContainer).toHaveClass(
        'hide-scrollbar',
      );
    });
  });
});
