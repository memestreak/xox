import { MAX_SAMPLE_FILE_BYTES } from './constants';

/**
 * Which files a track can load as a custom sample. The
 * picker's `accept` string and the check in loadSample
 * share these lists, so they can't drift apart.
 */
export const SAMPLE_EXTENSIONS = ['.wav'];
export const SAMPLE_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
];

export const SAMPLE_ACCEPT = [
  ...SAMPLE_EXTENSIONS, ...SAMPLE_MIME_TYPES,
].join(',');

const BYTES_PER_MB = 1024 * 1024;

export function isSupportedSampleFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SAMPLE_EXTENSIONS.some(ext => name.endsWith(ext))
    || SAMPLE_MIME_TYPES.includes(file.type);
}

/**
 * Why a file can't be loaded, or null if it can be
 * decoded. Type first, then size; both are checked
 * before reading the file.
 */
export function checkSampleFile(file: File): string | null {
  if (!isSupportedSampleFile(file)) {
    return `Only WAV samples are supported (got ${file.name}).`;
  }
  if (file.size > MAX_SAMPLE_FILE_BYTES) {
    const sizeMb = Math.ceil(file.size / BYTES_PER_MB);
    const limitMb = MAX_SAMPLE_FILE_BYTES / BYTES_PER_MB;
    return `${file.name} is too large (${sizeMb} MB).`
      + ` Samples must be under ${limitMb} MB.`;
  }
  return null;
}

export function decodeErrorMessage(fileName: string): string {
  return `Couldn't read ${fileName}. It may be damaged or use`
    + ' an unusual WAV encoding.';
}
