import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest';

// Mutable currentTime that the mock AudioContext reads.
let mockCurrentTime = 0;

// Mock AudioContext as a class so `new AudioCtx()` works.
class MockAudioContext {
  state = 'running';
  destination = {};
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
