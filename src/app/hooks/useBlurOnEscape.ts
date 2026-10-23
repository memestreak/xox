"use client";

import { useEffect } from 'react';

/**
 * Keys that don't count as keyboard use on their own.
 * Escape is here because pressing it is how a mouse user
 * closes a menu; it shouldn't switch on the focus ring.
 */
const IGNORED_KEYS = new Set([
  'Escape', 'Shift', 'Control', 'Alt', 'Meta',
]);

/** Input types that take typed text (left alone). */
const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'radio', 'range',
  'reset', 'submit',
]);

/** True for fields the user types into. */
function isTextEntry(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  return (
    el instanceof HTMLInputElement
    && !NON_TEXT_INPUT_TYPES.has(el.type)
  );
}

/**
 * Chromium shows a focus ring on the focused control as
 * soon as any key is pressed, Escape included. So after
 * clicking a button (or closing a menu or dialog with
 * Esc, which puts focus back on its opener) the button
 * stays outlined.
 *
 * This drops that focus when Escape is pressed and the
 * last real input was the mouse or touch. If the user
 * was using the keyboard, focus and its ring stay where
 * they are so keyboard navigation isn't lost.
 *
 * Mount once, near the root of the app.
 */
export function useBlurOnEscape(): void {
  useEffect(() => {
    let lastInputWasPointer = false;

    const handlePointerDown = () => {
      lastInputWasPointer = true;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!IGNORED_KEYS.has(e.key)) {
        lastInputWasPointer = false;
        return;
      }
      if (e.key !== 'Escape' || !lastInputWasPointer) {
        return;
      }
      // Wait until Escape has been handled: menus,
      // popovers and dialogs close and move focus back
      // to their opener first.
      setTimeout(() => {
        const el = document.activeElement;
        if (
          el instanceof HTMLElement
          && el !== document.body
          && !isTextEntry(el)
        ) {
          el.blur();
        }
      }, 0);
    };

    // Capture phase, so handlers that stop propagation
    // can't hide the event from us.
    window.addEventListener(
      'pointerdown', handlePointerDown, true
    );
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener(
        'pointerdown', handlePointerDown, true
      );
      window.removeEventListener(
        'keydown', handleKeyDown, true
      );
    };
  }, []);
}
