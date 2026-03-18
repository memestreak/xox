import { render, screen, fireEvent }
  from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StepButton from '../app/StepButton';

const base = {
  trackId: 'bd' as const,
  trackName: 'Kick',
  stepIndex: 0,
  isActive: true,
  isCurrent: false,
  isBeat: false,
  isDisabled: false,
  onToggle: vi.fn(),
};

describe('StepButton indicators', () => {
  it('prob bar when < 100', () => {
    const { container } = render(
      <StepButton
        {...base}
        conditions={{ probability: 50 }}
      />
    );
    const bar = container.querySelector(
      '[data-testid="prob-bar"]'
    );
    expect(bar).toBeTruthy();
    expect(
      bar?.getAttribute('style')
    ).toContain('width: 50%');
  });

  it('no prob bar when undefined', () => {
    const { container } = render(
      <StepButton {...base} />
    );
    expect(container.querySelector(
      '[data-testid="prob-bar"]'
    )).toBeNull();
  });

  it('cycle text when set', () => {
    const { container } = render(
      <StepButton
        {...base}
        conditions={{ cycle: { a: 2, b: 4 } }}
      />
    );
    expect(container.textContent).toContain('2:4');
  });

  it('both indicators coexist', () => {
    const { container } = render(
      <StepButton
        {...base}
        conditions={{
          probability: 75,
          cycle: { a: 1, b: 3 },
        }}
      />
    );
    expect(container.querySelector(
      '[data-testid="prob-bar"]'
    )).toBeTruthy();
    expect(container.textContent).toContain('1:3');
  });

  it('F badge for fill:fill on active step', () => {
    const { container } = render(
      <StepButton
        {...base}
        conditions={{ fill: 'fill' }}
      />
    );
    const badge = container.querySelector(
      '[data-testid="fill-badge"]'
    );
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('F');
  });

  it('!F badge for fill:!fill on active step',
    () => {
      const { container } = render(
        <StepButton
          {...base}
          conditions={{ fill: '!fill' }}
        />
      );
      const badge = container.querySelector(
        '[data-testid="fill-badge"]'
      );
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe('!F');
    }
  );

  it('no fill badge when fill undefined', () => {
    const { container } = render(
      <StepButton
        {...base}
        conditions={{ probability: 50 }}
      />
    );
    expect(container.querySelector(
      '[data-testid="fill-badge"]'
    )).toBeNull();
  });

  it('no indicators on inactive step', () => {
    const { container } = render(
      <StepButton
        {...base}
        isActive={false}
        conditions={{ probability: 50 }}
      />
    );
    expect(container.querySelector(
      '[data-testid="prob-bar"]'
    )).toBeNull();
  });
});

describe('StepButton interactions', () => {
  it('right-click on active calls onOpenPopover',
    () => {
      const onOpen = vi.fn();
      render(
        <StepButton
          {...base}
          onOpenPopover={onOpen}
        />
      );
      fireEvent.contextMenu(
        screen.getByRole('button')
      );
      expect(onOpen).toHaveBeenCalled();
    }
  );

  it('right-click on inactive: no popover', () => {
    const onOpen = vi.fn();
    render(
      <StepButton
        {...base}
        isActive={false}
        onOpenPopover={onOpen}
      />
    );
    fireEvent.contextMenu(
      screen.getByRole('button')
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('click still toggles', () => {
    const toggle = vi.fn();
    render(
      <StepButton
        {...base}
        onToggle={toggle}
        onOpenPopover={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(toggle).toHaveBeenCalled();
  });
});
