import {
  render, screen, fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  beforeAll, describe, expect, it, vi,
} from 'vitest';
import KitSelector from '../app/KitSelector';
import { TestWrapper } from './helpers/sequencer-wrapper';

// jsdom doesn't implement HTMLDialogElement methods
beforeAll(() => {
  HTMLDialogElement.prototype.showModal =
    vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
  HTMLDialogElement.prototype.close =
    vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
});

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
    decodeSample: vi.fn().mockResolvedValue({}),
    setCustomSample: vi.fn(),
    clearCustomSample: vi.fn(),
    clearCustomSamples: vi.fn(),
  },
}));

function renderKit() {
  return render(
    <TestWrapper>
      <KitSelector />
    </TestWrapper>
  );
}

describe('KitSelector', () => {
  it('has no kit menu until right-clicked', () => {
    renderKit();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('right-click opens the kit menu at the pointer', () => {
    renderKit();
    fireEvent.contextMenu(
      screen.getByRole('combobox'), { clientX: 40, clientY: 50 }
    );
    const menu = screen.getByRole('menu', { name: 'Kit options' });
    expect(menu).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /export kit/i })
    ).toHaveFocus();
  });

  it('hides the kit tooltip while the kit menu is open', async () => {
    const user = userEvent.setup();
    renderKit();
    const tip = () => screen.getByRole('tooltip').className;
    expect(tip()).toContain('group-hover/tooltip:opacity-100');
    fireEvent.contextMenu(screen.getByRole('combobox'));
    expect(tip()).not.toContain('group-hover');
    await user.keyboard('{Escape}');
    expect(tip()).toContain('group-hover/tooltip:opacity-100');
  });

  it('Escape closes the kit menu', async () => {
    const user = userEvent.setup();
    renderKit();
    fireEvent.contextMenu(screen.getByRole('combobox'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Export kit opens the dialog', () => {
    renderKit();
    fireEvent.contextMenu(screen.getByRole('combobox'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: /export kit/i })
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Export kit' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('dialog', { name: 'Export kit' })
    ).not.toBeInTheDocument();
  });
});
