import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useInputModality } from '../../app/hooks/useInputModality';

function Harness() {
  useInputModality();
  return <button type="button">key</button>;
}

function pointerDown(el: Element) {
  act(() => {
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  });
}

function press(key: string) {
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true })
    );
  });
}

const mode = () => document.documentElement.dataset.input;

describe('useInputModality', () => {
  let unmount: () => void;

  beforeEach(() => {
    ({ unmount } = render(<Harness />));
  });

  afterEach(() => {
    unmount();
  });

  it('starts unmarked, so keyboard users see rings', () => {
    expect(mode()).toBeUndefined();
  });

  it('marks pointer input after a click', () => {
    pointerDown(screen.getByText('key'));
    expect(mode()).toBe('pointer');
  });

  it.each([' ', 'Escape', '?', 'f', 'Shift'])(
    'stays in pointer mode when %j is pressed',
    (key) => {
      const button = screen.getByText('key');
      pointerDown(button);
      button.focus();
      press(key);
      expect(mode()).toBe('pointer');
    }
  );

  it.each(['Tab', 'Enter', 'ArrowDown', 'Home'])(
    'switches rings back on when %j is pressed',
    (key) => {
      const button = screen.getByText('key');
      pointerDown(button);
      button.focus();
      press(key);
      expect(mode()).toBeUndefined();
    }
  );

  it('never moves focus', () => {
    const button = screen.getByText('key');
    pointerDown(button);
    button.focus();
    press('Escape');
    press(' ');
    expect(document.activeElement).toBe(button);
  });

  it('clears the mark on unmount', () => {
    pointerDown(screen.getByText('key'));
    unmount();
    expect(mode()).toBeUndefined();
    ({ unmount } = render(<Harness />));
  });
});
