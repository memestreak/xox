// MOCK ONLY: latching key variants for Fill and Temp.
// ?mock=A|B|C picks the variant; ?fill= and ?temp= force
// a look for screenshots. Not for merging.
import { useSyncExternalStore } from 'react';

export type LatchVariant = '' | 'A' | 'B' | 'C';

/** off | held (momentary) | armed | active (Temp) */
export type BodyState = 'off' | 'held' | 'armed' | 'active';

export interface ForcedLook {
  body: BodyState;
  latched: boolean;
  disabled: boolean;
}

const param = (k: string) =>
  new URLSearchParams(window.location.search).get(k) ?? '';

const readVariant = (): LatchVariant => {
  const v = param('mock').toUpperCase();
  return (['A', 'B', 'C'].includes(v) ? v : '') as LatchVariant;
};

export function useLatchVariant(): LatchVariant {
  return useSyncExternalStore(() => () => {}, readVariant, () => '');
}

// "held", "latched", "held+latched", "stopped", "stopped+latched"...
const parseLook = (raw: string): ForcedLook | null => {
  if (!raw) return null;
  const parts = raw.split('+');
  const body = (['held', 'armed', 'active'].find(p => parts.includes(p))
    ?? 'off') as BodyState;
  return {
    body,
    latched: parts.includes('latched'),
    disabled: parts.includes('stopped'),
  };
};

const cache = new Map<string, ForcedLook | null>();
export function useForcedLook(key: 'fill' | 'temp'): ForcedLook | null {
  const raw = useSyncExternalStore(() => () => {}, () => param(key), () => '');
  if (!cache.has(raw)) cache.set(raw, parseLook(raw));
  return cache.get(raw) ?? null;
}
