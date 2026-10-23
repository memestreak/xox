import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalControls from '../app/GlobalControls';
import type { PageNav } from '../app/PageIndicator';

// Mock SequencerContext
const mockSetPatternLength = vi.fn();
const mockSetSwing = vi.fn();
const mockClearAll = vi.fn();

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
      clearAll: mockClearAll,
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
  it('renders steps dropdown', () => {
    renderControls();
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    expect(
      (select as HTMLSelectElement).value
    ).toBe('16');
  });

  it('renders swing knob', () => {
    renderControls();
    const knob = screen.getByRole('slider');
    expect(knob).toBeDefined();
  });

  it('renders clear button', () => {
    renderControls();
    const btn = screen.getByRole('button', { name: /reset/i });
    expect(btn).toBeDefined();
  });

  it('steps change calls setPatternLength', () => {
    renderControls();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, {
      target: { value: '8' },
    });
    expect(mockSetPatternLength).toHaveBeenCalledWith(8);
  });

  it('clear button calls clearAll after confirming', () => {
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValue(true);
    renderControls();
    const btn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(btn);
    expect(confirm).toHaveBeenCalled();
    expect(mockClearAll).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('clear button does nothing if not confirmed', () => {
    mockClearAll.mockClear();
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValue(false);
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(mockClearAll).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('swing knob calls setSwing', () => {
    renderControls();
    const knob = screen.getByRole('slider');
    // Simulate keyboard interaction (ArrowUp)
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(mockSetSwing).toHaveBeenCalled();
  });

  it('renders 64 step options', () => {
    renderControls();
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(64);
    expect(options[0].value).toBe('1');
    expect(options[63].value).toBe('64');
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
