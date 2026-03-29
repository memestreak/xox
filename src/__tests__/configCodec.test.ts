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
      config.tracks[id].steps = '1111111111111111';
    }
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
  });

  it('config with mixed mixer states', async () => {
    const config = defaultConfig();
    config.mixer.bd = {
      gain: 0.3, isMuted: true, isSolo: false,
    };
    config.mixer.sd = {
      gain: 0.7, isMuted: false, isSolo: true,
    };
    config.mixer.ch = {
      gain: 0, isMuted: true, isSolo: true,
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

  it('config with varied track lengths and freeRun',
    async () => {
      const config = JSON.parse(
        JSON.stringify(defaultConfig())
      ) as SequencerConfig;
      config.tracks.bd = {
        steps: '10100', freeRun: true,
      };
      config.tracks.sd = {
        steps: '10101010',
      };
      config.tracks.ch = {
        steps: '101010101010', freeRun: true,
      };
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded).toEqual(config);
      expect(decoded.tracks.bd.steps.length).toBe(5);
      expect(decoded.tracks.sd.steps.length).toBe(8);
      expect(decoded.tracks.bd.freeRun).toBe(true);
      expect(decoded.tracks.ch.freeRun).toBe(true);
      expect(decoded.tracks.sd.freeRun).toBeUndefined();
    }
  );

  it('config with trigConditions in tracks', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { probability: 50 },
    };
    config.tracks.sd.trigConditions = {
      2: { cycle: { a: 1, b: 4 } },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
  });

  it('config with parameterLocks in tracks', async () => {
    const config = defaultConfig();
    config.tracks.bd.parameterLocks = {
      0: { gain: 0.5 }, 3: { gain: 0.8 },
    };
    config.tracks.sd.parameterLocks = {
      7: { gain: 0.2 },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(config);
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
    await expect(decodeConfig('aGVsbG8')).rejects.toThrow();
  });

  it('valid JSON {} returns defaults (no version)',
    async () => {
      const hash = await encodeRaw({});
      const decoded = await decodeConfig(hash);
      expect(decoded).toEqual(defaultConfig());
    }
  );

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

  it('wrong version number returns defaults', async () => {
    const config = defaultConfig();
    const raw = { ...config, version: 999 };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(defaultConfig());
  });

  it('old version 3 returns defaults', async () => {
    const raw = {
      version: 3,
      kitId: 'electro',
      bpm: 140,
      steps: {},
      mixer: {},
      swing: 0,
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded).toEqual(defaultConfig());
  });

  it('partial config without version returns defaults',
    async () => {
      const hash = await encodeRaw({ kitId: 'electro' });
      const decoded = await decodeConfig(hash);
      expect(decoded).toEqual(defaultConfig());
    }
  );

  it('missing tracks in config filled from default',
    async () => {
      const config = defaultConfig();
      // Only provide bd and sd tracks
      const partialTracks = {
        bd: { steps: '1010101010101010' },
        sd: { steps: '0101010101010101' },
      };
      const raw = { ...config, tracks: partialTracks };
      const hash = await encodeRaw(raw);
      const decoded = await decodeConfig(hash);
      expect(decoded.tracks.bd.steps).toBe(
        '1010101010101010'
      );
      expect(decoded.tracks.sd.steps).toBe(
        '0101010101010101'
      );
      // Missing tracks should use defaults
      const defaults = defaultConfig();
      for (const id of TRACK_IDS) {
        if (id !== 'bd' && id !== 'sd') {
          expect(decoded.tracks[id]).toEqual(
            defaults.tracks[id]
          );
        }
      }
    }
  );

  it('missing tracks in mixer filled from default',
    async () => {
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
          expect(decoded.mixer[id]).toEqual(
            defaults.mixer[id]
          );
        }
      }
    }
  );
});

// -------------------------------------------------------
// C. Field-level validation (via encodeRaw + decodeConfig)
// -------------------------------------------------------
describe('validateKitId', () => {
  it('"808" passes through', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), kitId: '808',
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });

  it('"electro" passes through', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), kitId: 'electro',
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('electro');
  });

  it('unknown string falls back to "808"', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), kitId: 'unknown',
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });

  it('non-string falls back to "808"', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), kitId: 123,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });

  it('null falls back to "808"', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), kitId: null,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.kitId).toBe('808');
  });
});

describe('validateBpm', () => {
  it('110 passes through', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: 110,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });

  it('below minimum clamped to 20', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: 10,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(20);
  });

  it('above maximum clamped to 300', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: 500,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(300);
  });

  it('float rounded to integer', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: 120.7,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(121);
  });

  it('NaN defaults to 110', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: NaN,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });

  it('Infinity defaults to 110', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: Infinity,
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });

  it('non-number defaults to 110', async () => {
    const hash = await encodeRaw({
      ...defaultConfig(), bpm: 'fast',
    });
    const decoded = await decodeConfig(hash);
    expect(decoded.bpm).toBe(110);
  });
});

describe('validateTracks', () => {
  it('valid steps pass through', async () => {
    const config = defaultConfig();
    config.tracks.bd.steps = '1010101010101010';
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.steps).toBe(
      '1010101010101010'
    );
  });

  it('non-binary chars use fallback', async () => {
    const config = defaultConfig();
    config.tracks.bd = {
      steps: '10102010xxxxxxxx',
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.steps).toBe(
      defaultConfig().tracks.bd.steps
    );
  });

  it('null tracks uses entire fallback', async () => {
    const raw = { ...defaultConfig(), tracks: null };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks).toEqual(
      defaultConfig().tracks
    );
  });

  it('missing tracks get defaults', async () => {
    const config = defaultConfig();
    const partial = {
      bd: { steps: '1010101010101010' },
    };
    const raw = { ...config, tracks: partial };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.steps).toBe(
      '1010101010101010'
    );
    const defaults = defaultConfig();
    for (const id of TRACK_IDS) {
      if (id !== 'bd') {
        expect(decoded.tracks[id]).toEqual(
          defaults.tracks[id]
        );
      }
    }
  });

  it('locks at index 50 survive with 16-step track',
    async () => {
      const config = defaultConfig();
      config.tracks.bd.parameterLocks = {
        50: { gain: 0.7 },
      };
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(
        decoded.tracks.bd.parameterLocks?.[50]?.gain
      ).toBe(0.7);
    }
  );
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
// D. TrigCondition validation (now per-track)
// -------------------------------------------------------
describe('validateTrigConditions', () => {
  it('missing trigConditions stays undefined',
    async () => {
      const config = defaultConfig();
      // No trigConditions set on any track
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.tracks.bd.trigConditions)
        .toBeUndefined();
    }
  );

  it('valid probability condition round-trips',
    async () => {
      const config = defaultConfig();
      config.tracks.bd.trigConditions = {
        0: { probability: 50 },
      };
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.tracks.bd.trigConditions).toEqual({
        0: { probability: 50 },
      });
    }
  );

  it('valid cycle condition round-trips', async () => {
    const config = defaultConfig();
    config.tracks.sd.trigConditions = {
      2: { cycle: { a: 1, b: 4 } },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.sd.trigConditions).toEqual({
      2: { cycle: { a: 1, b: 4 } },
    });
  });

  it('invalid type is dropped', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { type: 'random', value: 50 } as never,
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.trigConditions)
      .toBeUndefined();
  });

  it('probability value clamped to 1-99', async () => {
    const config = defaultConfig();
    config.tracks.bd = {
      steps: config.tracks.bd.steps,
      trigConditions: {
        0: { type: 'probability', value: 0 } as never,
        1: { type: 'probability', value: 100 } as never,
        2: { probability: 50 },
      },
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(
      decoded.tracks.bd.trigConditions?.[0]
    ).toEqual({ probability: 1 });
    expect(
      decoded.tracks.bd.trigConditions?.[1]
    ).toEqual({ probability: 99 });
    expect(
      decoded.tracks.bd.trigConditions?.[2]
    ).toEqual({ probability: 50 });
  });

  it('cycle b clamped to max 8', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { type: 'cycle', a: 1, b: 16 } as never,
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(
      decoded.tracks.bd.trigConditions?.[0]
    ).toEqual({ cycle: { a: 1, b: 8 } });
  });

  it('cycle b=1 is dropped', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { type: 'cycle', a: 1, b: 1 } as never,
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.trigConditions)
      .toBeUndefined();
  });

  it('cycle a>b is clamped to a=b', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { type: 'cycle', a: 5, b: 3 } as never,
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(
      decoded.tracks.bd.trigConditions?.[0]
    ).toEqual({ cycle: { a: 3, b: 3 } });
  });

  it('step index >= 64 is dropped', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      64: { probability: 50 },
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.trigConditions)
      .toBeUndefined();
  });

  it('non-object trigConditions stays undefined',
    async () => {
      const config = defaultConfig();
      (config.tracks.bd as Record<string, unknown>)
        .trigConditions = 'bad';
      const hash = await encodeRaw(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.tracks.bd.trigConditions)
        .toBeUndefined();
    }
  );
});

describe('fill condition validation', () => {
  it('round-trips fill:fill', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { fill: 'fill' },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(
      decoded.tracks.bd.trigConditions?.[0]
    ).toEqual({ fill: 'fill' });
  });

  it('round-trips fill:!fill', async () => {
    const config = defaultConfig();
    config.tracks.sd.trigConditions = {
      4: { fill: '!fill' },
    };
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(
      decoded.tracks.sd.trigConditions?.[4]
    ).toEqual({ fill: '!fill' });
  });

  it('invalid fill values stripped', async () => {
    const config = defaultConfig();
    config.tracks.bd.trigConditions = {
      0: { fill: 'invalid' } as never,
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.trigConditions)
      .toBeUndefined();
  });

  it('old configs without fill decode normally',
    async () => {
      const config = defaultConfig();
      config.tracks.bd.trigConditions = {
        0: { probability: 50 },
      };
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(
        decoded.tracks.bd.trigConditions?.[0]
      ).toEqual({ probability: 50 });
    }
  );
});

describe('parameterLocks validation', () => {
  it('round-trips parameterLocks through encode/decode',
    async () => {
      const config = defaultConfig();
      config.tracks.bd.parameterLocks = {
        0: { gain: 0.5 }, 3: { gain: 0.8 },
      };
      config.tracks.sd.parameterLocks = {
        7: { gain: 0.2 },
      };
      const hash = await encodeConfig(config);
      const decoded = await decodeConfig(hash);
      expect(decoded.tracks.bd.parameterLocks).toEqual(
        config.tracks.bd.parameterLocks
      );
      expect(decoded.tracks.sd.parameterLocks).toEqual(
        config.tracks.sd.parameterLocks
      );
    }
  );

  it('defaults to undefined when missing', async () => {
    const config = defaultConfig();
    const hash = await encodeConfig(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.parameterLocks)
      .toBeUndefined();
  });

  it('clamps gain to [0, 1]', async () => {
    const config = defaultConfig();
    config.tracks.bd.parameterLocks = {
      0: { gain: 2.5 }, 1: { gain: -0.3 },
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(
      decoded.tracks.bd.parameterLocks?.[0]?.gain
    ).toBe(1);
    expect(
      decoded.tracks.bd.parameterLocks?.[1]?.gain
    ).toBe(0);
  });

  it('drops step indices >= 64', async () => {
    const config = defaultConfig();
    config.tracks.bd.parameterLocks = {
      0: { gain: 0.5 }, 99: { gain: 0.8 },
    };
    const hash = await encodeRaw(config);
    const decoded = await decodeConfig(hash);
    expect(decoded.tracks.bd.parameterLocks).toEqual({
      0: { gain: 0.5 },
    });
  });
});

// -------------------------------------------------------
// E. URL compaction
// -------------------------------------------------------
describe('URL compaction', () => {
  it('strips empty optional fields from encoded output',
    async () => {
      const config = defaultConfig();
      // Ensure no optional fields set
      const hash = await encodeConfig(config);
      // Decode raw JSON to inspect
      const bytes = Uint8Array.from(
        atob(
          hash.replace(/-/g, '+').replace(/_/g, '/')
            + '='.repeat(
              (4 - (hash.length % 4)) % 4
            )
        ),
        c => c.charCodeAt(0)
      );
      const stream = new Blob([bytes]).stream()
        .pipeThrough(
          new DecompressionStream('deflate-raw')
        );
      const json = await new Response(stream).text();
      const parsed = JSON.parse(json);
      // Each track should only have steps
      for (const id of TRACK_IDS) {
        const track = parsed.tracks[id];
        expect(track.freeRun).toBeUndefined();
        expect(track.trigConditions).toBeUndefined();
        expect(track.parameterLocks).toBeUndefined();
      }
    }
  );

  it('includes freeRun only when true', async () => {
    const config = defaultConfig();
    config.tracks.bd.freeRun = true;
    const hash = await encodeConfig(config);
    const bytes = Uint8Array.from(
      atob(
        hash.replace(/-/g, '+').replace(/_/g, '/')
          + '='.repeat(
            (4 - (hash.length % 4)) % 4
          )
      ),
      c => c.charCodeAt(0)
    );
    const stream = new Blob([bytes]).stream()
      .pipeThrough(
        new DecompressionStream('deflate-raw')
      );
    const json = await new Response(stream).text();
    const parsed = JSON.parse(json);
    expect(parsed.tracks.bd.freeRun).toBe(true);
    expect(parsed.tracks.sd.freeRun).toBeUndefined();
  });
});

describe('validateMixer', () => {
  it('negative gain clamped to 0', async () => {
    const config = defaultConfig();
    const raw = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: {
          gain: -0.5, isMuted: false, isSolo: false,
        },
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
        bd: {
          gain: 1.5, isMuted: false, isSolo: false,
        },
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
        bd: {
          gain: 0.8, isMuted: 'yes', isSolo: false,
        },
      },
    };
    const hash = await encodeRaw(raw);
    const decoded = await decodeConfig(hash);
    expect(decoded.mixer.bd.isMuted).toBe(false);
    expect(decoded.mixer.bd.gain).toBe(0.8);
  });
});
