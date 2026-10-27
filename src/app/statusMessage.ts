export type StatusSource = 'load' | 'sample' | 'import';

export interface StatusInputs {
  loadError: string | null;
  sampleError: string | null;
  importNotice: string | null;
}

/**
 * The one message StatusBanner shows: a kit load error,
 * then a refused sample, then a share-link notice.
 */
export function pickStatus(
  inputs: StatusInputs
): { source: StatusSource; message: string } | null {
  if (inputs.loadError) {
    return { source: 'load', message: inputs.loadError };
  }
  if (inputs.sampleError) {
    return { source: 'sample', message: inputs.sampleError };
  }
  if (inputs.importNotice) {
    return { source: 'import', message: inputs.importNotice };
  }
  return null;
}
