import { getChooserClickAway } from './hooks/useChooserClickAwaySetting';

/**
 * Shared checks for the app's global keyboard shortcuts.
 */

/** True when the event target is a text field, select or textarea. */
export function isFormFieldTarget(
  target: EventTarget | null
): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return (
    tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
  );
}

/**
 * True while a modal <dialog> (Help, Settings) is open.
 * Shortcuts for the page behind it should not fire then.
 */
export function isModalDialogOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector('dialog[open]') !== null;
}

/**
 * True when a global shortcut should leave this key
 * press alone: focus is in a form field, or a modal
 * dialog is open.
 */
export function shouldIgnoreShortcut(
  e: KeyboardEvent
): boolean {
  return isFormFieldTarget(e.target) || isModalDialogOpen();
}

/**
 * True while a menu (track, grid, gear), an open
 * dropdown list (LcdSelect) or the step editor is open. These close on Esc themselves, so a
 * page-level Esc or shortcut should wait for them.
 */
export function isPopupOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector(
    '[role="menu"], [role="dialog"][aria-modal="true"],'
    + ' [data-select-open]'
  ) !== null;
}

/** Marks the pattern chooser's drawer while it is open. */
export const PATTERN_CHOOSER_OPEN_ATTR =
  'data-pattern-chooser-open';

/**
 * True while the pattern chooser is open. Esc closes it
 * before it clears the step selection.
 */
export function isPatternChooserOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector(
    `[${PATTERN_CHOOSER_OPEN_ATTR}]`
  ) !== null;
}

/**
 * Marks the area a click can land in without closing the
 * pattern chooser: the centered column with the transport,
 * the chooser and the step grid (`Sequencer.tsx`).
 */
export const CHOOSER_AREA_ATTR = 'data-chooser-area';

/**
 * True when a press on `target` should close the open
 * pattern chooser: the "Click beside the pattern chooser
 * to close it" setting is on and the press lands beside
 * the app's column. Such a press does only that, like
 * Escape, so the step selection waits for the next one.
 */
export function isChooserClickAway(
  target: EventTarget | null,
): boolean {
  if (!isPatternChooserOpen() || !getChooserClickAway()) {
    return false;
  }
  if (!(target instanceof Element)) return false;
  return target.closest(`[${CHOOSER_AREA_ATTR}]`) === null;
}
