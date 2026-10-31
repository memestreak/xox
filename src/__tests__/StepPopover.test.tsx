import { render, screen, fireEvent, within }
  from '@testing-library/react';
import { describe, it, expect, vi, beforeEach }
  from 'vitest';
import StepPopover from '../app/StepPopover';

const mockSet = vi.fn();
const mockClear = vi.fn();
const mockSetLock = vi.fn();
const mockClearLock = vi.fn();

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => ({
    actions: {
      setTrigCondition: mockSet,
      clearTrigCondition: mockClear,
      setParameterLock: mockSetLock,
      clearParameterLock: mockClearLock,
    },
  }),
}));

const base = {
  trackId: 'bd' as const,
  stepIndex: 3,
  conditions: undefined as undefined,
  onClose: vi.fn(),
};

describe('StepPopover', () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockClear.mockClear();
    mockSetLock.mockClear();
    mockClearLock.mockClear();
    base.onClose.mockClear();
  });

  it('header shows step number + track abbrev',
    () => {
      render(<StepPopover {...base} />);
      expect(
        screen.getByText(/Step 4/)
      ).toBeTruthy();
      expect(
        screen.getByText(/BD/)
      ).toBeTruthy();
    }
  );

  it('slider defaults to 100', () => {
    render(<StepPopover {...base} />);
    expect(
      screen.getByRole('slider', { name: 'Probability' })
        .getAttribute('aria-valuenow')
    ).toBe('100');
  });

  it('cycle defaults to 1:1', () => {
    render(<StepPopover {...base} />);
    expect(screen.getByRole('combobox', { name: 'Cycle' }))
      .toHaveTextContent('1:1');
  });

  it('changing cycle calls setTrigCondition',
    () => {
      render(<StepPopover {...base} />);
      fireEvent.click(screen.getByRole('combobox', { name: 'Cycle' }));
      fireEvent.click(
        screen.getByRole('option', { name: '2:4' })
      );
      expect(mockSet).toHaveBeenCalledWith(
        'bd', 3, { cycle: { a: 2, b: 4 } }
      );
    }
  );

  it('all defaults calls clearTrigCondition',
    () => {
      render(
        <StepPopover
          {...base}
          conditions={{ probability: 50 }}
        />
      );
      fireEvent.keyDown(
        screen.getByRole('slider', { name: 'Probability' }),
        { key: 'End' }
      );
      expect(mockClear).toHaveBeenCalledWith(
        'bd', 3
      );
    }
  );

  it('Escape calls onClose', () => {
    render(<StepPopover {...base} />);
    fireEvent.keyDown(
      document, { key: 'Escape' }
    );
    expect(base.onClose).toHaveBeenCalled();
  });

  it('click outside calls onClose', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <StepPopover
          {...base}
          onClose={onClose}
        />
      </div>
    );
    vi.advanceTimersByTime(1);
    fireEvent.mouseDown(
      screen.getByTestId('outside')
    );
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('fill section renders three options', () => {
    render(<StepPopover {...base} />);
    const radios = within(
      screen.getByRole('radiogroup', { name: 'Fill condition' })
    ).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0].textContent).toBe('Any');
    expect(radios[1].textContent).toBe('Fill');
    expect(radios[2].textContent).toBe('!Fill');
  });

  it('selecting FILL sets fill condition', () => {
    render(<StepPopover {...base} />);
    const fillBtn = screen.getByRole('radio', {
      name: /^Fill$/,
    });
    fireEvent.click(fillBtn);
    expect(mockSet).toHaveBeenCalledWith(
      'bd', 3, { fill: 'fill' }
    );
  });

  it('selecting !FILL sets fill condition', () => {
    render(<StepPopover {...base} />);
    const nfillBtn = screen.getByRole('radio', {
      name: /^!Fill$/,
    });
    fireEvent.click(nfillBtn);
    expect(mockSet).toHaveBeenCalledWith(
      'bd', 3, { fill: '!fill' }
    );
  });

  it('selecting None removes fill', () => {
    render(
      <StepPopover
        {...base}
        conditions={{ fill: 'fill' }}
      />
    );
    const noneBtn = screen.getByRole('radio', {
      name: /^Any$/,
    });
    fireEvent.click(noneBtn);
    expect(mockClear).toHaveBeenCalledWith(
      'bd', 3
    );
  });

  it('pre-populates fill from conditions', () => {
    render(
      <StepPopover
        {...base}
        conditions={{ fill: '!fill' }}
      />
    );
    const nfillRadio = screen.getByRole('radio', {
      name: /^!Fill$/,
    });
    expect(
      nfillRadio.getAttribute('aria-checked')
    ).toBe('true');
  });

  it('pre-populates from existing conditions',
    () => {
      render(
        <StepPopover
          {...base}
          conditions={{
            probability: 75,
            cycle: { a: 1, b: 3 },
          }}
        />
      );
      expect(
        screen.getByRole('slider', { name: 'Probability' })
          .getAttribute('aria-valuenow')
      ).toBe('75');
      expect(screen.getByRole('combobox', { name: 'Cycle' }))
        .toHaveTextContent('1:3');
    }
  );
});

describe('StepPopover gain lock', () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockClear.mockClear();
    mockSetLock.mockClear();
    mockClearLock.mockClear();
    base.onClose.mockClear();
  });

  it('renders gain slider in locks section', () => {
    render(<StepPopover {...base} />);
    expect(screen.getByText('Locks')).toBeTruthy();
    expect(
      screen.getByRole('slider', { name: 'Gain' })
    ).toBeTruthy();
  });

  it('slider starts at 100 when no lock exists', () => {
    render(<StepPopover {...base} />);
    const slider = screen.getByRole(
      'slider', { name: 'Gain' }
    );
    expect(
      slider.getAttribute('aria-valuenow')
    ).toBe('100');
  });

  it('slider shows current lock value', () => {
    render(
      <StepPopover {...base} locks={{ gain: 0.6 }} />
    );
    const slider = screen.getByRole(
      'slider', { name: 'Gain' }
    );
    expect(
      slider.getAttribute('aria-valuenow')
    ).toBe('60');
  });

  it('Reset locks button clears locks', () => {
    render(
      <StepPopover {...base} locks={{ gain: 0.5 }} />
    );
    const resetBtn = screen.getByText('Reset locks');
    fireEvent.click(resetBtn);
    expect(mockClearLock).toHaveBeenCalledWith(
      'bd', 3
    );
  });
});

describe('StepPopover scroll close', () => {
  it('closes when the page scrolls (phones)', () => {
    const scrollEl = document.createElement('div');
    const ref = { current: scrollEl };
    const onClose = vi.fn();
    render(
      <StepPopover
        {...base}
        onClose={onClose}
        anchorRect={{ top: 10, left: 10 }}
        scrollContainerRef={ref}
      />
    );
    fireEvent.scroll(window);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the track area scrolls (desktop)', () => {
    const scrollEl = document.createElement('div');
    const ref = { current: scrollEl };
    const onClose = vi.fn();
    render(
      <StepPopover
        {...base}
        onClose={onClose}
        anchorRect={{ top: 10, left: 10 }}
        scrollContainerRef={ref}
      />
    );
    fireEvent.scroll(scrollEl);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('StepPopover retrig', () => {
  beforeEach(() => {
    mockSetLock.mockClear();
  });

  const dial = (name: string) =>
    screen.getByRole('slider', { name: `Retrig ${name}` });
  const lit = { retrig: { enabled: true, rate: 64, length: 0.5 } };

  it('starts off, with the dials out of reach', () => {
    render(<StepPopover {...base} />);
    expect(
      screen.getByRole('radio', { name: 'Off' })
        .getAttribute('aria-checked')
    ).toBe('true');
    expect(dial('rate').closest('[inert]')).toBeTruthy();
  });

  it('turning it on sets a 1/32 for a 1/16', () => {
    render(<StepPopover {...base} />);
    fireEvent.click(screen.getByRole('radio', { name: 'On' }));
    expect(mockSetLock).toHaveBeenCalledWith('bd', 3, {
      retrig: { enabled: true, rate: 32, length: 1 },
    });
  });

  it('shows rate and length as note values', () => {
    render(<StepPopover {...base} locks={lit} />);
    expect(dial('rate').getAttribute('aria-valuetext')).toBe('1/64');
    expect(dial('length').getAttribute('aria-valuetext')).toBe('1/32');
  });

  it('arrow keys move a dial one value', () => {
    render(<StepPopover {...base} locks={lit} />);
    fireEvent.keyDown(dial('rate'), { key: 'ArrowUp' });
    expect(mockSetLock).toHaveBeenLastCalledWith('bd', 3, {
      retrig: { enabled: true, rate: 80, length: 0.5 },
    });
    fireEvent.keyDown(dial('length'), { key: 'ArrowDown' });
    expect(mockSetLock).toHaveBeenLastCalledWith('bd', 3, {
      retrig: { enabled: true, rate: 64, length: 0.25 },
    });
  });

  it('double-clicking a dial or its value resets it', () => {
    render(<StepPopover {...base} locks={lit} />);
    fireEvent.click(dial('rate'), { detail: 2 });
    expect(mockSetLock).toHaveBeenLastCalledWith('bd', 3, {
      retrig: { enabled: true, rate: 32, length: 0.5 },
    });
    fireEvent.doubleClick(
      screen.getByRole('button', { name: /^Length 1\/32/ })
    );
    expect(mockSetLock).toHaveBeenLastCalledWith('bd', 3, {
      retrig: { enabled: true, rate: 64, length: 1 },
    });
  });

  it('turning it off keeps rate and length', () => {
    render(<StepPopover {...base} locks={lit} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
    expect(mockSetLock).toHaveBeenCalledWith('bd', 3, {
      retrig: { enabled: false, rate: 64, length: 0.5 },
    });
  });
});
