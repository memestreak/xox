import { describe, expect, it } from 'vitest';
import {
  decodeConfig,
  defaultConfig,
  encodeConfig,
} from '../app/configCodec';
import type { SequencerConfig } from '../app/types';
import { TRACK_IDS } from '../app/types';

/**
 * Helper: build a config with overrides merged into defaults.
 */
function makeConfig(
  overrides: Partial<SequencerConfig> = {}
): SequencerConfig {
  return { ...defaultConfig(), ...overrides };
}

/**
 * Helper: encode a raw object as if it were a valid config,
 * bypassing validation on the encode side.
 */
async function encodeRaw(obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  const stream = new Blob([json]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// -------------------------------------------------------
// A. Round-trip fidelity
// -------------------------------------------------------
describe('round-trip fidelity', () => {
  it('default config round-trips identically', async () => {
    const config = defaultConfig();
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
  });

  it('config with all steps set to 1', async () => {
    const config = defaultConfig();
    for (const id of TRACK_IDS) {
      config.steps[id] = '1111111111111111';
    }
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
  });

  it('config with mixed mixer states', async () => {
    const config = defaultConfig();
    config.mixer.bd = {
      gain: 0.3, isMuted: true, isSolo: false,
      freeRun: false,
    };
    config.mixer.sd = {
      gain: 0.7, isMuted: false, isSolo: true,
      freeRun: true,
    };
    config.mixer.ch = {
      gain: 0, isMuted: true, isSolo: true,
      freeRun: false,
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
  });

  it('config with edge BPM values', async () => {
    for (const bpm of [20, 300]) {
      const config = makeConfig({ bpm });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded).toEqual(config);
    }
  });

  it('config with each kit ID', async () => {
    for (const kitId of ['808', 'electro']) {
      const config = makeConfig({ kitId });
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded).toEqual(config);
    }
  });

  it('config with custom lengths and freeRun', async () => {
    const config = JSON.parse(
      JSON.stringify(defaultConfig())
    ) as SequencerConfig;
    config.patternLength = 12;
    for (const id of TRACK_IDS) {
      config.trackLengths[id] = 12;
      config.steps[id] =
        config.steps[id].substring(0, 12);
    }
    config.trackLengths.bd = 5;
    config.steps.bd = '10100';
    config.trackLengths.sd = 8;
    config.steps.sd = '10101010';
    config.mixer.bd.freeRun = true;
    config.mixer.ch.freeRun = true;
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
    expect(decoded.patternLength).toBe(12);
    expect(decoded.trackLengths.bd).toBe(5);
    expect(decoded.trackLengths.sd).toBe(8);
    expect(decoded.mixer.bd.freeRun).toBe(true);
    expect(decoded.mixer.ch.freeRun).toBe(true);
    expect(decoded.mixer.sd.freeRun).toBe(false);
  });
});

// -------------------------------------------------------
// B. Defensive decoding
// -------------------------------------------------------
describe('defensive decoding', () => {
  it('empty string rejects', async () => {
    await expect(decodeConfig('')).rejects.toThrow();
  });

  it('random non-base64 string rejects', async () => {
    await expect(
      decodeConfig('not!valid@base64#')
    ).rejects.toThrow();
  });

  it('valid base64 but invalid JSON rejects', async () => {
    // "hello" in base64url -- valid base64 but not
    // deflate-compressed JSON
    await expect(decodeConfig('aGVsbG8')).rejects.toThrow();
  });

  it('valid JSON {} merges with defaults', async () => {
    const hash = await encodeRaw({});
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(defaultConfig());
  });

  it('valid JSON null returns defaults', async () => {
    const hash = await encodeRaw(null);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(defaultConfig());
  });

  it('extra unknown fields are ignored', async () => {
    const config = defaultConfig();
    const raw = { ...config, unknownField: 'surprise' };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
  });

  it('wrong version number is overwritten', async () => {
    const config = defaultConfig();
    const raw = { ...config, version: 999 };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.version).toBe(3);
  });

  it('partial config (only kitId) fills defaults', async () => {
    const hash = await encodeRaw({ kitId: 'electro' });
    const decoded = await decodeConfig(hash);
    const defaults = defaultConfig();
    expect(decoded.kitId).toBe('electro');
    expect(decoded.bpm).toBe(defaults.bpm);
    expect(decoded.steps).toEqual(defaults.steps);
    expect(decoded.mixer).toEqual(defaults.mixer);
  });

  it('missing tracks in steps filled from default', async () => {
    const config = defaultConfig();
    // Only provide bd and sd steps
    const partialSteps = {
      bd: '1010101010101010',
      sd: '0101010101010101',
    };
    const raw = { ...config, steps: partialSteps };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.steps.bd).toBe('1010101010101010');
    expect(decoded.steps.sd).toBe('0101010101010101');
    // Missing tracks should use defaults
    const defaults = defaultConfig();
    for (const id of TRACK_IDS) {
      if (id !== 'bd' && id !== 'sd') {
        expect(decoded.steps[id]).toBe(defaults.steps[id]);
      }
    }
  });

  it('missing tracks in mixer filled from default', async () => {
    const config = defaultConfig();
    const partialMixer = {
      bd: { gain: 0.5, isMuted: true, isSolo: false },
    };
    const raw = { ...config, mixer: partialMixer };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.mixer.bd.gain).toBe(0.5);
    expect(decoded.mixer.bd.isMuted).toBe(true);
    const defaults = defaultConfig();
    for (const id of TRACK_IDS) {
      if (id !== 'bd') {
        expect(decoded.mixer[id]).toEqual(defaults.mixer[id]);
      }
    }
  });
});

// -------------------------------------------------------
// C. Field-level validation (via encodeRaw + decodeConfig)
// -------------------------------------------------------
describe('validateKitId', () => {
  it('"808" passes through', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), kitId: '808' });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });

  it('"electro" passes through', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), kitId: 'electro' });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('electro');
  });

  it('unknown string falls back to "808"', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), kitId: 'unknown' });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });

  it('non-string falls back to "808"', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), kitId: 123 });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });

  it('null falls back to "808"', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), kitId: null });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });
});

describe('validateBpm', () => {
  it('110 passes through', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: 110 });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });

  it('below minimum clamped to 20', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: 10 });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(20);
  });

  it('above maximum clamped to 300', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: 500 });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(300);
  });

  it('float rounded to integer', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: 120.7 });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(121);
  });

  it('NaN defaults to 110', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: NaN });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });

  it('Infinity defaults to 110', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: Infinity });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });

  it('non-number defaults to 110', async () => {
    const hash = await encodeRaw({ ...defaultConfig(), bpm: 'fast' });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });
});

describe('validateSteps', () => {
  it('valid 16-char binary string passes', async () => {
    const config = defaultConfig();
    config.steps.bd = '1010101010101010';
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.steps.bd).toBe('1010101010101010');
  });

  it('short string is padded to track length', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      steps: { ...config.steps, bd: '101010101010101' },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    // 15-char string padded with '0' to 16
    expect(decoded.steps.bd).toBe('1010101010101010');
  });

  it('non-binary chars use fallback', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      steps: { ...config.steps, bd: '10102010xxxxxxxx' },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.steps.bd).toBe(defaultConfig().steps.bd);
  });

  it('null steps uses entire fallback', async () => {
    const raw = { ...defaultConfig(), steps: null };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.steps).toEqual(defaultConfig().steps);
  });
});

describe('swing serialization', () => {
  it('config with swing round-trips', async () => {
    const config = makeConfig({ swing: 50 });
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
    expect(decoded.swing).toBe(50);
  });

  it('missing swing defaults to 0', async () => {
    const config = defaultConfig();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { swing: _swing, ...noSwing } = config;
    const hash = await encodeRaw(noSwing);
    const decoded = await decodeConfig(hash);
    expect(decoded.swing).toBe(0);
  });

  it('swing clamped to 0-100', async () => {
    const below = await encodeRaw({
      ...defaultConfig(), swing: -10,
    });
    expect((await decodeConfig(below)).swing).toBe(0);

    const above = await encodeRaw({
      ...defaultConfig(), swing: 200,
    });
    expect((await decodeConfig(above)).swing).toBe(100);
  });

  it('non-number swing defaults to 0', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), swing: 'high',
    });
    expect((await decodeConfig(hash)).swing).toBe(0);
  });
});

// -------------------------------------------------------
// D. TrigCondition validation
// -------------------------------------------------------
describe('validateTrigConditions', () => {
  it('missing trigConditions defaults to empty', async () => {
    const config = defaultConfig();
    const { trigConditions, ...noTc } = config;
    void trigConditions; // intentionally omitted
    const hash = await encodeRaw(noTc);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({});
  });

  it('valid probability condition round-trips', async () => {
    const config = defaultConfig();
    config.trigConditions = {
      bd: { 0: { type: 'probability', value: 50 } },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({
      bd: { 0: { type: 'probability', value: 50 } },
    });
  });

  it('valid cycle condition round-trips', async () => {
    const config = defaultConfig();
    config.trigConditions = {
      sd: { 2: { type: 'cycle', a: 1, b: 4 } },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({
      sd: { 2: { type: 'cycle', a: 1, b: 4 } },
    });
  });

  it('invalid type is dropped', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      trigConditions: {
        bd: { 0: { type: 'random', value: 50 } },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({});
  });

  it('probability value clamped to 1-99', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      trigConditions: {
        bd: {
          0: { type: 'probability', value: 0 },
          1: { type: 'probability', value: 100 },
          2: { type: 'probability', value: 50 },
        },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions.bd?.[0]).toEqual(
      { type: 'probability', value: 1 }
    );
    expect(decoded.trigConditions.bd?.[1]).toEqual(
      { type: 'probability', value: 99 }
    );
    expect(decoded.trigConditions.bd?.[2]).toEqual(
      { type: 'probability', value: 50 }
    );
  });

  it('cycle b clamped to max 8', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      trigConditions: {
        bd: { 0: { type: 'cycle', a: 1, b: 16 } },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions.bd?.[0]).toEqual(
      { type: 'cycle', a: 1, b: 8 }
    );
  });

  it('cycle b=1 is dropped', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      trigConditions: {
        bd: { 0: { type: 'cycle', a: 1, b: 1 } },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({});
  });

  it('cycle a>b is clamped to a=b', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      trigConditions: {
        bd: { 0: { type: 'cycle', a: 5, b: 3 } },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions.bd?.[0]).toEqual(
      { type: 'cycle', a: 3, b: 3 }
    );
  });

  it('step index beyond track length is dropped', async () => {
    const config = defaultConfig();
    // Default track length is 16, step 16 is out of bounds
    const raw = {
      ...config,
      trigConditions: {
        bd: { 16: { type: 'probability', value: 50 } },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({});
  });

  it('non-object trigConditions defaults to empty', async () => {
    const raw = { ...defaultConfig(), trigConditions: 'bad' };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.trigConditions).toEqual({});
  });
});

describe('validateMixer', () => {
  it('negative gain clamped to 0', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { gain: -0.5, isMuted: false, isSolo: false },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.mixer.bd.gain).toBe(0);
  });

  it('gain above 1 clamped to 1', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { gain: 1.5, isMuted: false, isSolo: false },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.mixer.bd.gain).toBe(1);
  });

  it('non-boolean isMuted uses fallback', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { gain: 0.8, isMuted: 'yes', isSolo: false },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.mixer.bd.isMuted).toBe(false);
    expect(decoded.mixer.bd.gain).toBe(0.8);
  });
});
