import { describe, expect, it } from 'vitest';
import { TRACK_IDS } from '../app/types';

describe('TRACK_IDS', () => {
  it('ordering matches snapshot (append-only)', () => {
    // TRACK_IDS is documented as append-only. Reordering
    // would silently corrupt serialized mixer data in
    // existing URLs.
    expect(TRACK_IDS).toEqual([
      'ac', 'bd', 'sd', 'ch', 'oh', 'cy',
      'ht', 'mt', 'lt', 'rs', 'cp', 'cb',
    ]);
  });
});
