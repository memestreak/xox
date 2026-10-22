import { describe, expect, it } from 'vitest';
import {
  drainDueSteps, enqueueStep, MAX_STEP_QUEUE,
} from '../app/stepQueue';
import type { StepEvent } from '../app/stepQueue';
import type { TrackId } from '../app/types';

function ev(
  step: number, time: number, triggered: TrackId[] = []
): StepEvent {
  return {
    step, totalSteps: step + 1, time,
    triggered: new Set(triggered),
  };
}

describe('stepQueue (#122)', () => {
  it('returns null when nothing is due yet', () => {
    const q = [ev(0, 0.1)];
    expect(drainDueSteps(q, 0.05)).toBeNull();
    expect(q).toHaveLength(1);
  });

  it('does not show a step before its time', () => {
    const q: StepEvent[] = [];
    enqueueStep(q, ev(0, 0.0));
    enqueueStep(q, ev(1, 0.125));
    expect(drainDueSteps(q, 0.01)?.latest.step).toBe(0);
    expect(drainDueSteps(q, 0.1)).toBeNull();
    expect(drainDueSteps(q, 0.125)?.latest.step).toBe(1);
  });

  it('merges triggers from steps due in the same frame',
    () => {
      const q = [
        ev(0, 0.00, ['bd']),
        ev(1, 0.05, ['ch']),
        ev(2, 0.30, ['sd']),
      ];
      const due = drainDueSteps(q, 0.06)!;
      expect(due.latest.step).toBe(1);
      expect([...due.triggered].sort()).toEqual(['bd', 'ch']);
      expect(q.map(e => e.step)).toEqual([2]);
    }
  );

  it('caps the queue size, dropping the oldest', () => {
    const q: StepEvent[] = [];
    for (let i = 0; i < MAX_STEP_QUEUE + 10; i++) {
      enqueueStep(q, ev(i, i));
    }
    expect(q).toHaveLength(MAX_STEP_QUEUE);
    expect(q[0].step).toBe(10);
  });
});
