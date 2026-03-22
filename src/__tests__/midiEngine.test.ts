import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest';
import { MidiEngine } from '../app/MidiEngine';

// Mock MIDIOutput
function createMockOutput(
  id: string, name: string
): MIDIOutput {
  return {
    id,
    name,
    manufacturer: '',
    version: '',
    state: 'connected',
    connection: 'open',
    type: 'output',
    send: vi.fn(),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onstatechange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MIDIOutput;
}

// Mock MIDIAccess
function createMockAccess(
  outputs: MIDIOutput[] = []
): MIDIAccess {
  const outputMap = new Map(
    outputs.map(o => [o.id, o])
  );
  return {
    inputs: new Map(),
    outputs: outputMap,
    sysexEnabled: false,
    onstatechange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MIDIAccess;
}

// Minimal localStorage mock for Node 25 compatibility
// (Node 25 has a built-in localStorage without .clear())
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('performance', {
    now: vi.fn(() => 0),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MidiEngine.init()', () => {
  it('returns true when MIDI access granted', async () => {
    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockResolvedValue(access),
    });

    const engine = new MidiEngine();
    const result = await engine.init();
    expect(result).toBe(true);
  });

  it('returns false when API unavailable', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: undefined,
    });

    const engine = new MidiEngine();
    const result = await engine.init();
    expect(result).toBe(false);
  });

  it('returns false when permission denied', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockRejectedValue(
        new DOMException('denied')
      ),
    });

    const engine = new MidiEngine();
    const result = await engine.init();
    expect(result).toBe(false);
  });

  it('is idempotent', async () => {
    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    const reqFn = vi.fn().mockResolvedValue(access);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: reqFn,
    });

    const engine = new MidiEngine();
    await engine.init();
    await engine.init();
    expect(reqFn).toHaveBeenCalledTimes(1);
  });

  it('loads config from localStorage', async () => {
    const saved = {
      enabled: true,
      deviceId: 'out1',
      channel: 5,
      noteLength: { type: 'fixed', ms: 100 },
      tracks: {
        bd: { noteNumber: 36 }, sd: { noteNumber: 38 },
        ch: { noteNumber: 42 }, oh: { noteNumber: 46 },
        cy: { noteNumber: 49 }, ht: { noteNumber: 50 },
        mt: { noteNumber: 47 }, lt: { noteNumber: 43 },
        rs: { noteNumber: 37 }, cp: { noteNumber: 39 },
        cb: { noteNumber: 56 },
      },
    };
    localStorage.setItem('xox-midi', JSON.stringify(saved));

    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockResolvedValue(access),
    });

    const engine = new MidiEngine();
    await engine.init();
    expect(engine.getConfig().channel).toBe(5);
    expect(engine.getConfig().noteLength).toEqual(
      { type: 'fixed', ms: 100 }
    );
  });
});

describe('MidiEngine.sendNote()', () => {
  async function setupEngine(
    opts: { enabled?: boolean; channel?: number } = {}
  ) {
    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockResolvedValue(access),
    });

    const engine = new MidiEngine();
    await engine.init();
    engine.setOutput('out1');
    engine.updateConfig({
      enabled: opts.enabled ?? true,
      channel: opts.channel ?? 10,
    });
    engine.setBpm(120);
    return { engine, output };
  }

  it('sends correct note-on and note-off bytes', async () => {
    const { engine, output } = await setupEngine(
      { channel: 10 }
    );
    engine.sendNote('bd', 1000, 0.8);

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(2);

    // Note-on: 0x90 | 9 = 0x99, note 36, velocity
    const noteOn = send.mock.calls[0];
    expect(noteOn[0][0]).toBe(0x99);    // channel 10
    expect(noteOn[0][1]).toBe(36);      // BD note
    expect(noteOn[0][2]).toBe(
      Math.max(1, Math.round(Math.min(0.8, 1.0) * 127))
    );
    expect(noteOn[1]).toBe(1000);       // timestamp

    // Note-off: 0x80 | 9 = 0x89
    const noteOff = send.mock.calls[1];
    expect(noteOff[0][0]).toBe(0x89);
    expect(noteOff[0][1]).toBe(36);
    expect(noteOff[0][2]).toBe(0);
    expect(noteOff[1]).toBe(1050);      // 1000 + 50ms
  });

  it('clamps velocity to 127 for gain > 1.0', async () => {
    const { engine, output } = await setupEngine();
    engine.sendNote('bd', 1000, 1.5);

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send.mock.calls[0][0][2]).toBe(127);
  });

  it('clamps velocity minimum to 1', async () => {
    const { engine, output } = await setupEngine();
    engine.sendNote('bd', 1000, 0.001);

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send.mock.calls[0][0][2]).toBe(1);
  });

  it('no-ops when disabled', async () => {
    const { engine, output } = await setupEngine(
      { enabled: false }
    );
    engine.sendNote('bd', 1000, 0.8);

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send).not.toHaveBeenCalled();
  });

  it('no-ops for accent track', async () => {
    const { engine, output } = await setupEngine();
    engine.sendNote('ac', 1000, 0.8);

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send).not.toHaveBeenCalled();
  });

  it('uses percent-based note length with BPM', async () => {
    const { engine, output } = await setupEngine();
    engine.updateConfig({
      noteLength: { type: 'percent', value: 50 },
    });
    engine.setBpm(120);
    engine.sendNote('bd', 1000, 0.8);

    // Step duration at 120 BPM = (60/120)*0.25*1000 = 125ms
    // 50% of step = 62.5ms
    const send = output.send as ReturnType<typeof vi.fn>;
    const noteOffTime = send.mock.calls[1][1];
    expect(noteOffTime).toBeCloseTo(1062.5);
  });

  it('no-ops when no output device', async () => {
    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockResolvedValue(access),
    });

    const engine = new MidiEngine();
    await engine.init();
    // Don't call setOutput — no device selected
    engine.updateConfig({ enabled: true, channel: 10 });
    engine.sendNote('bd', 1000, 0.8);

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send).not.toHaveBeenCalled();
  });
});

describe('MidiEngine.stop()', () => {
  it('sends All Notes Off CC 123', async () => {
    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockResolvedValue(access),
    });

    const engine = new MidiEngine();
    await engine.init();
    engine.setOutput('out1');
    engine.updateConfig({ enabled: true, channel: 10 });

    (output.send as ReturnType<typeof vi.fn>).mockClear();
    engine.stop();

    const send = output.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledWith([0xB9, 123, 0]);
  });
});

describe('MidiEngine config changes', () => {
  it('sends All Notes Off on old channel when changing',
    async () => {
      const output = createMockOutput('out1', 'Synth');
      const access = createMockAccess([output]);
      vi.stubGlobal('navigator', {
        ...navigator,
        requestMIDIAccess:
          vi.fn().mockResolvedValue(access),
      });

      const engine = new MidiEngine();
      await engine.init();
      engine.setOutput('out1');
      engine.updateConfig(
        { enabled: true, channel: 5 }
      );

      (output.send as ReturnType<typeof vi.fn>)
        .mockClear();
      engine.updateConfig({ channel: 10 });

      const send =
        output.send as ReturnType<typeof vi.fn>;
      // All Notes Off on channel 5 (0xB4 = 0xB0 | 4)
      expect(send).toHaveBeenCalledWith([0xB4, 123, 0]);
    }
  );

  it('persists config to localStorage', async () => {
    const output = createMockOutput('out1', 'Synth');
    const access = createMockAccess([output]);
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: vi.fn().mockResolvedValue(access),
    });

    const engine = new MidiEngine();
    await engine.init();
    engine.updateConfig({ channel: 7 });

    const stored = JSON.parse(
      localStorage.getItem('xox-midi')!
    );
    expect(stored.channel).toBe(7);
  });
});
