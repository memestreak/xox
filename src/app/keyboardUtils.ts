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
