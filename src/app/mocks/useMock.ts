'use client';

/**
 * Mocks: UI options a branch offers while Jeremy picks
 * between looks (`docs/specs/2026-11-01-mock-switcher-design.md`).
 * A component declares each mock with `useMock`, which
 * reads its choice from the link (`?mock=b`). The
 * `MockSwitcher` that `Sequencer` mounts lists the
 * declared mocks and switches them in place.
 */
import { useEffect, useSyncExternalStore } from 'react';

export type MockOption = { value: string; label: string };

/**
 * One mock: its link parameter, its name in the
 * switcher, and its options (the first is the default).
 */
export type Mock = {
  param: string;
  label: string;
  options: readonly MockOption[];
};

const NONE: readonly Mock[] = [];

/** The mocks declared now, in declaration order. */
let mocks: readonly Mock[] = NONE;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Back and Forward change the link without telling us.
  if (listeners.size === 1) {
    window.addEventListener('popstate', changed);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('popstate', changed);
    }
  };
}

/** The link's query, e.g. `?mock=b&blue=2` (none on the server). */
function useSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
}

/**
 * The option `search` picks for `mock`: the one named in
 * the link, else the first.
 */
export function chosen(mock: Mock, search: string): string {
  const value = new URLSearchParams(search).get(mock.param);
  const known = mock.options.find(o => o.value === value);
  return known ? known.value : mock.options[0].value;
}

/**
 * Declares a mock while the component is mounted and
 * returns the chosen option's value. Pass a module
 * constant: a new object each render re-declares it.
 */
export function useMock(mock: Mock): string {
  useEffect(() => {
    mocks = [...mocks, mock];
    changed();
    return () => {
      mocks = mocks.filter(m => m !== mock);
      changed();
    };
  }, [mock]);
  return chosen(mock, useSearch());
}

/**
 * Switches a mock to `value` in place: rewrites the
 * link (keeping the hash) with no reload and no new
 * history entry.
 */
export function setMock(mock: Mock, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(mock.param, value);
  window.history.replaceState(window.history.state, '', url);
  changed();
}

/**
 * For the switcher: every declared mock once the link
 * names any of them, else none (the switcher hides).
 */
export function useShownMocks(): {
  mocks: readonly Mock[];
  search: string;
} {
  const search = useSearch();
  const declared = useSyncExternalStore(
    subscribe,
    () => mocks,
    () => NONE,
  );
  const params = new URLSearchParams(search);
  const named = declared.some(m => params.has(m.param));
  return { mocks: named ? declared : NONE, search };
}
