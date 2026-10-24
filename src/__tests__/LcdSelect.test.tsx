import {
  fireEvent, render, screen,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
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
