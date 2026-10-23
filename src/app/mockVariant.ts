// MOCK ONLY: picks a collapse-empty-tracks variant from
// the ?mock= query (A, B, C or D). Not for merging.
import { useSyncExternalStore } from 'react';

export type MockVariant = '' | 'A' | 'B' | 'C' | 'D';

const read = (): MockVariant => {
  const v = new URLSearchParams(window.location.search)
    .get('mock')?.toUpperCase() ?? '';
  return (['A', 'B', 'C', 'D'].includes(v) ? v : '') as MockVariant;
};

export function useMockVariant(): MockVariant {
  return useSyncExternalStore(
    () => () => {}, read, () => ''
  );
}
