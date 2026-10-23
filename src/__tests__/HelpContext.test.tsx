import { act, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HelpProvider, useHelp } from '../app/HelpContext';

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

function Probe() {
  const help = useHelp();
  return (
    <button type="button" onClick={help.toggle}>
      {help.isOpen ? 'open' : 'closed'}
    </button>
  );
}

function renderProvider() {
  return render(
    <HelpProvider>
      <Probe />
      <input aria-label="field" />
    </HelpProvider>
  );
}

function pressQuestion(
  target: EventTarget = document,
  init: KeyboardEventInit = {}
) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: '?', bubbles: true, cancelable: true, ...init,
    }));
  });
}

describe('HelpProvider', () => {
  it('renders no dialog until first opened', () => {
    renderProvider();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('? opens Help and ? again closes it', () => {
    renderProvider();
    pressQuestion();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(document.querySelector('dialog')).toHaveAttribute('open');
    // Focus is inside the open dialog, but ? still closes it.
    pressQuestion(document.querySelector('dialog')!);
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('ignores ? in a form field, with modifiers, and on repeat', () => {
    renderProvider();
    pressQuestion(screen.getByLabelText('field'));
    pressQuestion(document, { ctrlKey: true });
    pressQuestion(document, { metaKey: true });
    pressQuestion(document, { repeat: true });
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('ignores ? while another dialog is open', () => {
    renderProvider();
    const other = document.createElement('dialog');
    other.setAttribute('open', '');
    document.body.appendChild(other);
    pressQuestion();
    expect(screen.getByText('closed')).toBeInTheDocument();
    other.remove();
  });

  it('toggle() opens and closes', () => {
    renderProvider();
    act(() => screen.getByText('closed').click());
    expect(screen.getByText('open')).toBeInTheDocument();
    act(() => screen.getByText('open').click());
    expect(screen.getByText('closed')).toBeInTheDocument();
  });
});
