import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest';

// Mutable currentTime that the mock AudioContext reads.
let mockCurrentTime = 0;

// Mock AudioContext as a class so `new AudioCtx()` works.
class MockAudioContext {
  state = 'running';
  destination = {};
  sampleRate = 44100;
  resume = vi.fn().mockResolvedValue(undefined);

  get currentTime() {
    return mockCurrentTime;
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
    };
  }

  createBuffer() {
    return {};
  }

  createBufferSource() {
    return {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(),
    };
  }

  decodeAudioData = vi.fn();
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.useFakeTimers();

// Mock HTMLAudioElement for bypassSilentMode().
// Track created elements so tests can inspect them.
const mockAudioElements: Record<string, unknown>[] = [];
const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation(
  (tag: string) => {
    if (tag === 'audio') {
      const el = {
        setAttribute: vi.fn(),
        load: vi.fn(),
        play: vi.fn().mockResolvedValue(undefined),
        preload: '',
        loop: false,
        src: '',
      };
      mockAudioElements.push(el);
      return el as unknown as HTMLAudioElement;
    }
    return origCreateElement(tag);
  }
);

// Import the singleton after mocks are in place.
const { audioEngine } = await import('../app/AudioEngine');

describe('AudioEngine timing', () => {
  let stepLog: { step: number; time: number }[];

  beforeEach(() => {
    stepLog = [];
    mockCurrentTime = 0;
  });

  afterEach(() => {
    audioEngine.stop();
  });

  it('120 BPM: 16th note interval is 0.125s', async () => {
    const onStep = vi.fn(
      (step: number, time: number) => {
        stepLog.push({ step, time });
      }
    );

    await audioEngine.start(120, onStep);

    // At 120 BPM: 16th note = 60/120 * 0.25 = 0.125s
    // Step 0 at time 0, nextStepTime becomes 0.125
    // which is >= 0+0.1, so only step 0 scheduled.
    expect(onStep).toHaveBeenCalled();
    expect(stepLog[0].step).toBe(0);
    expect(stepLog[0].time).toBe(0);

    // Advance mock time so scheduler picks up next step
    mockCurrentTime = 0.026;
    vi.advanceTimersByTime(25);

    const step1 = stepLog.find(s => s.step === 1);
    expect(step1).toBeDefined();
    expect(step1!.time).toBeCloseTo(0.125, 6);
  });

  it('60 BPM: 16th note interval is 0.25s', async () => {
    const onStep = vi.fn(
      (step: number, time: number) => {
        stepLog.push({ step, time });
      }
    );

    await audioEngine.start(60, onStep);

    // At 60 BPM: 16th = 60/60 * 0.25 = 0.25s
    expect(stepLog[0].step).toBe(0);

    // nextStepTime=0.25, need currentTime+0.1 > 0.25
    mockCurrentTime = 0.151;
    vi.advanceTimersByTime(25);

    const step1 = stepLog.find(s => s.step === 1);
    expect(step1).toBeDefined();
    expect(step1!.time).toBeCloseTo(0.25, 6);
  });

  it('step wraps from 15 to 0', async () => {
    const onStep = vi.fn(
      (step: number, time: number) => {
        stepLog.push({ step, time });
      }
    );

    // High BPM so steps advance quickly
    await audioEngine.start(960, onStep);

    // At 960 BPM: 16th = 60/960 * 0.25 = 0.015625s
    for (let i = 0; i < 20; i++) {
      mockCurrentTime += 0.05;
      vi.advanceTimersByTime(25);
    }

    const steps = stepLog.map(s => s.step);
    const idx15 = steps.indexOf(15);
    expect(idx15).toBeGreaterThanOrEqual(0);
    expect(steps[idx15 + 1]).toBe(0);
  });

  it('setBpm during playback changes interval', async () => {
    const onStep = vi.fn(
      (step: number, time: number) => {
        stepLog.push({ step, time });
      }
    );

    await audioEngine.start(120, onStep);
    // Step 0 at t=0, next at 0.125

    mockCurrentTime = 0.026;
    vi.advanceTimersByTime(25);
    // Step 1 scheduled at 0.125

    // Change BPM to 240 (16th = 60/240 * 0.25 = 0.0625s)
    audioEngine.setBpm(240);

    // nextStepTime is still 0.25 (from step 1 at old BPM).
    // Need currentTime+0.1 > 0.25 to trigger step 2.
    mockCurrentTime = 0.151;
    vi.advanceTimersByTime(25);

    // Step 2 fires at 0.25 (old interval carried over).
    // But step 3 uses new BPM: 0.25 + 0.0625 = 0.3125.
    const step2 = stepLog.find(s => s.step === 2);
    expect(step2).toBeDefined();
    expect(step2!.time).toBeCloseTo(0.25, 4);

    // Verify new BPM takes effect on subsequent step
    mockCurrentTime = 0.25;
    vi.advanceTimersByTime(25);

    const step3 = stepLog.find(s => s.step === 3);
    expect(step3).toBeDefined();
    expect(step3!.time).toBeCloseTo(0.3125, 4);
  });
});

describe('iOS silent mode bypass', () => {
  beforeEach(() => {
    // Reset the private silentAudio so each test gets a
    // fresh bypass attempt.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (audioEngine as any).silentAudio = null;
  });

  afterEach(() => {
    audioEngine.stop();
  });

  it('start() creates a looping silent <audio> element', async () => {
    const before = mockAudioElements.length;
    await audioEngine.start(120, vi.fn());

    const created = mockAudioElements.slice(before);
    expect(created).toHaveLength(1);

    const el = created[0];
    expect(el.loop).toBe(true);
    expect(el.src).toContain('data:audio/wav;base64,');
    expect(el.play).toHaveBeenCalled();
    expect(el.load).toHaveBeenCalled();
  });

  it('only creates one <audio> element across multiple starts', async () => {
    const before = mockAudioElements.length;
    await audioEngine.start(120, vi.fn());
    audioEngine.stop();
    await audioEngine.start(120, vi.fn());

    const created = mockAudioElements.slice(before);
    expect(created).toHaveLength(1);
  });

  it('disables AirPlay widget on the silent element', async () => {
    const before = mockAudioElements.length;
    await audioEngine.start(120, vi.fn());

    const el = mockAudioElements[before];
    expect(el.setAttribute).toHaveBeenCalledWith(
      'x-webkit-airplay', 'deny'
    );
  });
});

describe('AudioEngine requestReset', () => {
  let stepLog: { step: number; time: number }[];

  beforeEach(() => {
    stepLog = [];
    mockCurrentTime = 0;
  });

  afterEach(() => {
    audioEngine.stop();
  });

  it('requestReset causes next step to be 0', async () => {
    const onStep = vi.fn(
      (step: number, time: number) => {
        stepLog.push({ step, time });
        // Request reset when we hit step 3
        if (step === 3) {
          audioEngine.requestReset();
        }
      }
    );

    // High BPM so steps advance quickly
    await audioEngine.start(960, onStep);

    for (let i = 0; i < 10; i++) {
      mockCurrentTime += 0.05;
      vi.advanceTimersByTime(25);
    }

    const steps = stepLog.map(s => s.step);
    const idx3 = steps.indexOf(3);
    expect(idx3).toBeGreaterThanOrEqual(0);
    // After step 3, next step should be 0 (not 4)
    expect(steps[idx3 + 1]).toBe(0);
  });

  it('requestReset preserves step timing', async () => {
    const onStep = vi.fn(
      (step: number, time: number) => {
        stepLog.push({ step, time });
        if (step === 2) {
          audioEngine.requestReset();
        }
      }
    );

    // 120 BPM: 16th = 0.125s
    await audioEngine.start(120, onStep);

    for (let i = 0; i < 20; i++) {
      mockCurrentTime += 0.05;
      vi.advanceTimersByTime(25);
    }

    const step2 = stepLog.find(s => s.step === 2);
    // The step after reset (step 0 again) should be
    // exactly one 16th note after step 2
    const resetStep = stepLog[stepLog.indexOf(step2!) + 1];
    expect(resetStep.step).toBe(0);
    expect(resetStep.time).toBeCloseTo(
      step2!.time + 0.125, 6
    );
  });

  it('pendingReset is one-shot (only affects next step)',
    async () => {
      const onStep = vi.fn(
        (step: number, time: number) => {
          stepLog.push({ step, time });
          // Reset only on the first step 2
          if (step === 2
              && stepLog.filter(
                s => s.step === 2
              ).length === 1) {
            audioEngine.requestReset();
          }
        }
      );

      await audioEngine.start(960, onStep);

      for (let i = 0; i < 20; i++) {
        mockCurrentTime += 0.05;
        vi.advanceTimersByTime(25);
      }

      const steps = stepLog.map(s => s.step);
      // After first reset: 0,1,2,0,1,2,3,...
      const firstIdx2 = steps.indexOf(2);
      expect(steps[firstIdx2 + 1]).toBe(0);
      // Second time through step 2, it should continue
      // to 3 normally
      const secondIdx2 = steps.indexOf(2, firstIdx2 + 1);
      expect(secondIdx2).toBeGreaterThan(firstIdx2);
      expect(steps[secondIdx2 + 1]).toBe(3);
    }
  );
});

describe('AudioEngine playSound', () => {
  afterEach(() => {
    audioEngine.stop();
  });

  it('missing buffer is a no-op (no crash)', () => {
    expect(() => {
      audioEngine.playSound('rs', 0.0, 1.0);
    }).not.toThrow();
  });
});

describe('getCurrentTime()', () => {
  it('returns AudioContext.currentTime', async () => {
    mockCurrentTime = 1.234;
    await audioEngine.preloadKit('808');
    expect(audioEngine.getCurrentTime()).toBe(1.234);
  });
});
