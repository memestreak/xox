import { render, screen, fireEvent }
  from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AccentRow from '../app/AccentRow';

const base = {
  steps: '1010000000000000',
  trackLength: 16,
  patternLength: 16,
  pageOffset: 0,
  isFreeRun: false,
  gain: 0.5,
  currentStep: -1,
  totalSteps: 0,
  onToggleStep: vi.fn(),
  onSetTrackLength: vi.fn(),
  onToggleFreeRun: vi.fn(),
  onSetGain: vi.fn(),
};

describe('AccentRow', () => {
  it('renders 16 mini step buttons', () => {
    const { container } = render(
      <AccentRow {...base} />
    );
    const steps = container.querySelectorAll(
      '[data-step]'
    );
    expect(steps.length).toBe(16);
  });

  it('shows active state for accent steps', () => {
    render(<AccentRow {...base} />);
    const btn0 = screen.getByLabelText(
      'accent step 1'
    );
    expect(
      btn0.className
    ).toContain('bg-orange-600');
  });

  it('shows inactive state for off steps', () => {
    render(<AccentRow {...base} />);
    const btn3 = screen.getByLabelText(
      'accent step 4'
    );
    expect(
      btn3.className
    ).toContain('bg-neutral-800');
  });

  it('calls onToggleStep on click', () => {
    const toggle = vi.fn();
    render(
      <AccentRow {...base} onToggleStep={toggle} />
    );
    fireEvent.click(
      screen.getByLabelText('accent step 5')
    );
    expect(toggle).toHaveBeenCalledWith('ac', 4);
  });

  it('disables steps beyond trackLength', () => {
    const { container } = render(
      <AccentRow {...base} trackLength={8} />
    );
    const step9 = container.querySelector(
      '[data-step="8"]'
    );
    expect(step9?.tagName).not.toBe('BUTTON');
    expect(
      step9?.getAttribute('aria-label')
    ).toContain('inactive');
  });

  it('shows drag handle at trackLength', () => {
    render(
      <AccentRow {...base} trackLength={8} />
    );
    const slider = screen.getByLabelText(
      'accent length'
    );
    expect(slider).toBeTruthy();
    expect(
      slider.getAttribute('aria-valuenow')
    ).toBe('8');
  });

  it('shows drag handle at pattern end', () => {
    render(
      <AccentRow {...base} trackLength={16} />
    );
    const slider = screen.getByLabelText(
      'accent length'
    );
    expect(
      slider.getAttribute('aria-valuenow')
    ).toBe('16');
    expect(slider.style.left).toBe('100%');
  });

  it('shows free-run F badge', () => {
    render(
      <AccentRow
        {...base}
        trackLength={8}
        isFreeRun={true}
      />
    );
    expect(
      screen.getByLabelText('free run')
    ).toBeTruthy();
    expect(
      screen.getByText('F')
    ).toBeTruthy();
  });

  it('respects pageOffset for step indices', () => {
    const toggle = vi.fn();
    render(
      <AccentRow
        {...base}
        steps={
          '0000000000000000' + '1010000000000000'
        }
        trackLength={32}
        patternLength={32}
        pageOffset={16}
        onToggleStep={toggle}
      />
    );
    fireEvent.click(
      screen.getByLabelText('accent step 1')
    );
    // Local step 0 + pageOffset 16 = global step 16
    expect(toggle).toHaveBeenCalledWith('ac', 16);
  });

  it('renders circle buttons', () => {
    const { container } = render(
      <AccentRow {...base} />
    );
    const btn = container.querySelector(
      '[data-step] button, button[data-step]'
    ) ?? container.querySelector('button');
    expect(btn?.className).toContain('rounded-full');
    expect(btn?.className).toContain('w-4');
    expect(btn?.className).toContain('h-4');
  });

  it('shows running light on current step', () => {
    render(
      <AccentRow {...base} currentStep={2} />
    );
    const btn = screen.getByLabelText(
      'accent step 3'
    );
    expect(
      btn.className
    ).toContain('bg-orange-400');
  });

  it('renders intensity knob', () => {
    render(<AccentRow {...base} />);
    expect(
      screen.getAllByLabelText('Volume ACCENT')
        .length
    ).toBeGreaterThanOrEqual(1);
  });
});
