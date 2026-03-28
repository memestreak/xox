import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TransportControls from '../app/TransportControls';
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

function renderTransport() {
  return render(
    <TestWrapper>
      <TransportControls />
    </TestWrapper>
  );
}

describe('TransportControls pattern picker', () => {
  it('shows pattern picker trigger button', () => {
    renderTransport();
    expect(
      screen.getByRole('button', { name: /pattern/i })
    ).toBeInTheDocument();
  });

  it('opens modal on trigger click', async () => {
    const user = userEvent.setup();
    renderTransport();
    await user.click(
      screen.getByRole('button', { name: /pattern/i })
    );
    expect(
      screen.getByRole('dialog')
    ).toBeInTheDocument();
  });

  it('shows category pills in modal', async () => {
    const user = userEvent.setup();
    renderTransport();
    await user.click(
      screen.getByRole('button', { name: /pattern/i })
    );
    expect(
      screen.getByRole('button', { name: 'House' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rock' })
    ).toBeInTheDocument();
  });
});
