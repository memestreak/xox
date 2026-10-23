// MOCK ONLY: picks a collapse-empty-tracks variant from
// the ?mock= query (A to E; E = B with a right-click minimize). Not for merging.
import { useSyncExternalStore } from 'react';

export type MockVariant = '' | 'A' | 'B' | 'C' | 'D' | 'E';

const read = (): MockVariant => {
  const v = new URLSearchParams(window.location.search)
    .get('mock')?.toUpperCase() ?? '';
  return (['A', 'B', 'C', 'D', 'E'].includes(v) ? v : '') as MockVariant;
};

export function useMockVariant(): MockVariant {
  return useSyncExternalStore(
    () => () => {}, read, () => ''
  );
}
