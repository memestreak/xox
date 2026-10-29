import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import PatternPicker from '../app/PatternPicker';
import type { Pattern } from '../app/types';
import { TRACK_IDS } from '../app/types';
import type { PatternCategory } from '../app/patternUtils';
import { interfacePrefs } from '../app/preferences';

// --------------- fixtures ---------------

const emptyTracks = Object.fromEntries(
  TRACK_IDS.map(id => [id, { steps: '0'.repeat(16) }])
) as Pattern['tracks'];

const funkPatterns: Pattern[] = [
  {
    id: 'funk-1',
    name: 'Funk 1',
    category: 'Funk',
    tracks: { ...emptyTracks },
  },
  {
    id: 'funk-2',
    name: 'Funk 2',
    category: 'Funk',
    tracks: { ...emptyTracks },
  },
];

const rockPatterns: Pattern[] = [
  {
    id: 'rock-1',
    name: 'Rock 1',
    category: 'Rock',
    tracks: { ...emptyTracks },
  },
];

const categories: PatternCategory[] = [
  { category: 'Funk', patterns: funkPatterns },
  { category: 'Rock', patterns: rockPatterns },
];

// --------------- helpers ---------------

function renderPicker(
  selectedPatternId: string = funkPatterns[0].id,
  onSelect = vi.fn(),
  pendingPatternId: string | null = null,
) {
  // Like Sequencer: the app's column holds the picker,
  // and the page beside it is outside.
  return render(
    <>
      <div data-testid="beside">beside</div>
      <div data-chooser-area>
        <PatternPicker
          categories={categories}
          selectedPatternId={selectedPatternId}
          pendingPatternId={pendingPatternId}
          onSelect={onSelect}
        >
          {({ trigger, drawer }) => (
            <>
              {trigger}
              {drawer}
              <div data-testid="grid">grid</div>
            </>
          )}
        </PatternPicker>
      </div>
    </>,
  );
}

function getDrawer() {
  return screen.getByTestId('pattern-drawer');
}

// --------------- tests ---------------

describe('PatternPicker', () => {
  describe('trigger button', () => {
    it('shows current pattern name', () => {
      renderPicker('funk-1');
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveTextContent('Funk 1');
    });

    it('shows Custom for custom pattern', () => {
      renderPicker('custom');
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveTextContent('Custom');
    });

    it('shows an edited preset with an asterisk', () => {
      renderPicker('funk-2*');
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveTextContent('Funk 2*');
    });

    it('has aria-expanded=false initially', () => {
      renderPicker();
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveAttribute('aria-expanded', 'false');
    });

    it('has aria-expanded=true when open', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('cued pattern light', () => {
    it('shows no cue light when nothing is cued', () => {
      renderPicker('funk-1');
      expect(screen.queryByTestId('pattern-cue-led'))
        .not.toBeInTheDocument();
    });

    it('blinks a light on the trigger and names the'
      + ' cued pattern', () => {
      renderPicker('funk-1', vi.fn(), 'funk-2');
      expect(screen.getByTestId('pattern-cue-led'))
        .toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Pattern, Funk 2 cued for the next bar',
        }),
      ).toBeInTheDocument();
    });

    it('blinks a red LED on the cued row', async () => {
      const user = userEvent.setup();
      renderPicker('funk-1', vi.fn(), 'funk-2');
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      const cued = screen.getByRole('option', {
        name: 'Funk 2, cued',
      });
      const led = cued.querySelector('.ss-led');
      expect(led).toHaveClass('ss-led-cue');
      expect(led).toHaveClass('animate-temp-blink');
      // The playing pattern stays marked (the amber bar),
      // with no LED of its own.
      const active = screen.getByRole('option', {
        name: 'Funk 1',
      });
      expect(active).toHaveAttribute('aria-selected', 'true');
      expect(active.querySelector('.ss-led'))
        .not.toHaveClass('ss-led-cue');
    });
  });

  describe('drawer open/close', () => {
    it('drawer is aria-hidden initially', () => {
      renderPicker();
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
    });

    it('opens on trigger click', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.keyboard('{Escape}');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
    });

    it('closes on second trigger click', async () => {
      const user = userEvent.setup();
      renderPicker();
      const trigger = screen.getByRole('button', {
        name: /pattern/i,
      });
      await user.click(trigger);
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
      await user.click(trigger);
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
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
      renderPicker('funk-1');
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      expect(
        screen.getByRole('option', { name: 'Funk 1' }),
      ).toBeInTheDocument();
    });

    it('does not pre-select category for Custom pattern',
      async () => {
        const user = userEvent.setup();
        renderPicker('custom');
        await user.click(
          screen.getByRole('button', { name: /pattern/i }),
        );
        expect(
          screen.queryByRole('option'),
        ).not.toBeInTheDocument();
      },
    );

    it('clicking a pill shows its patterns', async () => {
      const user = userEvent.setup();
      renderPicker('custom');
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
        renderPicker('funk-1');
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
        renderPicker('funk-1');
        await user.click(
          screen.getByRole('button', { name: /pattern/i }),
        );
        const funkPill = screen.getByRole('button', {
          name: 'Funk',
        });
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
      renderPicker('funk-1', onSelect);
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.click(
        screen.getByRole('option', { name: 'Funk 2' }),
      );
      expect(onSelect).toHaveBeenCalledWith(funkPatterns[1]);
    });

    it('drawer stays open after selection', async () => {
      const user = userEvent.setup();
      renderPicker('funk-1');
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await user.click(
        screen.getByRole('option', { name: 'Funk 2' }),
      );
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
    });

    it('active pattern has aria-selected=true', async () => {
      const user = userEvent.setup();
      renderPicker('funk-1');
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
      renderPicker('funk-1');
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

  describe('scrollbar', () => {
    it('pattern grid has hide-scrollbar class', async () => {
      const user = userEvent.setup();
      renderPicker('funk-1');
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

  describe('keyboard', () => {
    afterEach(() => {
      document.querySelectorAll('dialog, [role="menu"]')
        .forEach(el => el.remove());
      delete document.documentElement.dataset.input;
    });

    const option = (name: string) =>
      screen.getByRole('option', { name });
    const category = (name: string) =>
      screen.getByRole('button', { name });

    it('P opens on the current pattern', async () => {
      const user = userEvent.setup();
      renderPicker('funk-2');
      await user.keyboard('p');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
      expect(option('Funk 2')).toHaveFocus();
    });

    it('P again closes and leaves the Pattern key alone', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.keyboard('p');
      await user.keyboard('p');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
      expect(
        screen.getByRole('button', { name: /pattern/i }),
      ).not.toHaveFocus();
      expect(document.body).toHaveFocus();
    });

    it('closing a P-open restores focus and hidden rings', async () => {
      const user = userEvent.setup();
      renderPicker();
      const other = document.createElement('button');
      document.body.appendChild(other);
      other.focus();
      document.documentElement.dataset.input = 'pointer';
      await user.keyboard('p');
      expect(document.documentElement.dataset.input)
        .toBeUndefined();
      await user.keyboard('{Escape}');
      expect(other).toHaveFocus();
      expect(document.documentElement.dataset.input)
        .toBe('pointer');
      other.remove();
    });

    it('Enter on the Pattern key opens and Esc returns there', async () => {
      const user = userEvent.setup();
      renderPicker();
      const trigger = screen.getByRole('button', {
        name: /pattern/i,
      });
      trigger.focus();
      await user.keyboard('{Enter}');
      expect(option('Funk 1')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(trigger).toHaveFocus();
    });

    it('P opens on the first category for Custom', async () => {
      const user = userEvent.setup();
      renderPicker('custom');
      await user.keyboard('p');
      expect(category('Funk')).toHaveFocus();
    });

    it('P opens on the edited preset', async () => {
      const user = userEvent.setup();
      renderPicker('rock-1*');
      await user.keyboard('p');
      // The cursor starts there, but it isn't shown as
      // the selected (playing) pattern.
      expect(option('Rock 1')).toHaveFocus();
      expect(option('Rock 1')).toHaveAttribute(
        'aria-selected', 'false',
      );
    });

    it('P opens on the cued pattern', async () => {
      const user = userEvent.setup();
      renderPicker('funk-1', vi.fn(), 'rock-1');
      await user.keyboard('p');
      expect(option('Rock 1, cued')).toHaveFocus();
    });

    it('ignores P with a modifier', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.keyboard('{Meta>}p{/Meta}');
      await user.keyboard('{Control>}p{/Control}');
      await user.keyboard('{Shift>}p{/Shift}');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
    });

    it('ignores P while a dialog or menu is open', async () => {
      const user = userEvent.setup();
      renderPicker();
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      document.body.appendChild(dialog);
      await user.keyboard('p');
      dialog.remove();
      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      document.body.appendChild(menu);
      await user.keyboard('p');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
    });

    it('P shows the focus ring after a click', async () => {
      const user = userEvent.setup();
      renderPicker();
      document.documentElement.dataset.input = 'pointer';
      await user.keyboard('p');
      expect(document.documentElement.dataset.input)
        .toBeUndefined();
    });

    it('arrows move through patterns and categories', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      renderPicker('funk-1', onSelect);
      await user.keyboard('p');
      await user.keyboard('{ArrowDown}');
      expect(option('Funk 2')).toHaveFocus();
      // Wraps to the first pattern
      await user.keyboard('{ArrowDown}');
      expect(option('Funk 1')).toHaveFocus();
      // Up from the top row goes to the category
      await user.keyboard('{ArrowUp}');
      expect(category('Funk')).toHaveFocus();
      // The list follows the cursor; nothing loads
      await user.keyboard('{ArrowRight}');
      expect(category('Rock')).toHaveFocus();
      expect(option('Rock 1')).toBeInTheDocument();
      await user.keyboard('{ArrowDown}');
      expect(option('Rock 1')).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('Enter picks the pattern and stays open', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      renderPicker('funk-1', onSelect);
      await user.keyboard('p');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(funkPatterns[1]);
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
    });

    it('Enter on a category moves into its list', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      renderPicker('custom', onSelect);
      await user.keyboard('p');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{Enter}');
      expect(option('Rock 1')).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('Space never picks a pattern', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      renderPicker('funk-1', onSelect);
      await user.keyboard('p');
      await user.keyboard(' ');
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('first arrow after a mouse open shows the cursor', async () => {
      const user = userEvent.setup();
      renderPicker('funk-2');
      await user.click(
        screen.getByRole('button', { name: /pattern/i }),
      );
      await waitFor(() =>
        expect(
          getDrawer().querySelector('[tabindex="-1"]'),
        ).toHaveFocus(),
      );
      await user.keyboard('{ArrowDown}');
      expect(option('Funk 2')).toHaveFocus();
    });

    it('Esc waits for a dialog on top', async () => {
      const user = userEvent.setup();
      renderPicker();
      await user.keyboard('p');
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      document.body.appendChild(dialog);
      await user.keyboard('{Escape}');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
      dialog.remove();
      await user.keyboard('{Escape}');
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
    });

    it('marks the drawer while open', async () => {
      const user = userEvent.setup();
      renderPicker();
      expect(getDrawer())
        .not.toHaveAttribute('data-pattern-chooser-open');
      await user.keyboard('p');
      expect(getDrawer())
        .toHaveAttribute('data-pattern-chooser-open');
    });
  });
  describe('click beside', () => {
    const openByMouse = async (
      user: ReturnType<typeof userEvent.setup>,
    ) => {
      const trigger = screen.getByRole('button', {
        name: /pattern/i,
      });
      await user.click(trigger);
      // A mouse open focuses the panel on the next frame.
      await waitFor(() => {
        expect(
          screen.getByRole('group', {
            name: 'Categories and patterns',
          }),
        ).toHaveFocus();
      });
      return trigger;
    };

    it('closes like Escape and returns focus to the key', async () => {
      const user = userEvent.setup();
      renderPicker();
      const trigger = await openByMouse(user);
      await user.click(screen.getByTestId('beside'));
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
      expect(trigger).toHaveFocus();
    });

    it('stays open for clicks in the column', async () => {
      const user = userEvent.setup();
      renderPicker();
      await openByMouse(user);
      await user.click(screen.getByTestId('grid'));
      await user.click(screen.getByText('Funk 2'));
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
    });

    it('ignores a right-click beside', async () => {
      const user = userEvent.setup();
      renderPicker();
      await openByMouse(user);
      await user.pointer({
        keys: '[MouseRight]',
        target: screen.getByTestId('beside'),
      });
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
    });

    it('waits for a menu on top', async () => {
      const user = userEvent.setup();
      renderPicker();
      await openByMouse(user);
      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      document.body.appendChild(menu);
      // The menu closes itself on the press.
      const beside = screen.getByTestId('beside');
      beside.addEventListener(
        'pointerdown', () => menu.remove(), { once: true },
      );
      await user.click(beside);
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
      await user.click(beside);
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'true',
      );
    });

    it('stays open when the setting is off', async () => {
      interfacePrefs.update({ chooserClickAway: false });
      const user = userEvent.setup();
      renderPicker();
      await openByMouse(user);
      await user.click(screen.getByTestId('beside'));
      expect(getDrawer()).toHaveAttribute(
        'aria-hidden', 'false',
      );
    });
  });
});
