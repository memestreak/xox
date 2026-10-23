import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach, beforeAll, describe, expect, it, vi,
} from 'vitest';
import HelpModal from '../app/HelpModal';

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

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockPointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('HelpModal', () => {
  it('opens on the Keys tab with a mouse', () => {
    mockPointer(false);
    render(<HelpModal isOpen onClose={() => {}} />);
    expect(document.querySelector('dialog')).toHaveAttribute('open');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent))
      .toEqual(['Keys', 'Mouse', 'Basics']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Play / stop')).toBeInTheDocument();
  });

  it('opens on the Touch tab on touch screens', () => {
    mockPointer(true);
    render(<HelpModal isOpen onClose={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent))
      .toEqual(['Touch', 'Keys', 'Basics']);
    expect(screen.getByText('Step editor')).toBeInTheDocument();
  });

  it('switches tabs on click', async () => {
    mockPointer(false);
    const user = userEvent.setup();
    render(<HelpModal isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Basics' }));
    expect(screen.getByRole('tab', { name: 'Basics' }))
      .toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Make a beat')).toBeInTheDocument();
  });

  it('moves between tabs with arrow keys', () => {
    mockPointer(false);
    render(<HelpModal isOpen onClose={() => {}} />);
    const keys = screen.getByRole('tab', { name: 'Keys' });
    fireEvent.keyDown(keys, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Mouse' }))
      .toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(
      screen.getByRole('tab', { name: 'Mouse' }),
      { key: 'ArrowLeft' }
    );
    fireEvent.keyDown(keys, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Basics' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('closes from the close key, Escape and the backdrop', async () => {
    mockPointer(false);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<HelpModal isOpen onClose={onClose} />);
    await user.click(
      screen.getByRole('button', { name: 'Close help' })
    );
    const dialog = document.querySelector('dialog')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('closes the dialog when isOpen turns false', () => {
    mockPointer(false);
    const { rerender } = render(
      <HelpModal isOpen onClose={() => {}} />
    );
    rerender(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(document.querySelector('dialog'))
      .not.toHaveAttribute('open');
  });
});
