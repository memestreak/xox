import { render, screen, fireEvent }
  from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StepButton from '../app/StepButton';

const base = {
  trackId: 'bd' as const,
  trackName: 'BD',
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

describe('StepButton mini variant', () => {
  it('renders as circle', () => {
    const { container } = render(
      <StepButton {...base} mini />
    );
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('rounded-full');
    expect(btn?.className).toContain('w-4');
    expect(btn?.className).toContain('h-4');
    expect(btn?.className).not.toContain('h-8');
  });

  it('skips trig condition overlays', () => {
    const { container } = render(
      <StepButton
        {...base}
        mini
        conditions={{
          probability: 50,
          fill: 'fill',
          cycle: { a: 1, b: 3 },
        }}
      />
    );
    expect(container.querySelector(
      '[data-testid="prob-bar"]'
    )).toBeNull();
    expect(container.querySelector(
      '[data-testid="fill-badge"]'
    )).toBeNull();
    expect(container.textContent).not.toContain(
      '1:3'
    );
  });

  it('no current-step glow when mini', () => {
    const { container } = render(
      <StepButton
        {...base}
        mini
        isCurrent={true}
      />
    );
    const btn = container.querySelector('button');
    expect(btn?.className).not.toContain(
      'scale-105'
    );
    expect(btn?.className).not.toContain('shadow');
  });

  it('disabled mini renders as circle', () => {
    const { container } = render(
      <StepButton
        {...base}
        mini
        isDisabled={true}
      />
    );
    const el = container.querySelector(
      '[data-step]'
    );
    expect(el?.className).toContain('rounded-full');
    expect(el?.className).toContain('w-4');
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

  it('right-click on inactive: calls onOpenPopover',
    () => {
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
      expect(onOpen).toHaveBeenCalled();
    }
  );

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

describe('StepButton gain lock opacity', () => {
  it('active step with gain lock shows opacity',
    () => {
      render(
        <StepButton
          {...base}
          isActive={true}
          gainLock={0.5}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('0.5');
    }
  );

  it('active step with gain lock 0 shows min opacity',
    () => {
      render(
        <StepButton
          {...base}
          isActive={true}
          gainLock={0}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('0.2');
    }
  );

  it('inactive step with gain lock has no opacity',
    () => {
      render(
        <StepButton
          {...base}
          isActive={false}
          gainLock={0.3}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('');
    }
  );

  it('active step without gain lock has no opacity',
    () => {
      render(
        <StepButton
          {...base}
          isActive={true}
        />
      );
      const btn = screen.getByRole('button');
      expect(btn.style.opacity).toBe('');
    }
  );
});

describe('StepButton popover on inactive steps', () => {
  it('opens popover on inactive step right-click',
    () => {
      const onOpenPopover = vi.fn();
      render(
        <StepButton
          {...base}
          isActive={false}
          onOpenPopover={onOpenPopover}
        />
      );
      const btn = screen.getByRole('button');
      fireEvent.contextMenu(btn);
      expect(onOpenPopover).toHaveBeenCalled();
    }
  );
});

describe('StepButton selection', () => {
  it('Ctrl+Click calls onCtrlClick', () => {
    const onCtrl = vi.fn();
    render(
      <StepButton
        {...base}
        onCtrlClick={onCtrl}
        onOpenPopover={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole('button'),
      { ctrlKey: true }
    );
    expect(onCtrl).toHaveBeenCalledWith('bd', 0);
  });

  it('Ctrl+Click does not open popover', () => {
    const onOpen = vi.fn();
    const onCtrl = vi.fn();
    render(
      <StepButton
        {...base}
        onCtrlClick={onCtrl}
        onOpenPopover={onOpen}
      />
    );
    fireEvent.click(
      screen.getByRole('button'),
      { ctrlKey: true }
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('Shift+Click calls onShiftClick', () => {
    const onShift = vi.fn();
    render(
      <StepButton
        {...base}
        onShiftClick={onShift}
      />
    );
    fireEvent.click(
      screen.getByRole('button'),
      { shiftKey: true }
    );
    expect(onShift).toHaveBeenCalledWith('bd', 0);
  });

  it('plain click calls onPlainClick then toggles',
    () => {
      const onPlain = vi.fn();
      const toggle = vi.fn();
      render(
        <StepButton
          {...base}
          onToggle={toggle}
          onPlainClick={onPlain}
        />
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onPlain).toHaveBeenCalled();
      expect(toggle).toHaveBeenCalled();
    }
  );

  it('isSelected adds ring class', () => {
    const { container } = render(
      <StepButton {...base} isSelected />
    );
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('ring-blue-400');
    expect(btn?.className).toContain('ring-2');
  });

  it('isSelected=false has no ring class', () => {
    const { container } = render(
      <StepButton {...base} isSelected={false} />
    );
    const btn = container.querySelector('button');
    expect(btn?.className).not.toContain(
      'ring-blue-400'
    );
  });

  it('right-click still opens popover with selection',
    () => {
      const onOpen = vi.fn();
      render(
        <StepButton
          {...base}
          isSelected
          onOpenPopover={onOpen}
          onCtrlClick={vi.fn()}
        />
      );
      fireEvent.contextMenu(
        screen.getByRole('button')
      );
      expect(onOpen).toHaveBeenCalled();
    }
  );
});
