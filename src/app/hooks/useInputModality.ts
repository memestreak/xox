"use client";

import { useEffect } from 'react';

/**
 * Keys that mean the user is moving around with the
 * keyboard. Other keys (Space, Esc, letter shortcuts)
 * are commands a mouse user presses too, so they don't
 * switch the focus ring back on.
 */
const NAVIGATION_KEYS = new Set([
  'Tab', 'Enter',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
]);

/**
 * Chromium shows a focus ring on the focused control as
 * soon as any key is pressed. A clicked button keeps
 * focus, and closing a menu or dialog puts focus back on
 * its opener, so a mouse user who then presses Space
 * (play/stop) or Esc sees that button outlined.
 *
 * This marks `<html>` with `data-input="pointer"` after
 * a click or tap, and clears the mark when a navigation
 * key is pressed. `globals.css` hides focus rings while
 * the mark is set. Focus itself never moves, so Tab
 * still continues from where the user was.
 *
 * Mount once, near the root of the app.
 */
export function useInputModality(): void {
  useEffect(() => {
    const root = document.documentElement;

    const handlePointerDown = () => {
      root.dataset.input = 'pointer';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (NAVIGATION_KEYS.has(e.key)) {
        delete root.dataset.input;
      }
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
      delete root.dataset.input;
    };
  }, []);
}
