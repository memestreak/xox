import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import TempoController, {
  bpmAfterDrag, MAX_BPM, MIN_BPM,
} from '../app/TempoController';

describe('TempoController', () => {
  it('renders current BPM value', () => {
    render(
      <TempoController bpm={120} setBpm={vi.fn()} />
    );
    const input = screen.getByLabelText(/bpm/i);
    expect(input).toHaveValue(120);
  });

  it('calls setBpm with numeric value on change', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '150' } });
    expect(setBpm).toHaveBeenCalledWith(150);
  });

  it('clamps below-minimum to 20 on blur', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '5' } });
    expect(setBpm).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(setBpm).toHaveBeenCalledWith(20);
  });

  it('clamps above-maximum to 300 on blur', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.blur(input);
    expect(setBpm).toHaveBeenCalledWith(300);
  });

  it('typing a value digit by digit does not clamp early', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '9' } });
    expect(input).toHaveValue(9);
    expect(setBpm).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '98' } });
    expect(setBpm).toHaveBeenLastCalledWith(98);
  });

  it('empty input reverts to the tempo on blur', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(setBpm).not.toHaveBeenCalled();
    expect(input).toHaveValue(120);
  });
});

describe('TempoController tap tempo', () => {
  let perfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    perfSpy = vi.spyOn(performance, 'now');
  });

  afterEach(() => {
    perfSpy.mockRestore();
  });

  it('renders TAP button with correct aria-label', () => {
    render(
      <TempoController bpm={120} setBpm={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: 'Tap tempo' })
    ).toBeInTheDocument();
  });

  it('single tap does not call setBpm', () => {
    const setBpm = vi.fn();
    perfSpy.mockReturnValueOnce(1000);
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Tap tempo' })
    );
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('2 taps at 500ms apart sets BPM to 120', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1500);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(120);
  });

  it('4 taps compute average of all intervals', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    // 400ms, 500ms, 600ms intervals -> avg 500ms -> 120 BPM
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1400)
      .mockReturnValueOnce(1900)
      .mockReturnValueOnce(2500);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenLastCalledWith(120);
  });

  it('BPM rounded to nearest 0.5', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    // 470ms interval -> 60000/470 = 127.6595... -> 127.5
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1470);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(127.5);
  });

  it('buffer resets after >2000ms gap', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1500)
      // Third tap after 2s gap — buffer resets
      .mockReturnValueOnce(4000);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(120);
    setBpm.mockClear();
    // This tap resets the buffer — single entry, no setBpm
    fireEvent.mouseDown(btn);
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('BPM clamped to MAX_BPM for very fast taps', () => {
    const setBpm = vi.fn();
    // 50ms interval -> 1200 BPM -> clamped to 300
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1050);
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(300);
  });

  it('BPM clamped to MIN_BPM for very slow taps', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    // 1999ms interval -> 60000/1999 ≈ 30.0 BPM
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2999);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(30);
  });

});

describe('bpmAfterDrag', () => {
  it('moves 1 BPM per 4 px, up raises', () => {
    expect(bpmAfterDrag(120, 40, false)).toBe(130);
    expect(bpmAfterDrag(120, -40, false)).toBe(110);
  });

  it('ignores partial steps', () => {
    expect(bpmAfterDrag(120, 3, false)).toBe(120);
    expect(bpmAfterDrag(120, -7, false)).toBe(119);
  });

  it('fine mode moves 0.1 BPM per step without float noise', () => {
    expect(bpmAfterDrag(120, 12, true)).toBe(120.3);
    expect(bpmAfterDrag(120.5, -4, true)).toBe(120.4);
  });

  it('keeps a decimal tempo when dragging coarse', () => {
    expect(bpmAfterDrag(120.5, 8, false)).toBe(122.5);
  });

  it('clamps to the tempo range', () => {
    expect(bpmAfterDrag(290, 400, false)).toBe(MAX_BPM);
    expect(bpmAfterDrag(25, -400, false)).toBe(MIN_BPM);
  });
});

describe('TempoController drag to change tempo', () => {
  // jsdom has no PointerEvent constructor: build one
  // from MouseEvent and add the pointer fields.
  function pointer(
    target: Element,
    type: string,
    init: {
      clientY: number;
      shiftKey?: boolean;
      pointerType?: string;
      button?: number;
    },
  ) {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientY: init.clientY,
      shiftKey: init.shiftKey ?? false,
      button: init.button ?? 0,
    });
    Object.defineProperty(ev, 'pointerId', { value: 1 });
    Object.defineProperty(ev, 'pointerType', {
      value: init.pointerType ?? 'mouse',
    });
    act(() => { target.dispatchEvent(ev); });
    return ev;
  }

  function setup(bpm = 120) {
    const setBpm = vi.fn();
    render(<TempoController bpm={bpm} setBpm={setBpm} />);
    const input = screen.getByLabelText(/bpm/i) as HTMLInputElement;
    return { setBpm, input };
  }

  it('dragging up raises and down lowers the tempo', () => {
    const { setBpm, input } = setup();
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 60 });
    expect(setBpm).toHaveBeenLastCalledWith(130);
    pointer(input, 'pointermove', { clientY: 140 });
    expect(setBpm).toHaveBeenLastCalledWith(110);
    pointer(input, 'pointerup', { clientY: 140 });
    expect(input).not.toHaveFocus();
  });

  it('does nothing until the drag passes the threshold', () => {
    const { setBpm, input } = setup();
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 97 });
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('Shift drags in 0.1 BPM steps', () => {
    const { setBpm, input } = setup();
    pointer(input, 'pointerdown', { clientY: 100, shiftKey: true });
    pointer(input, 'pointermove', { clientY: 80, shiftKey: true });
    expect(setBpm).toHaveBeenLastCalledWith(120.5);
  });

  it('pressing Shift mid-drag continues from the current tempo', () => {
    const { setBpm, input } = setup();
    pointer(input, 'pointerdown', { clientY: 100 });
    pointer(input, 'pointermove', { clientY: 80 });
    expect(setBpm).toHaveBeenLastCalledWith(125);
    pointer(input, 'pointermove', { clientY: 80, shiftKey: true });
    pointer(input, 'pointermove', { clientY: 72, shiftKey: true });
    expect(setBpm).toHaveBeenLastCalledWith(125.2);
  });

  it('a mouse press holds off focus; a click then focuses to type', () => {
    const { setBpm, input } = setup();
    const down = pointer(input, 'pointerdown', { clientY: 100 });
    expect(down.defaultPrevented).toBe(true);
    pointer(input, 'pointerup', { clientY: 101 });
    expect(input).toHaveFocus();
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('does not drag while the field is being edited', () => {
    const { setBpm, input } = setup();
    act(() => { input.focus(); });
    const down = pointer(input, 'pointerdown', { clientY: 100 });
    expect(down.defaultPrevented).toBe(false);
    pointer(input, 'pointermove', { clientY: 40 });
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('a touch drag does not leave the field focused', () => {
    const { setBpm, input } = setup();
    const down = pointer(input, 'pointerdown', {
      clientY: 100, pointerType: 'touch',
    });
    expect(down.defaultPrevented).toBe(false);
    pointer(input, 'pointermove', {
      clientY: 80, pointerType: 'touch',
    });
    pointer(input, 'pointerup', {
      clientY: 80, pointerType: 'touch',
    });
    expect(setBpm).toHaveBeenLastCalledWith(125);
    act(() => { input.focus(); });
    expect(input).not.toHaveFocus();
  });

  it('ignores non-primary buttons', () => {
    const { setBpm, input } = setup();
    pointer(input, 'pointerdown', { clientY: 100, button: 2 });
    pointer(input, 'pointermove', { clientY: 40 });
    expect(setBpm).not.toHaveBeenCalled();
  });
});
