import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PageIndicator from '../app/PageIndicator';

describe('PageIndicator', () => {
  const defaults = {
    currentPage: 0,
    pageCount: 4,
    autoFollow: true,
    setPage: vi.fn(),
    setAutoFollow: vi.fn(),
  };

  it('renders correct number of page dots', () => {
    render(<PageIndicator {...defaults} />);
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots.length).toBe(4);
  });

  it('renders single dot when pageCount is 1', () => {
    render(
      <PageIndicator {...defaults} pageCount={1} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots.length).toBe(1);
  });

  it('clicking a dot calls setPage', () => {
    const setPage = vi.fn();
    render(
      <PageIndicator {...defaults} setPage={setPage} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    fireEvent.click(dots[2]);
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('active dot has orange styling', () => {
    render(
      <PageIndicator {...defaults} currentPage={1} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots[1].className).toContain('bg-orange');
  });

  it('follow toggle shows active state', () => {
    render(
      <PageIndicator {...defaults} autoFollow={true} />
    );
    const toggle = screen.getByRole('button', {
      name: /follow/i,
    });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('follow toggle click calls setAutoFollow', () => {
    const setAutoFollow = vi.fn();
    render(
      <PageIndicator
        {...defaults}
        setAutoFollow={setAutoFollow}
      />
    );
    const toggle = screen.getByRole('button', {
      name: /follow/i,
    });
    fireEvent.click(toggle);
    expect(setAutoFollow).toHaveBeenCalledWith(false);
  });

  it('dynamic dot count: 2 dots for pageCount=2', () => {
    render(
      <PageIndicator {...defaults} pageCount={2} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots.length).toBe(2);
  });
});
