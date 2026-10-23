import { act, render, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { useBlurOnEscape } from '../../app/hooks/useBlurOnEscape';

function Harness() {
  useBlurOnEscape();
  return (
    <>
      <button type="button">key</button>
      <input aria-label="bpm" type="number" />
      <input aria-label="volume" type="range" />
    </>
  );
}

function pointerDown(el: HTMLElement) {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

function press(key: string) {
  act(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true })
    );
    vi.runAllTimers();
  });
}

describe('useBlurOnEscape', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<Harness />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops focus from a clicked button on Esc', () => {
    const button = screen.getByText('key');
    pointerDown(button);
    button.focus();
    press('Escape');
    expect(document.activeElement).not.toBe(button);
  });

  it('drops focus from a clicked slider on Esc', () => {
    const slider = screen.getByLabelText('volume');
    pointerDown(slider);
    slider.focus();
    press('Escape');
    expect(document.activeElement).not.toBe(slider);
  });

  it('keeps focus when the keyboard was used last', () => {
    const button = screen.getByText('key');
    pointerDown(button);
    button.focus();
    press('Tab');
    press('Escape');
    expect(document.activeElement).toBe(button);
  });

  it('ignores modifier keys when deciding', () => {
    const button = screen.getByText('key');
    pointerDown(button);
    button.focus();
    press('Shift');
    press('Escape');
    expect(document.activeElement).not.toBe(button);
  });

  it('leaves text fields focused', () => {
    const field = screen.getByLabelText('bpm');
    pointerDown(field);
    field.focus();
    press('Escape');
    expect(document.activeElement).toBe(field);
  });

  it('blurs the opener focus returns to on close', () => {
    // A menu item that, like our menus, sends focus
    // back to its opener when Esc closes it.
    const opener = screen.getByText('key');
    const slider = screen.getByLabelText('volume');
    pointerDown(opener);
    slider.focus();
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') opener.focus();
    });
    press('Escape');
    expect(document.activeElement).not.toBe(opener);
    expect(document.activeElement).not.toBe(slider);
  });
});
