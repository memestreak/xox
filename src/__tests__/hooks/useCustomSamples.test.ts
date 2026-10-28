import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { useCustomSamples } from '../../app/hooks/useCustomSamples';
import { audioEngine } from '../../app/AudioEngine';
import { MAX_SAMPLE_FILE_BYTES } from '../../app/constants';

vi.mock('../../app/AudioEngine', () => ({
  audioEngine: {
    decodeSample: vi.fn(),
    setCustomSample: vi.fn(),
    clearCustomSample: vi.fn(),
    clearCustomSamples: vi.fn(),
  },
}));

const engine = vi.mocked(audioEngine);

function wav(name = 'kick.wav', size = 4): File {
  const file = new File(['x'], name, { type: 'audio/wav' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** A decode we resolve or reject by hand. */
function deferredDecode() {
  let resolve!: (b: AudioBuffer) => void;
  let reject!: (e: Error) => void;
  engine.decodeSample.mockImplementationOnce(
    () => new Promise<AudioBuffer>((res, rej) => {
      resolve = res;
      reject = rej;
    })
  );
  return {
    resolve: (b: AudioBuffer) => resolve(b),
    reject: () => reject(new Error('bad')),
  };
}

const bufA = { a: 1 } as unknown as AudioBuffer;
const bufB = { b: 1 } as unknown as AudioBuffer;

beforeEach(() => {
  vi.clearAllMocks();
  engine.decodeSample.mockResolvedValue(bufA);
});

describe('useCustomSamples', () => {
  it('starts with no samples and no error', () => {
    const { result } = renderHook(() => useCustomSamples());
    expect(result.current.customSamples).toEqual({});
    expect(result.current.sampleError).toBeNull();
  });

  it('loads a WAV onto a track', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const file = wav();
    await act(() => result.current.loadSample('sd', file));
    expect(engine.decodeSample).toHaveBeenCalledWith(file);
    expect(engine.setCustomSample)
      .toHaveBeenCalledWith('sd', bufA);
    expect(result.current.customSamples.sd).toBe(file);
  });

  it('refuses a non-WAV without decoding', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample('sd', new File(['x'], 'a.aif'))
    );
    expect(engine.decodeSample).not.toHaveBeenCalled();
    expect(result.current.sampleError).toBe(
      'Only WAV samples are supported (got a.aif).'
    );
    expect(result.current.customSamples.sd).toBeUndefined();
  });

  it('refuses a file over the size limit', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample(
        'sd', wav('big.wav', MAX_SAMPLE_FILE_BYTES + 1)
      )
    );
    expect(engine.decodeSample).not.toHaveBeenCalled();
    expect(result.current.sampleError)
      .toMatch(/^big\.wav is too large/);
  });

  it('keeps the previous sample when decoding fails',
    async () => {
      const { result } = renderHook(() => useCustomSamples());
      const first = wav('first.wav');
      await act(() => result.current.loadSample('sd', first));
      engine.decodeSample.mockRejectedValueOnce(
        new Error('bad')
      );
      await act(() =>
        result.current.loadSample('sd', wav('broken.wav'))
      );
      expect(result.current.customSamples.sd).toBe(first);
      expect(engine.setCustomSample).toHaveBeenCalledTimes(1);
      expect(result.current.sampleError).toBe(
        "Couldn't read broken.wav. It may be damaged or use"
        + ' an unusual WAV encoding.'
      );
    }
  );

  it('a successful load clears the error', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample('sd', new File(['x'], 'a.aif'))
    );
    expect(result.current.sampleError).not.toBeNull();
    await act(() => result.current.loadSample('sd', wav()));
    expect(result.current.sampleError).toBeNull();
  });

  it('dismissSampleError clears the error', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() =>
      result.current.loadSample('sd', new File(['x'], 'a.aif'))
    );
    act(() => result.current.dismissSampleError());
    expect(result.current.sampleError).toBeNull();
  });

  it('resetSample clears one track', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() => result.current.loadSample('sd', wav()));
    await act(() => result.current.loadSample('oh', wav()));
    act(() => result.current.resetSample('sd'));
    expect(engine.clearCustomSample).toHaveBeenCalledWith('sd');
    expect(result.current.customSamples.sd).toBeUndefined();
    expect(result.current.customSamples.oh).toBeDefined();
  });

  it('resetAllSamples clears every track', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() => result.current.loadSample('sd', wav()));
    await act(() => result.current.loadSample('oh', wav()));
    act(() => result.current.resetAllSamples());
    expect(engine.clearCustomSamples).toHaveBeenCalled();
    expect(result.current.customSamples).toEqual({});
  });

  it('toggleSample switches to the kit and back', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const file = wav();
    await act(() => result.current.loadSample('sd', file));
    expect(result.current.disabledSamples).toEqual({});

    act(() => result.current.toggleSample('sd'));
    expect(engine.clearCustomSample).toHaveBeenCalledWith('sd');
    expect(result.current.disabledSamples).toEqual({ sd: true });
    // The file is kept while off.
    expect(result.current.customSamples.sd).toBe(file);

    act(() => result.current.toggleSample('sd'));
    expect(engine.setCustomSample).toHaveBeenCalledTimes(2);
    expect(engine.setCustomSample)
      .toHaveBeenLastCalledWith('sd', bufA);
    expect(engine.decodeSample).toHaveBeenCalledTimes(1);
    expect(result.current.disabledSamples).toEqual({});
  });

  it('toggleSample ignores a kit-sample track', () => {
    const { result } = renderHook(() => useCustomSamples());
    act(() => result.current.toggleSample('sd'));
    expect(engine.clearCustomSample).not.toHaveBeenCalled();
    expect(result.current.disabledSamples).toEqual({});
  });

  it('a new load turns the sample back on', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() => result.current.loadSample('sd', wav()));
    act(() => result.current.toggleSample('sd'));
    engine.decodeSample.mockResolvedValueOnce(bufB);
    await act(() =>
      result.current.loadSample('sd', wav('snare.wav'))
    );
    expect(engine.setCustomSample)
      .toHaveBeenLastCalledWith('sd', bufB);
    expect(result.current.disabledSamples).toEqual({});
  });

  it('reset forgets a sample that was off', async () => {
    const { result } = renderHook(() => useCustomSamples());
    await act(() => result.current.loadSample('sd', wav()));
    await act(() => result.current.loadSample('oh', wav()));
    act(() => result.current.toggleSample('sd'));
    act(() => result.current.toggleSample('oh'));
    act(() => result.current.resetSample('sd'));
    expect(result.current.disabledSamples).toEqual({ oh: true });
    act(() => result.current.resetAllSamples());
    expect(result.current.disabledSamples).toEqual({});
    engine.setCustomSample.mockClear();
    act(() => result.current.toggleSample('oh'));
    expect(engine.setCustomSample).not.toHaveBeenCalled();
  });

  it('the load started last wins', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    const fast = deferredDecode();
    const older = wav('older.wav');
    const newer = wav('newer.wav');
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.loadSample('sd', older);
      p2 = result.current.loadSample('sd', newer);
    });
    await act(async () => {
      fast.resolve(bufB);
      await p2;
      slow.resolve(bufA);
      await p1;
    });
    expect(result.current.customSamples.sd).toBe(newer);
    expect(engine.setCustomSample).toHaveBeenCalledTimes(1);
    expect(engine.setCustomSample)
      .toHaveBeenCalledWith('sd', bufB);
  });

  it('a stale decode failure shows no error', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    let p1!: Promise<void>;
    act(() => {
      p1 = result.current.loadSample('sd', wav('old.wav'));
    });
    await act(() => result.current.loadSample('sd', wav()));
    await act(async () => {
      slow.reject();
      await p1;
    });
    expect(result.current.sampleError).toBeNull();
  });

  it('a reset during a load wins', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    let p!: Promise<void>;
    act(() => {
      p = result.current.loadSample('sd', wav());
    });
    act(() => result.current.resetSample('sd'));
    await act(async () => {
      slow.resolve(bufA);
      await p;
    });
    expect(engine.setCustomSample).not.toHaveBeenCalled();
    expect(result.current.customSamples.sd).toBeUndefined();
  });

  it('reset all during a load wins', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const slow = deferredDecode();
    let p!: Promise<void>;
    act(() => {
      p = result.current.loadSample('oh', wav());
    });
    act(() => result.current.resetAllSamples());
    await act(async () => {
      slow.resolve(bufA);
      await p;
    });
    expect(engine.setCustomSample).not.toHaveBeenCalled();
  });

  it('keeps its actions stable', async () => {
    const { result } = renderHook(() => useCustomSamples());
    const before = result.current;
    await act(() => result.current.loadSample('sd', wav()));
    expect(result.current.loadSample).toBe(before.loadSample);
    expect(result.current.resetSample).toBe(before.resetSample);
    expect(result.current.resetAllSamples)
      .toBe(before.resetAllSamples);
    expect(result.current.toggleSample)
      .toBe(before.toggleSample);
    expect(result.current.dismissSampleError)
      .toBe(before.dismissSampleError);
  });

  it('has no reset() (Reset keeps custom samples)', () => {
    const { result } = renderHook(() => useCustomSamples());
    expect('reset' in result.current).toBe(false);
  });
});
