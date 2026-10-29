import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPreferenceSection,
  gridPrefs,
  interfacePrefs,
  outputPrefs,
  patternsPrefs,
  resetPreferencesForTests,
} from '../app/preferences';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('preference sections', () => {
  it('use one xox.<page>.<section> key each', () => {
    expect([
      interfacePrefs.key, gridPrefs.key,
      patternsPrefs.key, outputPrefs.key,
    ]).toEqual([
      'xox.general.interface',
      'xox.sequencer.grid',
      'xox.sequencer.patterns',
      'xox.sequencer.output',
    ]);
  });

  it('start from defaults', () => {
    expect(interfacePrefs.get()).toEqual({ showTooltips: true });
    expect(gridPrefs.get()).toEqual({ autoMinimize: false });
    expect(patternsPrefs.get()).toEqual({ chooserClickAway: true });
    expect(outputPrefs.get()).toEqual({ volume: 0.8 });
  });

  it('read a saved section', () => {
    window.localStorage.setItem(
      'xox.sequencer.grid', JSON.stringify({ autoMinimize: true })
    );
    expect(gridPrefs.get().autoMinimize).toBe(true);
  });

  it('give each missing or invalid field its default', () => {
    window.localStorage.setItem(
      'xox.sequencer.output', JSON.stringify({ volume: 7 })
    );
    window.localStorage.setItem(
      'xox.general.interface', JSON.stringify({ other: 1 })
    );
    window.localStorage.setItem('xox.sequencer.grid', '{not json');
    expect(outputPrefs.get().volume).toBe(0.8);
    expect(interfacePrefs.get().showTooltips).toBe(true);
    expect(gridPrefs.get().autoMinimize).toBe(false);
  });

  it('ignore the old xox-* keys', () => {
    window.localStorage.setItem('xox-tooltips', 'false');
    window.localStorage.setItem('xox-master-volume', '0.2');
    expect(interfacePrefs.get().showTooltips).toBe(true);
    expect(outputPrefs.get().volume).toBe(0.8);
  });

  it('save the whole section as JSON', () => {
    patternsPrefs.update({ chooserClickAway: false });
    expect(JSON.parse(
      window.localStorage.getItem('xox.sequencer.patterns')!
    )).toEqual({ chooserClickAway: false });
  });

  it('re-render users on change', () => {
    const { result } = renderHook(() => gridPrefs.useValue());
    act(() => gridPrefs.update({ autoMinimize: true }));
    expect(result.current.autoMinimize).toBe(true);
  });

  it('keep working, and warn once, when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => { throw new Error('denied'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetPreferencesForTests();
    expect(gridPrefs.get().autoMinimize).toBe(false);
    gridPrefs.update({ autoMinimize: true });
    outputPrefs.update({ volume: 0.1 });
    expect(gridPrefs.get().autoMinimize).toBe(true);
    expect(outputPrefs.get().volume).toBe(0.1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('createPreferenceSection runs the parser on what is stored', () => {
    const parse = vi.fn(() => ({ n: 1 }));
    const section = createPreferenceSection('xox.test.s', { n: 1 }, parse);
    window.localStorage.setItem('xox.test.s', '{"n":5}');
    section.get();
    expect(parse).toHaveBeenCalledWith({ n: 5 });
  });
});
