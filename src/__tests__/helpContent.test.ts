import { describe, expect, it } from 'vitest';
import {
  getHelpTabs,
  isApplePlatform,
  keyLabel,
  platformText,
} from '../app/helpContent';

describe('helpContent', () => {
  it('leads with Keys and offers Mouse on pointer devices', () => {
    expect(getHelpTabs(false).map((t) => t.id))
      .toEqual(['keys', 'mouse']);
  });

  it('leads with Touch and drops Mouse on touch devices', () => {
    expect(getHelpTabs(true).map((t) => t.id))
      .toEqual(['touch', 'keys']);
  });

  it('every tab has content', () => {
    for (const tab of [...getHelpTabs(false), ...getHelpTabs(true)]) {
      const rows = tab.sections.flatMap((s) => s.rows);
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  it('detects Apple platforms', () => {
    expect(isApplePlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    )).toBe(true);
    expect(isApplePlatform(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    )).toBe(true);
    expect(isApplePlatform(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    )).toBe(false);
  });

  it('labels the modifier per platform', () => {
    expect(keyLabel('mod', true)).toBe('⌘');
    expect(keyLabel('mod', false)).toBe('Ctrl');
    expect(keyLabel('shift', false)).toBe('⇧');
    expect(keyLabel('F', false)).toBe('F');
  });

  it('rewrites ⌘ in notes off Apple platforms', () => {
    expect(platformText('(also ⌘-click)', false))
      .toBe('(also Ctrl-click)');
    expect(platformText('(also ⌘-click)', true))
      .toBe('(also ⌘-click)');
  });

  it('lists the minimize shortcuts and gestures', () => {
    const rows = (isTouch: boolean) => getHelpTabs(isTouch)
      .flatMap(t => t.sections)
      .flatMap(sec => sec.rows.map(r => ({ ...r, section: sec.title })));
    const desk = rows(false);
    expect(desk).toContainEqual(expect.objectContaining({
      keys: ['H'], text: 'Minimize empty tracks',
    }));
    expect(desk).toContainEqual(expect.objectContaining({
      keys: ['shift', '+', 'H'], text: 'Restore all tracks',
    }));
    expect(desk).toContainEqual(expect.objectContaining({
      section: 'Grid (blank area)', gesture: 'right-click',
    }));
    expect(desk).toContainEqual(expect.objectContaining({
      section: 'Minimized track', text: 'Restore the track',
    }));
    expect(rows(true)).toContainEqual(expect.objectContaining({
      text: 'Restore a minimized track',
    }));
  });

  it('lists the sample menu items', () => {
    const desk = getHelpTabs(false)
      .flatMap(t => t.sections)
      .flatMap(sec => sec.rows.map(r => ({ ...r, section: sec.title })));
    expect(desk).toContainEqual(expect.objectContaining({
      section: 'Track name',
      gesture: 'right-click',
      text: expect.stringMatching(/load or reset a sample/),
    }));
    expect(desk).toContainEqual(expect.objectContaining({
      section: 'Grid (blank area)',
      text: expect.stringMatching(/reset samples/),
    }));
  });
});
