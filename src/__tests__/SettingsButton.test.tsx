import {
  render, screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  beforeAll, describe, expect, it, vi,
} from 'vitest';
import SettingsButton from '../app/SettingsButton';
import { TestWrapper } from './helpers/sequencer-wrapper';
import { HelpProvider } from '../app/HelpContext';

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

describe('SettingsButton', () => {
  it('the gear opens the Settings dialog directly', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SettingsButton />
      </TestWrapper>
    );
    await user.click(
      screen.getByRole('button', { name: 'Settings' })
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Settings' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Auto-minimize empty tracks',
      })
    ).toBeInTheDocument();
  });

  it('the dialog\'s ? key closes Settings and opens Help', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <HelpProvider>
          <SettingsButton />
        </HelpProvider>
      </TestWrapper>
    );
    await user.click(
      screen.getByRole('button', { name: 'Settings' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Help and shortcuts' })
    );
    expect(
      screen.getByRole('heading', { name: 'Help' })
    ).toBeInTheDocument();
    expect(
      // Level 2: Help has its own "Settings" section.
      screen.queryByRole('heading', { name: 'Settings', level: 2 })
    ).toBeNull();
  });
});
