import { act, render, screen, fireEvent } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StepsEntry, { stepsAfterDrag } from '../app/StepsEntry';
import { useTrackConfig } from '../app/hooks/useTrackConfig';
import { defaultConfig } from '../app/configCodec';
import {
  STEPS_REPEAT_DELAY_MS, STEPS_REPEAT_INTERVAL_MS,
} from '../app/constants';
import { TRACK_IDS, getPatternLength } from '../app/types';
import type { SequencerConfig, TrackConfig, TrackId } from '../app/types';

// jsdom has no PointerEvent constructor: build one
// from MouseEvent and add the pointer fields.
function pointer(
  target: Element,
  type: string,
  init: { clientY?: number; pointerType?: string; button?: number } = {},
) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
  });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  Object.defineProperty(ev, 'pointerType', {
    value: init.pointerType ?? 'mouse',
  });
  act(() => { target.dispatchEvent(ev); });
  return ev;
}

/** 32 steps, every step of every track on. */
function fullTracks(len = 32): Record<TrackId, TrackConfig> {
  const t = {} as Record<TrackId, TrackConfig>;
  for (const id of TRACK_IDS) t[id] = { steps: '1'.repeat(len) };
  return t;
}

// What the harness last rendered, for assertions.
const probe = {} as {
  config: SequencerConfig;
  editBd: (steps: string) => void;
};

/** StepsEntry wired to real config state. */
function Harness({ len }: { len: number }) {
  const [config, setConfig] = useState<SequencerConfig>({
    ...defaultConfig(), tracks: fullTracks(len),
  });
  const tc = useTrackConfig({
    setConfig, setSelectedPatternId: () => {},
  });
  const { setTrackSteps } = tc;
  useEffect(() => {
    probe.config = config;
    probe.editBd = steps => setTrackSteps('bd', steps);
  });
  return (
    <StepsEntry
      value={getPatternLength(config.tracks)}
      tracks={config.tracks}
      setPatternLength={tc.setPatternLength}
    />
  );
}

function setup(len = 32) {
  render(<Harness len={len} />);
  return {
    input: screen.getByRole('spinbutton', { name: 'Steps' }) as HTMLInputElement,
    up: screen.getByRole('button', { name: 'More steps' }),
    down: screen.getByRole('button', { name: 'Fewer steps' }),
  };
}

const length = () => getPatternLength(probe.config.tracks);

describe('stepsAfterDrag', () => {
  it('moves one step per 4 px and clamps to 1..64', () => {
    expect(stepsAfterDrag(16, 8)).toBe(18);
    expect(stepsAfterDrag(16, -7)).toBe(15);
    expect(stepsAfterDrag(16, 1000)).toBe(64);
    expect(stepsAfterDrag(16, -1000)).toBe(1);
  });
});

describe('StepsEntry', () => {
  it('shows the pattern length', () => {
    const { input } = setup(32);
    expect(input.value).toBe('32');
    expect(input.getAttribute('aria-valuenow')).toBe('32');
  });

  it('dragging up raises and down lowers the length', () => {
    const { input } = setup(16);
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 60 });
    expect(length()).toBe(26);
    pointer(input, 'pointermove', { clientY: 120 });
    expect(length()).toBe(11);
    pointer(input, 'pointerup', { clientY: 120 });
  });

  it('does nothing until the drag passes the threshold', () => {
    const { input } = setup(16);
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 97 });
    expect(length()).toBe(16);
  });

  it('a drag down and back up keeps the steps', () => {
    const { input } = setup(32);
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 196 }); // 32 - 24 = 8
    expect(length()).toBe(8);
    pointer(input, 'pointermove', { clientY: 100 });
    pointer(input, 'pointerup', { clientY: 100 });
    expect(length()).toBe(32);
    expect(probe.config.tracks.bd.steps).toBe('1'.repeat(32));
  });

  it('a new drag starts from the tracks as they are', () => {
    const { input } = setup(32);
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 164 }); // 16
    pointer(input, 'pointerup', { clientY: 164 });
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 36 }); // 32
    pointer(input, 'pointerup', { clientY: 36 });
    expect(probe.config.tracks.bd.steps)
      .toBe('1'.repeat(16) + '0'.repeat(16));
  });

  it('a mouse click without a drag focuses the field', () => {
    const { input } = setup(16);
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointerup', { clientY: 100 });
    expect(document.activeElement).toBe(input);
  });

  it('↑/↓ step by 1, Shift by 4, Home/End jump', () => {
    const { input } = setup(16);
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(length()).toBe(17);
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(length()).toBe(13);
    fireEvent.keyDown(input, { key: 'End' });
    expect(length()).toBe(64);
    fireEvent.keyDown(input, { key: 'Home' });
    expect(length()).toBe(1);
  });

  it('keys while focused keep the steps until blur', () => {
    const { input } = setup(32);
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'Home' });
    fireEvent.keyDown(input, { key: 'End' });
    expect(probe.config.tracks.bd.steps.slice(0, 32)).toBe('1'.repeat(32));
    act(() => input.blur());
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'Home' });
    act(() => input.blur());
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'End' });
    expect(probe.config.tracks.bd.steps).toBe('1' + '0'.repeat(63));
  });

  it('typing applies a length in range and keeps steps on the way', () => {
    const { input } = setup(32);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '2' } });
    expect(length()).toBe(2);
    fireEvent.change(input, { target: { value: '24' } });
    expect(length()).toBe(24);
    expect(probe.config.tracks.bd.steps).toBe('1'.repeat(24));
  });

  it('typing drops non-digits and clamps on blur', () => {
    const { input } = setup(16);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '9x9' } });
    expect(input.value).toBe('99');
    act(() => input.blur());
    expect(length()).toBe(64);
    expect(input.value).toBe('64');
  });

  it('clearing the field and leaving keeps the length', () => {
    const { input } = setup(16);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '' } });
    act(() => input.blur());
    expect(length()).toBe(16);
    expect(input.value).toBe('16');
  });

  it('a grid edit mid-gesture becomes the new starting point', () => {
    const { input } = setup(32);
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 31
    act(() => probe.editBd('0'.repeat(31)));
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // 32
    expect(probe.config.tracks.bd.steps).toBe('0'.repeat(32));
  });

  it('double-click resets to 16 and leaves the field', () => {
    const { input } = setup(40);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.doubleClick(input);
    expect(length()).toBe(16);
    expect(input.value).toBe('16');
    expect(document.activeElement).not.toBe(input);
  });

  it('arrow keys are disabled at the ends of the range', () => {
    const a = setup(64);
    expect(a.up).toBeDisabled();
    expect(a.down).not.toBeDisabled();
  });

  describe('arrow keys', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('a press steps once', () => {
      const { up, down } = setup(16);
      pointer(up, 'pointerdown');
      pointer(up, 'pointerup');
      expect(length()).toBe(17);
      pointer(down, 'pointerdown');
      pointer(down, 'pointerup');
      expect(length()).toBe(16);
    });

    it('holding repeats after a delay', () => {
      const { up } = setup(16);
      pointer(up, 'pointerdown');
      expect(length()).toBe(17);
      act(() => { vi.advanceTimersByTime(STEPS_REPEAT_DELAY_MS - 1); });
      expect(length()).toBe(17);
      act(() => { vi.advanceTimersByTime(1 + STEPS_REPEAT_INTERVAL_MS * 3); });
      expect(length()).toBe(21);
      pointer(up, 'pointerup');
      act(() => { vi.advanceTimersByTime(STEPS_REPEAT_INTERVAL_MS * 5); });
      expect(length()).toBe(21);
    });

    it('a hold cuts steps once it ends', () => {
      const { down } = setup(32);
      pointer(down, 'pointerdown');
      act(() => { vi.advanceTimersByTime(STEPS_REPEAT_DELAY_MS + STEPS_REPEAT_INTERVAL_MS * 2); });
      pointer(down, 'pointerup');
      expect(length()).toBe(28);
      expect(probe.config.tracks.bd.steps).toBe('1'.repeat(28));
    });

    it('stops repeating at the end of the range', () => {
      const { up } = setup(62);
      pointer(up, 'pointerdown');
      act(() => { vi.advanceTimersByTime(STEPS_REPEAT_DELAY_MS + STEPS_REPEAT_INTERVAL_MS * 10); });
      expect(length()).toBe(64);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
