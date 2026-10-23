import { act, render, screen } from '@testing-library/react';
import {
  afterAll, beforeAll, describe, expect, it, vi,
} from 'vitest';
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

describe('HelpProvider focus on close', () => {
  // Mimic the browser: close() puts focus back on what
  // was focused at showModal(), then fires `close`.
  let previous: HTMLElement | null = null;
  const realShowModal = HTMLDialogElement.prototype.showModal;
  const realClose = HTMLDialogElement.prototype.close;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal =
      function (this: HTMLDialogElement) {
        previous = document.activeElement as HTMLElement | null;
        this.setAttribute('open', '');
      };
    HTMLDialogElement.prototype.close =
      function (this: HTMLDialogElement) {
        this.removeAttribute('open');
        previous?.focus();
        this.dispatchEvent(new Event('close'));
      };
  });

  afterAll(() => {
    HTMLDialogElement.prototype.showModal = realShowModal;
    HTMLDialogElement.prototype.close = realClose;
  });

  function Opener({ viaPointer }: { viaPointer: boolean }) {
    const help = useHelp();
    return (
      <button
        type="button"
        onClick={() => help.open({ viaPointer })}
      >
        opener
      </button>
    );
  }

  function openThenEscape(viaPointer: boolean) {
    render(
      <HelpProvider>
        <Opener viaPointer={viaPointer} />
      </HelpProvider>
    );
    const opener = screen.getByText('opener');
    act(() => {
      opener.focus();
      opener.click();
    });
    const dialog = document.querySelector('dialog')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true,
      }));
    });
    expect(dialog).not.toHaveAttribute('open');
    return opener;
  }

  it('drops focus from a clicked opener', () => {
    const opener = openThenEscape(true);
    expect(document.activeElement).not.toBe(opener);
  });

  it('keeps focus on a keyboard opener', () => {
    const opener = openThenEscape(false);
    expect(document.activeElement).toBe(opener);
  });
});
