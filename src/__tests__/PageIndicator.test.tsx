import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FollowToggle, PageLights } from '../app/PageIndicator';

describe('PageLights and FollowToggle', () => {
  const defaults = {
    currentPage: 0,
    pageCount: 4,
    autoFollow: true,
    setPage: vi.fn(),
    setAutoFollow: vi.fn(),
  };

  it('renders correct number of page dots', () => {
    render(<PageLights {...defaults} />);
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots.length).toBe(4);
  });

  it('hides the dots when there is only one page', () => {
    render(
      <PageLights {...defaults} pageCount={1} />
    );
    const dots = screen.queryAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots.length).toBe(0);
  });

  it('clicking a dot calls setPage', () => {
    const setPage = vi.fn();
    render(
      <PageLights {...defaults} setPage={setPage} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    fireEvent.click(dots[2]);
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('active dot has orange styling', () => {
    render(
      <PageLights {...defaults} currentPage={1} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots[1].className).toContain('bg-accent');
  });

  it('follow toggle shows active state', () => {
    render(
      <FollowToggle {...defaults} />
    );
    const toggle = screen.getByRole('button', {
      name: /follow/i,
    });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('follow toggle click calls setAutoFollow', () => {
    const setAutoFollow = vi.fn();
    render(
      <FollowToggle
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
      <PageLights {...defaults} pageCount={2} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots.length).toBe(2);
  });

  it('marks the current page light', () => {
    render(
      <PageLights {...defaults} currentPage={2} />
    );
    const dots = screen.getAllByRole('button', {
      name: /^Page \d/,
    });
    expect(dots[2].getAttribute('aria-current')).toBe('true');
    expect(dots[0].hasAttribute('aria-current')).toBe(false);
  });
});
