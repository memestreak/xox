import { describe, expect, it, vi } from 'vitest';
import {
  computeStep,
  type ComputeStepDeps,
} from '../app/computeStep';
import { TRACK_IDS } from '../app/types';
import type {
  SequencerConfig,
  TrackConfig,
  TrackId,
  TrackMixerState,
  TrackState,
} from '../app/types';

// ── Helpers ─────────────────────────────────────────

/** Build a minimal config with all tracks silent. */
function makeConfig(
  overrides: Partial<SequencerConfig> = {}
): SequencerConfig {
  const tracks = {} as Record<TrackId, TrackConfig>;
  const mixer = {} as Record<TrackId, TrackMixerState>;
  for (const id of TRACK_IDS) {
    tracks[id] = { steps: '0'.repeat(16) };
    mixer[id] = {
      gain: id === 'ac' ? 0.5 : 1.0,
      pan: 0.5,
      isMuted: false,
      isSolo: false,
    };
  }
  return {
    version: 4,
    kitId: '808',
    bpm: 110,
    tracks,
    mixer,
    swing: 0,
    ...overrides,
  };
}

/** Build trackStates from a config's mixer. */
function trackStatesFrom(
  config: SequencerConfig
): Record<TrackId, TrackState> {
  const result = {} as Record<TrackId, TrackState>;
  for (const id of TRACK_IDS) {
    const m = config.mixer[id];
    result[id] = {
      id,
      name: id.toUpperCase(),
      gain: m.gain,
      pan: m.pan,
      isMuted: m.isMuted,
      isSolo: m.isSolo,
    };
  }
  return result;
}

/** Build zeroed cycle counts. */
function zeroCycles(): Record<TrackId, number> {
  const c = {} as Record<TrackId, number>;
  for (const id of TRACK_IDS) c[id] = 0;
  return c;
}

/** Build default deps. */
function makeDeps(
  overrides: Partial<ComputeStepDeps> = {}
): ComputeStepDeps {
  const config = makeConfig();
  return {
    trackStates: trackStatesFrom(config),
    config,
    totalSteps: 0,
    cycleCounts: zeroCycles(),
    fillActive: false,
    pendingPattern: null,
    tempState: 'off',
    homeSnapshot: null,
    ...overrides,
  };
}

/** Activate a step for a track in a config. */
function setStep(
  config: SequencerConfig,
  trackId: TrackId,
  step: number,
  value: '0' | '1' = '1'
): SequencerConfig {
  const track = config.tracks[trackId];
  const steps =
    track.steps.substring(0, step) +
    value +
    track.steps.substring(step + 1);
  return {
    ...config,
    tracks: {
      ...config.tracks,
      [trackId]: { ...track, steps },
    },
  };
}

// ── Solo / Mute / Audibility ────────────────────────

describe('computeStep: solo/mute', () => {
  it('all active tracks play when no solo/mute', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'sd', 0);
    config = setStep(config, 'ch', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    const ids = result.sounds.map(s => s[0]);
    expect(ids).toContain('bd');
    expect(ids).toContain('sd');
    expect(ids).toContain('ch');
    expect(ids).toHaveLength(3);
  });

  it('only soloed tracks play', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'sd', 0);
    config = setStep(config, 'ch', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { ...config.mixer.bd, isSolo: true },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    const ids = result.sounds.map(s => s[0]);
    expect(ids).toEqual(['bd']);
  });

  it('multiple soloed tracks all play', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'sd', 0);
    config = setStep(config, 'ch', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { ...config.mixer.bd, isSolo: true },
        ch: { ...config.mixer.ch, isSolo: true },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    const ids = result.sounds.map(s => s[0]);
    expect(ids).toContain('bd');
    expect(ids).toContain('ch');
    expect(ids).not.toContain('sd');
  });

  it('muted track is silent when no solos', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'sd', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { ...config.mixer.bd, isMuted: true },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    const ids = result.sounds.map(s => s[0]);
    expect(ids).not.toContain('bd');
    expect(ids).toContain('sd');
  });

  it('muted AND soloed: solo wins (plays)', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'sd', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: {
          ...config.mixer.bd,
          isMuted: true,
          isSolo: true,
        },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    const ids = result.sounds.map(s => s[0]);
    expect(ids).toContain('bd');
  });

  it('inactive step produces no sound', () => {
    const config = makeConfig(); // all steps off
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds).toHaveLength(0);
  });
});

// ── Accent ──────────────────────────────────────────

describe('computeStep: accent', () => {
  it('accent multiplies gain', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'ac', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds).toHaveLength(1);
    // gain = 1.0^3 * (1 + 0.5*2) = 2.0
    expect(result.sounds[0][2]).toBeCloseTo(2.0);
  });

  it('no accent: gain is cubic only', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { ...config.mixer.bd, gain: 0.5 },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds).toHaveLength(1);
    // gain = 0.5^3 = 0.125
    expect(result.sounds[0][2]).toBeCloseTo(0.125);
  });
});

// ── Swing ───────────────────────────────────────────

describe('computeStep: swing timing', () => {
  it('odd step with swing: time is offset', () => {
    let config = makeConfig({ swing: 50 });
    config = setStep(config, 'bd', 1);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(1, 1.0, deps);
    expect(result.sounds).toHaveLength(1);
    const scheduledTime = result.sounds[0][1];
    // BPM 110: halfStep = (60/110)*0.25/2
    const halfStep = (60 / 110) * 0.25 / 2;
    expect(scheduledTime).toBeCloseTo(
      1.0 + 0.5 * 0.7 * halfStep, 4
    );
  });

  it('even step with swing: no offset', () => {
    let config = makeConfig({ swing: 80 });
    config = setStep(config, 'bd', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 1.0, deps);
    expect(result.sounds[0][1]).toBe(1.0);
  });

  it('max swing capped by 0.7 multiplier', () => {
    let config = makeConfig({ swing: 100 });
    config = setStep(config, 'bd', 1);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(1, 1.0, deps);
    const halfStep = (60 / 110) * 0.25 / 2;
    const maxOffset = 0.7 * halfStep;
    expect(result.sounds[0][1]).toBeCloseTo(
      1.0 + maxOffset, 4
    );
    expect(result.sounds[0][1] - 1.0)
      .toBeLessThan(halfStep);
  });

  it('swing offset scales with BPM', () => {
    let config = makeConfig({ bpm: 60, swing: 50 });
    config = setStep(config, 'bd', 1);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(1, 1.0, deps);
    const halfStep = (60 / 60) * 0.25 / 2;
    expect(result.sounds[0][1]).toBeCloseTo(
      1.0 + 0.5 * 0.7 * halfStep, 4
    );
  });

  it('zero swing: no offset on odd step', () => {
    let config = makeConfig({ swing: 0 });
    config = setStep(config, 'bd', 1);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(1, 1.0, deps);
    expect(result.sounds[0][1]).toBe(1.0);
  });
});

// ── Trig Conditions ─────────────────────────────────

describe('computeStep: trig conditions', () => {
  it('probability condition can suppress a step', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          trigConditions: {
            0: { probability: 50 },
          },
        },
      },
    };
    // random >= 0.50 → suppress
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('step without condition always fires', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds).toHaveLength(1);
    expect(result.sounds[0][0]).toBe('bd');
  });

  it('cycle condition gates on cycle count', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          trigConditions: {
            // 2:2 fires when cycleCount % 2 === 1
            0: { cycle: { a: 2, b: 2 } },
          },
        },
      },
    };

    // cycleCount = 0 → (0 % 2) + 1 = 1 ≠ 2 → skip
    const deps0 = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });
    expect(computeStep(0, 0.0, deps0).sounds)
      .toHaveLength(0);

    // cycleCount = 1 → (1 % 2) + 1 = 2 → fire
    const deps1 = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      cycleCounts: {
        ...zeroCycles(),
        bd: 1,
      },
    });
    expect(computeStep(0, 0.0, deps1).sounds)
      .toHaveLength(1);
  });

  it('fill condition: fires only when fill active', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          trigConditions: {
            0: { fill: 'fill' },
          },
        },
      },
    };

    const depsNoFill = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      fillActive: false,
    });
    expect(computeStep(0, 0.0, depsNoFill).sounds)
      .toHaveLength(0);

    const depsFill = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      fillActive: true,
    });
    expect(computeStep(0, 0.0, depsFill).sounds)
      .toHaveLength(1);
  });

  it('!fill condition: fires only when fill inactive',
    () => {
      let config = makeConfig();
      config = setStep(config, 'bd', 0);
      config = {
        ...config,
        tracks: {
          ...config.tracks,
          bd: {
            ...config.tracks.bd,
            trigConditions: {
              0: { fill: '!fill' },
            },
          },
        },
      };

      const depsFill = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        fillActive: true,
      });
      expect(computeStep(0, 0.0, depsFill).sounds)
        .toHaveLength(0);

      const depsNoFill = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        fillActive: false,
      });
      expect(computeStep(0, 0.0, depsNoFill).sounds)
        .toHaveLength(1);
    }
  );
});

// ── Parameter Locks ─────────────────────────────────

describe('computeStep: parameter locks', () => {
  it('gain lock overrides mixer gain', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          parameterLocks: { 0: { gain: 0.5 } },
        },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    // 0.5^3 = 0.125
    expect(result.sounds[0][2]).toBeCloseTo(0.125);
  });

  it('accent stacks on locked gain', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'ac', 0);
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          parameterLocks: { 0: { gain: 0.5 } },
        },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    // 0.5^3 * (1 + 0.5*2) = 0.25
    expect(result.sounds[0][2]).toBeCloseTo(0.25);
  });

  it('gain lock = 0 produces zero gain', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          parameterLocks: { 0: { gain: 0 } },
        },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds[0][2]).toBeCloseTo(0);
  });

  it('pan lock overrides mixer pan', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: { ...config.mixer.bd, pan: 0.8 },
      },
      tracks: {
        ...config.tracks,
        bd: {
          ...config.tracks.bd,
          parameterLocks: { 0: { pan: 0.2 } },
        },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.sounds[0][3]).toBeCloseTo(0.2);
  });

  it('no lock falls back to mixer values', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = {
      ...config,
      mixer: {
        ...config.mixer,
        bd: {
          ...config.mixer.bd,
          gain: 0.8,
          pan: 0.3,
        },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    // 0.8^3 = 0.512
    expect(result.sounds[0][2]).toBeCloseTo(0.512);
    expect(result.sounds[0][3]).toBeCloseTo(0.3);
  });
});

// ── Cycle Count Advancement ─────────────────────────

describe('computeStep: cycle counts', () => {
  it('increments at cycle boundary', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    // 16-step track: cycle boundary at totalSteps=16
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      totalSteps: 16, // will become 17 internally
      // old total = 16, 16 % 16 === 0 → increment
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.cycleCounts.bd).toBe(1);
  });

  it('does not increment mid-cycle', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      totalSteps: 5,
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.cycleCounts.bd).toBe(0);
  });

  it('does not increment on first step', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      totalSteps: 0,
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.cycleCounts.bd).toBe(0);
  });

  it('totalSteps is incremented', () => {
    const deps = makeDeps({ totalSteps: 42 });
    const result = computeStep(0, 0.0, deps);
    expect(result.totalSteps).toBe(43);
  });
});

// ── Pattern Boundary Signals ────────────────────────

describe('computeStep: pattern boundary signals', () => {
  it('sequential: returns applyPending at last step',
    () => {
      const config = makeConfig();
      const pendingTracks = {
        ...config.tracks,
      };
      pendingTracks.bd = {
        steps: '1111000011110000',
      };
      const pending = {
        id: 'pending',
        name: 'pending',
        tracks: pendingTracks,
      };

      const deps = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        pendingPattern: pending,
      });

      // Step 15 is last step of a 16-step pattern
      const result = computeStep(15, 1.0, deps);
      expect(result.applyPending).toBeDefined();
      expect(result.applyPending!.patternId)
        .toBe('pending');
      expect(
        result.applyPending!.config.tracks.bd.steps
      ).toBe('1111000011110000');
    }
  );

  it('no pending: no applyPending signal', () => {
    const deps = makeDeps();
    const result = computeStep(15, 1.0, deps);
    expect(result.applyPending).toBeUndefined();
  });

  it('mid-pattern: no applyPending even with pending',
    () => {
      const config = makeConfig();
      const pending = {
        id: 'p',
        name: 'p',
        tracks: config.tracks,
      };
      const deps = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        pendingPattern: pending,
      });

      const result = computeStep(7, 1.0, deps);
      expect(result.applyPending).toBeUndefined();
    }
  );

  it('temp revert at last step', () => {
    const config = makeConfig();
    const homeTracks = { ...config.tracks };
    homeTracks.bd = { steps: '1010101010101010' };

    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      tempState: 'active',
      homeSnapshot: {
        tracks: homeTracks,
        selectedPatternId: 'home',
      },
    });

    const result = computeStep(15, 1.0, deps);
    expect(result.revertTemp).toBeDefined();
    expect(result.revertTemp!.selectedPatternId)
      .toBe('home');
    expect(
      result.revertTemp!.config.tracks.bd.steps
    ).toBe('1010101010101010');
  });

  it('no revert when tempState is not active', () => {
    const config = makeConfig();
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
      tempState: 'armed',
      homeSnapshot: {
        tracks: config.tracks,
        selectedPatternId: 'x',
      },
    });

    const result = computeStep(15, 1.0, deps);
    expect(result.revertTemp).toBeUndefined();
  });

  it('no revert when pending also present (same step)',
    () => {
      const config = makeConfig();
      const pending = {
        id: 'p',
        name: 'p',
        tracks: config.tracks,
      };

      const deps = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        tempState: 'active',
        homeSnapshot: {
          tracks: config.tracks,
          selectedPatternId: 'home',
        },
        pendingPattern: pending,
      });

      const result = computeStep(15, 1.0, deps);
      // applyPending fires, but revertTemp should not
      expect(result.applyPending).toBeDefined();
      expect(result.revertTemp).toBeUndefined();
    }
  );

  it('revert signals needsReset when lengths differ',
    () => {
      const config = makeConfig();
      // Make current pattern 16 steps (default)
      const homeTracks = { ...config.tracks };
      // Home had 8-step tracks
      for (const id of TRACK_IDS) {
        homeTracks[id] = { steps: '0'.repeat(8) };
      }

      const deps = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        tempState: 'active',
        homeSnapshot: {
          tracks: homeTracks,
          selectedPatternId: 'home',
        },
      });

      const result = computeStep(15, 1.0, deps);
      expect(result.revertTemp!.needsReset).toBe(true);
      expect(result.revertTemp!.patternLength).toBe(8);
    }
  );
});

// ── triggeredTracks ─────────────────────────────────

describe('computeStep: triggeredTracks', () => {
  it('contains only fired track IDs', () => {
    let config = makeConfig();
    config = setStep(config, 'bd', 0);
    config = setStep(config, 'ch', 0);
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    const result = computeStep(0, 0.0, deps);
    expect(result.triggeredTracks.has('bd')).toBe(true);
    expect(result.triggeredTracks.has('ch')).toBe(true);
    expect(result.triggeredTracks.has('sd')).toBe(false);
  });

  it('is empty when nothing fires', () => {
    const deps = makeDeps();
    const result = computeStep(0, 0.0, deps);
    expect(result.triggeredTracks.size).toBe(0);
  });
});

// ── Free-run mode ───────────────────────────────────

describe('computeStep: free-run', () => {
  it('free-run track uses totalSteps for step index',
    () => {
      let config = makeConfig();
      // 4-step track with step 2 active, free-run
      config = {
        ...config,
        tracks: {
          ...config.tracks,
          bd: {
            steps: '0010',
            freeRun: true,
          },
        },
      };
      const deps = makeDeps({
        config,
        trackStates: trackStatesFrom(config),
        totalSteps: 2, // internal: (3-1)%4 = 2 → hit
      });

      const result = computeStep(0, 0.0, deps);
      expect(result.sounds).toHaveLength(1);
      expect(result.sounds[0][0]).toBe('bd');
    }
  );

  it('non-free-run track uses pattern step', () => {
    let config = makeConfig();
    // 4-step track with step 2 active, not free-run
    config = {
      ...config,
      tracks: {
        ...config.tracks,
        bd: { steps: '0010' },
      },
    };
    const deps = makeDeps({
      config,
      trackStates: trackStatesFrom(config),
    });

    // step=2 should fire
    const result = computeStep(2, 0.0, deps);
    expect(result.sounds).toHaveLength(1);

    // step=0 should not
    const result0 = computeStep(0, 0.0, deps);
    expect(result0.sounds).toHaveLength(0);
  });
});
