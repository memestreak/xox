import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SettingsPopover from '../app/SettingsPopover';
import { TestWrapper } from './helpers/sequencer-wrapper';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
  },
}));

function renderPopover() {
  return render(
    <TestWrapper>
      <SettingsPopover />
    </TestWrapper>
  );
}

describe('SettingsPopover', () => {
  it('popover is hidden initially', () => {
    renderPopover();
    expect(
      screen.queryByRole('menu')
    ).not.toBeInTheDocument();
  });

  it('click gear opens popover', async () => {
    const user = userEvent.setup();
    renderPopover();
    await user.click(
      screen.getByRole('button', { name: /settings/i })
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /export url/i })
    ).toBeInTheDocument();
  });

  it('click outside closes popover', async () => {
    const user = userEvent.setup();
    renderPopover();
    await user.click(
      screen.getByRole('button', { name: /settings/i })
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(document.body);
    expect(
      screen.queryByRole('menu')
    ).not.toBeInTheDocument();
  });

  it('export updates URL hash and shows Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const replaceState = vi.spyOn(
      window.history, 'replaceState'
    );

    renderPopover();

    // Use fireEvent to avoid userEvent clipboard layer
    fireEvent.click(
      screen.getByRole('button', { name: /settings/i })
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: /export url/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Copied!')
      ).toBeInTheDocument();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedUrl = writeText.mock.calls[0][0] as string;
    expect(copiedUrl).toContain('#');

    expect(replaceState).toHaveBeenCalled();
    const hashArg = replaceState.mock.calls[0][2] as string;
    expect(hashArg).toMatch(/^#/);

    replaceState.mockRestore();
  });

  it('export failure shows Failed feedback', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(
          new Error('denied')
        ),
      },
      writable: true,
      configurable: true,
    });

    renderPopover();

    fireEvent.click(
      screen.getByRole('button', { name: /settings/i })
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: /export url/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Failed')
      ).toBeInTheDocument();
    });
  });
});
