/**
 * Text for the Help dialog: shortcuts and gestures only
 * (longer usage docs belong in the repository). Keep it
 * in sync with the shortcut handlers (usePlayback, useFillMode,
 * usePatternMode, useSelection, useMinimizedTracks,
 * PatternPicker) and pointer gestures.
 */

/**
 * One line of help. `keys` are keycaps; the tokens
 * 'mod' (⌘ or Ctrl) and 'shift' (⇧) are drawn per
 * platform, and '+' and '/' are drawn as separators.
 */
export interface HelpRow {
  keys?: string[];
  /** Pointer gesture shown after the keys, e.g. 'click'. */
  gesture?: string;
  text: string;
  /** Muted aside after the text. */
  note?: string;
}

export interface HelpSection {
  title: string;
  rows: HelpRow[];
}

export type HelpTabId = 'keys' | 'mouse' | 'touch';

export interface HelpTab {
  id: HelpTabId;
  label: string;
  sections: HelpSection[];
}

const KEYS_TAB: HelpTab = {
  id: 'keys',
  label: 'Keys',
  sections: [
    {
      title: 'Anywhere',
      rows: [
        {
          keys: ['Space'], text: 'Play / stop',
          note: '(not while typing in a text field)',
        },
        { keys: ['F'], gesture: 'hold', text: 'Fill while held' },
        { keys: ['mod', '+', 'F'], text: 'Latch fill on / off' },
        {
          keys: ['F'], gesture: 'hold + click step',
          text: 'Add a step that plays only in fills',
          note: '(also while latched)',
        },
        {
          keys: ['T'], text: 'Make next selected pattern temporary',
          note: '(while playing)',
        },
        {
          keys: ['shift', '+', 'T'], text: 'Latch temp on / off',
          note: '(every pattern you pick plays once)',
        },
        { keys: ['H'], text: 'Minimize empty tracks' },
        { keys: ['shift', '+', 'H'], text: 'Restore all tracks' },
        { keys: ['P'], text: 'Open / close the pattern chooser' },
        { keys: ['?'], text: 'Open or close this help' },
        {
          keys: ['Esc'],
          text: 'Close a popup or the pattern chooser, then clear the selection',
        },
      ],
    },
    {
      title: 'Pattern chooser',
      rows: [
        {
          keys: ['←', '→', '↑', '↓'],
          text: 'Move through categories and patterns',
        },
        {
          keys: ['Enter'], text: 'Pick the pattern',
          note: '(cued for the next bar in Sequential mode while playing)',
        },
        {
          keys: ['Home', '/', 'End'],
          text: 'First / last category or pattern',
        },
      ],
    },
    {
      title: 'With steps selected',
      rows: [
        { keys: ['Del', '/', '⌫'], text: 'Clear the steps' },
        {
          keys: ['F'],
          text: 'Cycle fill: none → fill → not fill',
        },
        { keys: ['shift', '+', 'F'], text: 'Set to not fill' },
        { keys: ['E'], text: 'Edit probability' },
        { keys: ['C'], text: 'Edit cycle (e.g. 1:2)' },
        { keys: ['R'], text: 'Reset conditions and locks' },
      ],
    },
    {
      title: 'Focused knob or slider',
      rows: [
        { keys: ['←', '→'], text: 'Fine adjust', note: '(↑ ↓ too)' },
        {
          keys: ['shift', '+', '←', '→'], text: 'Coarse adjust',
        },
        { keys: ['Home', '/', 'End'], text: 'Minimum / maximum' },
      ],
    },
  ],
};

const MOUSE_TAB: HelpTab = {
  id: 'mouse',
  label: 'Mouse',
  sections: [
    {
      title: 'Steps',
      rows: [
        { gesture: 'click', text: 'Turn a step on / off' },
        { gesture: 'drag sideways', text: 'Paint steps along a row' },
        { gesture: 'swipe up / down', text: 'Scroll through the tracks' },
        {
          gesture: 'right-click', text: 'Step editor',
          note: '(probability, cycle, fill, gain, pan)',
        },
        {
          keys: ['shift'], gesture: 'drag',
          text: 'Flip through presets for that track',
          note: '(Esc cancels)',
        },
      ],
    },
    {
      title: 'Selecting steps',
      rows: [
        { keys: ['mod'], gesture: 'click', text: 'Add or remove a step' },
        {
          keys: ['mod'], gesture: 'drag', text: 'Box-select',
          note: '(or drag from empty space)',
        },
        {
          keys: ['shift'], gesture: 'click',
          text: 'Select a block from the last step',
        },
        {
          gesture: 'click a selected step',
          text: 'Flip every selected step on / off',
        },
        {
          gesture: 'click outside the grid',
          text: 'Clear the selection',
        },
      ],
    },
    {
      title: 'Track name',
      rows: [
        { gesture: 'click', text: 'Preview the sound' },
        {
          gesture: 'right-click', text: 'Track menu',
          note: '(also ⌘-click)',
        },
        { keys: ['shift'], gesture: 'click', text: 'Clear the track' },
      ],
    },
    {
      title: 'Grid (blank area)',
      rows: [
        {
          gesture: 'right-click',
          text: 'Minimize empty tracks / Restore all tracks',
          note: '(also in the gear menu)',
        },
      ],
    },
    {
      title: 'Minimized track',
      rows: [
        {
          gesture: 'click the caret or line',
          text: 'Restore the track',
        },
        { gesture: 'click the name', text: 'Preview the sound' },
      ],
    },
    {
      title: 'Track end bar',
      rows: [
        {
          gesture: 'drag', text: 'Set the track length',
          note: '(1–64)',
        },
        {
          gesture: 'right-click', text: 'Free-run on / off',
          note: '(also ⌘-click)',
        },
      ],
    },
    {
      title: 'Knobs and volume',
      rows: [
        { gesture: 'drag', text: 'Adjust' },
        {
          gesture: 'double-click', text: 'Knob: reset to default',
          note: '(also ⌘-click)',
        },
        { gesture: 'double-click', text: 'Volume: mute / unmute' },
      ],
    },
    {
      title: 'Tempo',
      rows: [
        { gesture: 'drag up / down', text: 'Raise / lower the tempo' },
        {
          keys: ['shift'], gesture: 'drag',
          text: 'Fine adjust', note: '(0.1 BPM)',
        },
        { gesture: 'click', text: 'Type a tempo' },
      ],
    },
    {
      title: 'Steps',
      rows: [
        { gesture: 'drag up / down', text: 'Lengthen / shorten the pattern' },
        { gesture: 'click or hold ▲ ▼', text: 'One step, or keep going' },
        {
          keys: ['↑', '↓'], text: 'One step (in the field)',
          note: '(Shift: 4)',
        },
        { gesture: 'click', text: 'Type a length' },
      ],
    },
    {
      title: 'Fill and Temp keys',
      rows: [
        { gesture: 'hold FILL', text: 'Fill while held' },
        {
          gesture: 'click the light', text: 'Latch on / off',
          note: '(also ⌘-click FILL)',
        },
        {
          gesture: 'click TEMP', text: 'Make next selected pattern temporary',
          note: '(or unlatch)',
        },
      ],
    },
  ],
};

const TOUCH_TAB: HelpTab = {
  id: 'touch',
  label: 'Touch',
  sections: [
    {
      title: 'Steps',
      rows: [
        { gesture: 'tap', text: 'Turn a step on / off' },
        { gesture: 'drag sideways', text: 'Paint steps along a row' },
        { gesture: 'swipe up / down', text: 'Scroll through the tracks' },
        { gesture: 'long-press', text: 'Step editor' },
        {
          gesture: 'long-press, then drag',
          text: 'Flip through presets for that track',
        },
      ],
    },
    {
      title: 'Tracks',
      rows: [
        { gesture: 'tap name', text: 'Preview the sound' },
        { gesture: 'drag end bar', text: 'Set the track length' },
        { gesture: 'hold end bar', text: 'Free-run on / off' },
        {
          gesture: 'gear menu',
          text: 'Minimize empty tracks / Restore all tracks',
        },
        {
          gesture: 'tap caret or line',
          text: 'Restore a minimized track',
        },
      ],
    },
    {
      title: 'Tempo',
      rows: [
        { gesture: 'drag up / down', text: 'Raise / lower the tempo' },
        { gesture: 'tap', text: 'Type a tempo' },
      ],
    },
    {
      title: 'Steps',
      rows: [
        { gesture: 'drag up / down', text: 'Lengthen / shorten the pattern' },
        { gesture: 'tap or hold ▲ ▼', text: 'One step, or keep going' },
        { gesture: 'tap', text: 'Type a length' },
      ],
    },
    {
      title: 'Knobs and Fill',
      rows: [
        { gesture: 'drag', text: 'Adjust a knob' },
        { gesture: 'double-tap', text: 'Reset a knob to default' },
        { gesture: 'hold FILL', text: 'Fill while held' },
        {
          gesture: 'hold FILL + tap step',
          text: 'Add a step that plays only in fills',
        },
        {
          gesture: 'tap the light',
          text: 'Latch Fill or Temp on / off',
        },
      ],
    },
  ],
};

/**
 * Tabs in display order. Touch screens lead with
 * gestures and drop the Mouse tab; the first tab is
 * the one shown when Help opens.
 */
export function getHelpTabs(isTouch: boolean): HelpTab[] {
  return isTouch
    ? [TOUCH_TAB, KEYS_TAB]
    : [KEYS_TAB, MOUSE_TAB];
}

/** True on Apple platforms, where the modifier is ⌘. */
export function isApplePlatform(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent);
}

/** Display label for a keycap token. */
export function keyLabel(token: string, apple: boolean): string {
  if (token === 'mod') return apple ? '⌘' : 'Ctrl';
  if (token === 'shift') return '⇧';
  return token;
}

/** Replace ⌘ in free text with Ctrl off Apple platforms. */
export function platformText(text: string, apple: boolean): string {
  return apple ? text : text.replaceAll('⌘', 'Ctrl');
}
