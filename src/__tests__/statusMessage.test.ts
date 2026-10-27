import { describe, expect, it } from 'vitest';
import { pickStatus } from '../app/statusMessage';

const none = {
  loadError: null, sampleError: null, importNotice: null,
};

describe('pickStatus', () => {
  it('is null when there is nothing to show', () => {
    expect(pickStatus(none)).toBeNull();
  });

  it('shows a kit load error first', () => {
    expect(pickStatus({
      loadError: 'kit', sampleError: 'sample',
      importNotice: 'link',
    })).toEqual({ source: 'load', message: 'kit' });
  });

  it('shows a sample error before a link notice', () => {
    expect(pickStatus({
      ...none, sampleError: 'sample', importNotice: 'link',
    })).toEqual({ source: 'sample', message: 'sample' });
  });

  it('shows a link notice last', () => {
    expect(pickStatus({ ...none, importNotice: 'link' }))
      .toEqual({ source: 'import', message: 'link' });
  });
});
