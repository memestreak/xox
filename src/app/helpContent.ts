/**
 * Text for the Help dialog. Keep it in sync with the
 * shortcut handlers (usePlayback, useFillMode,
 * usePatternMode, useSelection) and pointer gestures.
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

export interface HelpCard {
  title: string;
  body: string;
}

export type HelpTabId = 'keys' | 'mouse' | 'touch' | 'basics';

export interface HelpTab {
  id: HelpTabId;
  label: string;
  sections?: HelpSection[];
  cards?: HelpCard[];
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
          keys: ['T'], text: 'Temp pattern change',
          note: '(while playing)',
        },
        { keys: ['?'], text: 'Open or close this help' },
        {
          keys: ['Esc'],
          text: 'Close a popup, then clear the selection',
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
        { keys: ['P'], text: 'Edit probability' },
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
        { gesture: 'drag', text: 'Paint steps along a row' },
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
      title: 'Fill key',
      rows: [
        { gesture: 'hold', text: 'Fill while held' },
        { keys: ['mod'], gesture: 'click', text: 'Latch fill on / off' },
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
        { gesture: 'drag', text: 'Paint steps along a row' },
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
      ],
    },
    {
      title: 'Knobs and Fill',
      rows: [
        { gesture: 'drag', text: 'Adjust a knob' },
        { gesture: 'double-tap', text: 'Reset a knob to default' },
        { gesture: 'hold FILL', text: 'Fill while held' },
      ],
    },
  ],
};

const BASICS_TAB: HelpTab = {
  id: 'basics',
  label: 'Basics',
  cards: [
    {
      title: 'Make a beat',
      body: 'Each row is one drum. Light up a step to place a'
        + ' hit; the playhead runs left to right. Steps are'
        + ' colored in groups of four, one group per beat.',
    },
    {
      title: 'Accent',
      body: 'The AC row at the bottom makes every hit on its lit'
        + ' steps louder. Its knob sets how much.',
    },
    {
      title: 'Track length',
      body: "Drag a track's end bar to shorten it (1–64 steps)"
        + ' for polyrhythms. A free-run track keeps looping at'
        + ' its own length instead of restarting with the'
        + ' pattern.',
    },
    {
      title: 'Step conditions',
      body: 'Open the step editor (right-click, or long-press on'
        + ' touch) to set a chance to play, a cycle like 1:2'
        + ' (every other loop), fill-only, and per-step gain and'
        + ' pan.',
    },
    {
      title: 'Fill',
      body: 'Hold FILL (or F) to play the steps marked fill and'
        + ' mute the ones marked not fill. Latch it to keep it'
        + ' on.',
    },
    {
      title: 'Changing patterns',
      body: 'Sequential waits for the loop to end. Direct start'
        + ' switches now from step 1. Direct jump switches now'
        + ' in place. TEMP plays the next pick once, then goes'
        + ' back.',
    },
    {
      title: 'Saving and sharing',
      body: 'Your session saves itself in this browser. To send'
        + ' a beat to someone, open the gear menu and choose'
        + ' Copy share link.',
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
    ? [TOUCH_TAB, KEYS_TAB, BASICS_TAB]
    : [KEYS_TAB, MOUSE_TAB, BASICS_TAB];
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
