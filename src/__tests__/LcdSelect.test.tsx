import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { DROPDOWN_HINT_DELAY_MS } from '../app/constants';
import LcdSelect from '../app/LcdSelect';

const OPTIONS = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'direct-start', label: 'Direct start' },
  { value: 'direct-jump', label: 'Direct jump' },
];

function setup(value = 'sequential') {
  const onChange = vi.fn();
  render(
    <LcdSelect
      aria-label="Mode"
      value={value}
      options={OPTIONS}
      onChange={onChange}
    />
  );
  const key = screen.getByRole('combobox', { name: 'Mode' });
  return { key, onChange };
}

/** The highlighted row, as announced to screen readers. */
function activeOption(key: HTMLElement) {
  const id = key.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

describe('LcdSelect', () => {
  it('shows the chosen label and starts closed', () => {
    const { key } = setup('direct-start');
    expect(key).toHaveTextContent('Direct start');
    expect(key).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens on click and marks the chosen row', () => {
    const { key } = setup('direct-jump');
    fireEvent.click(key);
    expect(key).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('option', { name: 'Direct jump' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(activeOption(key)).toHaveTextContent('Direct jump');
  });

  it('picks a clicked row and closes', () => {
    const { key, onChange } = setup();
    fireEvent.click(key);
    fireEvent.click(
      screen.getByRole('option', { name: 'Direct start' })
    );
    expect(onChange).toHaveBeenCalledWith('direct-start');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not call onChange for the current value', () => {
    const { key, onChange } = setup();
    fireEvent.click(key);
    fireEvent.click(
      screen.getByRole('option', { name: 'Sequential' })
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens with ArrowDown, moves, and picks with Enter', () => {
    const { key, onChange } = setup();
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    // Stops at the last row.
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    expect(activeOption(key)).toHaveTextContent('Direct jump');
    fireEvent.keyDown(key, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('direct-jump');
  });

  it('Home, End and Space pick from the ends', () => {
    const { key, onChange } = setup('direct-start');
    fireEvent.keyDown(key, { key: 'Enter' });
    fireEvent.keyDown(key, { key: 'End' });
    expect(activeOption(key)).toHaveTextContent('Direct jump');
    fireEvent.keyDown(key, { key: 'Home' });
    fireEvent.keyDown(key, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith('sequential');
  });

  it('typing jumps to a matching row', () => {
    const { key } = setup();
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    fireEvent.keyDown(key, { key: 'd' });
    expect(activeOption(key)).toHaveTextContent('Direct start');
    // The same letter again cycles to the next match.
    fireEvent.keyDown(key, { key: 'd' });
    expect(activeOption(key)).toHaveTextContent('Direct jump');
  });

  it('Escape closes without picking or reaching the page', () => {
    const pageKeys = vi.fn();
    document.addEventListener('keydown', pageKeys);
    const { key, onChange } = setup();
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    fireEvent.keyDown(key, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(pageKeys).not.toHaveBeenCalled();
    document.removeEventListener('keydown', pageKeys);
  });

  it('leaves Space to the page while closed', () => {
    const pageKeys = vi.fn();
    document.addEventListener('keydown', pageKeys);
    const { key } = setup();
    fireEvent.keyDown(key, { key: ' ', code: 'Space' });
    expect(pageKeys).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();
    document.removeEventListener('keydown', pageKeys);
  });

  it('closes on a press outside', () => {
    const { key } = setup();
    fireEvent.click(key);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not open when disabled', () => {
    const onChange = vi.fn();
    render(
      <LcdSelect
        aria-label="Mode"
        value="sequential"
        options={OPTIONS}
        onChange={onChange}
        disabled
      />
    );
    const key = screen.getByRole('combobox', { name: 'Mode' });
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('LcdSelect row help', () => {
  const HINTED = OPTIONS.map(o => ({
    ...o, hint: `Help for ${o.label}`,
  }));

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupHinted() {
    vi.useFakeTimers();
    render(
      <LcdSelect
        aria-label="Mode"
        value="sequential"
        options={HINTED}
        onChange={vi.fn()}
      />
    );
    return screen.getByRole('combobox', { name: 'Mode' });
  }

  const hint = () => screen.queryByTestId('lcd-select-hint');

  it('does not show help just because the list opened', () => {
    const key = setupHinted();
    fireEvent.click(key);
    act(() => vi.advanceTimersByTime(DROPDOWN_HINT_DELAY_MS * 2));
    expect(hint()).toBeNull();
  });

  it('shows a hovered row\'s help after a rest', () => {
    const key = setupHinted();
    fireEvent.click(key);
    fireEvent.pointerMove(
      screen.getByRole('option', { name: /Direct start/ }),
      { pointerType: 'mouse' },
    );
    expect(hint()).toBeNull();
    act(() => vi.advanceTimersByTime(DROPDOWN_HINT_DELAY_MS));
    expect(hint()).toHaveTextContent('Help for Direct start');
    // Moving on shows the next row's help at once.
    fireEvent.pointerMove(
      screen.getByRole('option', { name: /Direct jump/ }),
      { pointerType: 'mouse' },
    );
    expect(hint()).toHaveTextContent('Help for Direct jump');
    fireEvent.pointerLeave(screen.getByRole('listbox'));
    expect(hint()).toBeNull();
  });

  it('shows help for a row reached with the arrows', () => {
    const key = setupHinted();
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    fireEvent.keyDown(key, { key: 'ArrowDown' });
    act(() => vi.advanceTimersByTime(DROPDOWN_HINT_DELAY_MS));
    expect(hint()).toHaveTextContent('Help for Direct start');
  });

  it('describes each row with its help for screen readers', () => {
    const key = setupHinted();
    fireEvent.click(key);
    expect(
      screen.getByRole('option', { name: /Direct jump/ })
    ).toHaveAccessibleDescription('Help for Direct jump');
  });
});
