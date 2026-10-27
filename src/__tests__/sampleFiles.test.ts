import { describe, expect, it } from 'vitest';
import {
  SAMPLE_ACCEPT,
  checkSampleFile,
  decodeErrorMessage,
  isSupportedSampleFile,
} from '../app/sampleFiles';
import { MAX_SAMPLE_FILE_BYTES } from '../app/constants';

function fileOf(
  name: string, type = '', size = 4
): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('isSupportedSampleFile', () => {
  it('accepts .wav in any case', () => {
    expect(isSupportedSampleFile(fileOf('kick.wav'))).toBe(true);
    expect(isSupportedSampleFile(fileOf('KICK.WAV'))).toBe(true);
  });

  it('accepts a WAV MIME type without the extension', () => {
    expect(
      isSupportedSampleFile(fileOf('kick', 'audio/wav'))
    ).toBe(true);
    expect(
      isSupportedSampleFile(fileOf('kick', 'audio/x-wav'))
    ).toBe(true);
  });

  it('rejects other audio types', () => {
    expect(isSupportedSampleFile(fileOf('loop.aif'))).toBe(false);
    expect(
      isSupportedSampleFile(fileOf('loop.mp3', 'audio/mpeg'))
    ).toBe(false);
    expect(isSupportedSampleFile(fileOf('wav.txt'))).toBe(false);
  });
});

describe('checkSampleFile', () => {
  it('passes a WAV at the size limit', () => {
    expect(
      checkSampleFile(
        fileOf('kick.wav', '', MAX_SAMPLE_FILE_BYTES)
      )
    ).toBeNull();
  });

  it('names the file when the type is wrong', () => {
    expect(checkSampleFile(fileOf('loop.aif'))).toBe(
      'Only WAV samples are supported (got loop.aif).'
    );
  });

  it('refuses a file over the limit, rounding MB up', () => {
    expect(
      checkSampleFile(
        fileOf('big.wav', '', MAX_SAMPLE_FILE_BYTES + 1)
      )
    ).toBe(
      'big.wav is too large (21 MB).'
      + ' Samples must be under 20 MB.'
    );
  });

  it('checks the type before the size', () => {
    expect(
      checkSampleFile(
        fileOf('big.aif', '', MAX_SAMPLE_FILE_BYTES + 1)
      )
    ).toBe('Only WAV samples are supported (got big.aif).');
  });
});

describe('decodeErrorMessage', () => {
  it('names the file', () => {
    expect(decodeErrorMessage('kick.wav')).toBe(
      "Couldn't read kick.wav. It may be damaged or use"
      + ' an unusual WAV encoding.'
    );
  });
});

describe('SAMPLE_ACCEPT', () => {
  it('lists the extension and MIME types', () => {
    expect(SAMPLE_ACCEPT.split(',')).toEqual([
      '.wav', 'audio/wav', 'audio/x-wav',
      'audio/wave', 'audio/vnd.wave',
    ]);
  });
});
