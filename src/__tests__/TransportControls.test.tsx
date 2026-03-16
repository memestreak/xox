import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TransportControls from '../app/TransportControls';
import patternsData from '../app/data/patterns.json';
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

describe('TransportControls pattern dropdown', () => {
  it('shows preset pattern names', () => {
    renderTransport();
    const select = screen.getByLabelText(/pattern/i);
    const options = select.querySelectorAll('option');
    // Should have all presets
    const names = Array.from(options).map(
      o => o.textContent
    );
    expect(names).toContain(patternsData.patterns[0].name);
    expect(names).toContain(patternsData.patterns[1].name);
  });

  it('no "Custom" option when preset is selected', () => {
    renderTransport();
    const select = screen.getByLabelText(/pattern/i);
    const options = Array.from(
      select.querySelectorAll('option')
    );
    const customOpt = options.find(
      o => o.value === 'custom'
    );
    expect(customOpt).toBeUndefined();
  });

  it('selecting a preset changes the pattern', async () => {
    const user = userEvent.setup();
    renderTransport();
    const select = screen.getByLabelText(/pattern/i);
    const target = patternsData.patterns[3];
    await user.selectOptions(select, target.id);
    expect(
      (select as HTMLSelectElement).value
    ).toBe(target.id);
  });
});
