import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LatchKey from '../app/LatchKey';
import type { LatchKeyBody } from '../app/LatchKey';

function renderKey(
  props: Partial<React.ComponentProps<typeof LatchKey>> = {}
) {
  const onLatch = vi.fn();
  const onBodyClick = vi.fn();
  render(
    <LatchKey
      label="TEMP"
      name="Temp"
      size="strip"
      body="off"
      latched={false}
      bodyTooltipKey="temp"
      latchTooltipKey="tempLatch"
      onBodyClick={onBodyClick}
      onLatch={onLatch}
      {...props}
    />
  );
  return {
    onLatch,
    onBodyClick,
    body: screen.getByRole('button', { name: 'Temp' }),
    latch: screen.getByRole('button', { name: 'Latch temp' }),
  };
}

describe('LatchKey', () => {
  it('groups a body and a latch button', () => {
    renderKey();
    expect(screen.getByRole('group', { name: 'Temp' }))
      .toBeInTheDocument();
  });

  it('body click and latch click call their own handlers', () => {
    const { body, latch, onBodyClick, onLatch } = renderKey();
    fireEvent.click(body);
    expect(onBodyClick).toHaveBeenCalledTimes(1);
    expect(onLatch).not.toHaveBeenCalled();
    fireEvent.click(latch);
    expect(onLatch).toHaveBeenCalledTimes(1);
  });

  it('lights the LED only when latched', () => {
    const { latch } = renderKey({ latched: true });
    expect(latch).toHaveAttribute('aria-pressed', 'true');
    expect(latch.querySelector('.ss-led-on')).not.toBeNull();
  });

  it('a disabled body leaves the latch enabled', () => {
    const { body, latch } = renderKey({ bodyDisabled: true });
    expect(body).toBeDisabled();
    expect(latch).toBeEnabled();
  });

  it.each<[LatchKeyBody, string]>([
    ['held', 'bg-mute'],
    ['armed', 'animate-temp-blink'],
    ['active', 'bg-accent'],
  ])('shows the %s state on the body', (state, cls) => {
    const { body } = renderKey({ body: state });
    expect(body.className).toContain(cls);
    expect(body).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses bodyAriaLabel when given', () => {
    render(
      <LatchKey
        label="TEMP"
        name="Temp"
        bodyAriaLabel="Temp mode"
        size="strip"
        body="off"
        latched={false}
        bodyTooltipKey="temp"
        latchTooltipKey="tempLatch"
        onLatch={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Temp mode' }))
      .toBeInTheDocument();
  });
});
