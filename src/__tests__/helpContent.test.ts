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
});
