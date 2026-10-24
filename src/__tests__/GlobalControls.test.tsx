import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalControls from '../app/GlobalControls';
import type { PageNav } from '../app/PageIndicator';

// Mock SequencerContext
const mockSetPatternLength = vi.fn();
const mockSetSwing = vi.fn();

const MOCK_IDS = [
  'ac','bd','sd','ch','oh','cy','ht','mt','lt','rs','cp','cb',
] as const;

function makeMockTracks(len = 16) {
  const t: Record<string, { steps: string }> = {};
  for (const id of MOCK_IDS) {
    t[id] = { steps: '0'.repeat(len) };
  }
  return t;
}

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => ({
    state: {
      swing: 0,
    },
    actions: {
      setPatternLength: mockSetPatternLength,
      setSwing: mockSetSwing,
    },
    meta: {
      config: {
        tracks: makeMockTracks(),
      },
    },
  }),
}));

function makePage(overrides: Partial<PageNav> = {}): PageNav {
  return {
    currentPage: 0,
    pageCount: 1,
    autoFollow: true,
    setPage: vi.fn(),
    setAutoFollow: vi.fn(),
    ...overrides,
  };
}

function renderControls(page = makePage()) {
  return render(<GlobalControls page={page} />);
}

describe('GlobalControls', () => {
  it('renders the steps entry', () => {
    renderControls();
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    expect((input as HTMLInputElement).value).toBe('16');
  });

  it('renders swing knob', () => {
    renderControls();
    const knob = screen.getByRole('slider');
    expect(knob).toBeDefined();
  });

  it('has no Reset key (it is in the grid menu)', () => {
    renderControls();
    expect(screen.queryByRole('button', { name: /reset/i }))
      .not.toBeInTheDocument();
  });

  it('typing a length calls setPatternLength', () => {
    renderControls();
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '8' } });
    expect(mockSetPatternLength).toHaveBeenCalledWith(
      8, expect.anything()
    );
  });

  it('swing knob calls setSwing', () => {
    renderControls();
    const knob = screen.getByRole('slider');
    // Simulate keyboard interaction (ArrowUp)
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(mockSetSwing).toHaveBeenCalled();
  });

  it('limits the steps entry to 1..64', () => {
    renderControls();
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('64');
  });

  it('renders the Follow toggle in the Steps cell', () => {
    const setAutoFollow = vi.fn();
    renderControls(makePage({ setAutoFollow }));
    const follow = screen.getByRole('button', {
      name: /auto-follow playhead/i,
    });
    expect(follow.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(follow);
    expect(setAutoFollow).toHaveBeenCalledWith(false);
  });

  it('renders one page light per page', () => {
    const setPage = vi.fn();
    renderControls(makePage({ pageCount: 3, setPage }));
    const lights = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(lights).toHaveLength(3);
    fireEvent.click(lights[2]);
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('shows no page lights for a single page', () => {
    renderControls();
    expect(
      screen.queryAllByRole('button', { name: /^Page \d/ })
    ).toHaveLength(0);
  });
});
