import { afterEach, describe, expect, it } from 'vitest';
import {
  isFormFieldTarget,
  isModalDialogOpen,
  isPatternChooserOpen,
  isPopupOpen,
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

  it('sees an open menu or step editor as a popup', () => {
    expect(isPopupOpen()).toBe(false);
    document.body.innerHTML = '<div role="menu"></div>';
    expect(isPopupOpen()).toBe(true);
    document.body.innerHTML =
      '<div role="dialog" aria-modal="true"></div>';
    expect(isPopupOpen()).toBe(true);
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(isPopupOpen()).toBe(false);
  });

  it('sees the open pattern chooser by its attribute', () => {
    expect(isPatternChooserOpen()).toBe(false);
    document.body.innerHTML =
      '<div data-pattern-chooser-open></div>';
    expect(isPatternChooserOpen()).toBe(true);
  });
});
