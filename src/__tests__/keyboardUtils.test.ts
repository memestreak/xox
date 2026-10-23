import { afterEach, describe, expect, it } from 'vitest';
import {
  isFormFieldTarget,
  isModalDialogOpen,
  shouldIgnoreShortcut,
} from '../app/keyboardUtils';

function keydownFrom(target: EventTarget): KeyboardEvent {
  let captured: KeyboardEvent | null = null;
  const listener = (e: Event) => {
    captured = e as KeyboardEvent;
  };
  document.addEventListener('keydown', listener);
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'x', bubbles: true })
  );
  document.removeEventListener('keydown', listener);
  return captured!;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('keyboardUtils', () => {
  it.each(['input', 'textarea', 'select'])(
    'treats a %s as a form field', (tag) => {
      const el = document.createElement(tag);
      expect(isFormFieldTarget(el)).toBe(true);
    }
  );

  it('does not treat a button or null as a form field', () => {
    expect(
      isFormFieldTarget(document.createElement('button'))
    ).toBe(false);
    expect(isFormFieldTarget(null)).toBe(false);
  });

  it('detects an open dialog only', () => {
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    expect(isModalDialogOpen()).toBe(false);
    dialog.setAttribute('open', '');
    expect(isModalDialogOpen()).toBe(true);
  });

  it('ignores shortcuts from form fields', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(shouldIgnoreShortcut(keydownFrom(input))).toBe(true);
  });

  it('ignores shortcuts while a dialog is open', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    expect(
      shouldIgnoreShortcut(keydownFrom(document.body))
    ).toBe(true);
  });

  it('allows shortcuts from the page otherwise', () => {
    expect(
      shouldIgnoreShortcut(keydownFrom(document.body))
    ).toBe(false);
  });
});
