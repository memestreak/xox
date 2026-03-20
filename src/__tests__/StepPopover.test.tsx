import { render, screen, fireEvent }
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
    const sel = screen.getByRole(
      'combobox'
    ) as HTMLSelectElement;
    expect(sel.value).toBe('1:1');
  });

  it('changing cycle calls setTrigCondition',
    () => {
      render(<StepPopover {...base} />);
      fireEvent.change(
        screen.getByRole('combobox'),
        { target: { value: '2:4' } }
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
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0].textContent).toBe('None');
    expect(radios[1].textContent).toBe('FILL');
    expect(radios[2].textContent).toBe('!FILL');
  });

  it('selecting FILL sets fill condition', () => {
    render(<StepPopover {...base} />);
    const fillBtn = screen.getByRole('radio', {
      name: /^FILL$/,
    });
    fireEvent.click(fillBtn);
    expect(mockSet).toHaveBeenCalledWith(
      'bd', 3, { fill: 'fill' }
    );
  });

  it('selecting !FILL sets fill condition', () => {
    render(<StepPopover {...base} />);
    const nfillBtn = screen.getByRole('radio', {
      name: /^!FILL$/,
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
      name: /^None$/,
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
      name: /^!FILL$/,
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
      const sel2 = screen.getByRole(
        'combobox'
      ) as HTMLSelectElement;
      expect(sel2.value).toBe('1:3');
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
