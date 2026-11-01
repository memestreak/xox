/**
 * Where the user dragged the step editor to, so the next
 * one opens there too. View state for this page load
 * only: not saved, not in the pattern. null = open by
 * the step.
 */
export interface EditorPosition {
  left: number;
  top: number;
}

let position: EditorPosition | null = null;

export function getEditorPosition(): EditorPosition | null {
  return position;
}

export function setEditorPosition(
  next: EditorPosition | null
): void {
  position = next;
}

/** Keep a box of this size inside the window (8 px margin). */
export function clampToWindow(
  pos: EditorPosition,
  width: number,
  height: number,
): EditorPosition {
  const margin = 8;
  return {
    left: Math.max(
      margin,
      Math.min(pos.left, window.innerWidth - width - margin)
    ),
    top: Math.max(
      margin,
      Math.min(pos.top, window.innerHeight - height - margin)
    ),
  };
}
