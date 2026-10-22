import type { TrackId } from './types';

/** One scheduled step, waiting to be shown on screen. */
export interface StepEvent {
  step: number;
  totalSteps: number;
  /** Audio-clock time the step sounds at (seconds). */
  time: number;
  triggered: Set<TrackId>;
}

/** Steps that became due since the last frame. */
export interface DueSteps {
  /** The most recent due step (what the playhead shows). */
  latest: StepEvent;
  /** Every track triggered by any of the due steps. */
  triggered: Set<TrackId>;
}

/**
 * Upper bound on queued steps. requestAnimationFrame
 * pauses in background tabs while the scheduler keeps
 * running, so without a cap the queue would grow.
 */
export const MAX_STEP_QUEUE = 64;

/** Add a step to the queue, dropping the oldest if full. */
export function enqueueStep(
  queue: StepEvent[], event: StepEvent
): void {
  queue.push(event);
  if (queue.length > MAX_STEP_QUEUE) {
    queue.splice(0, queue.length - MAX_STEP_QUEUE);
  }
}

/**
 * Remove every step whose time has arrived and return
 * the latest one plus the union of triggered tracks, so
 * no step is skipped visually even when several become
 * due in one frame. Returns null if nothing is due.
 */
export function drainDueSteps(
  queue: StepEvent[], now: number
): DueSteps | null {
  let latest: StepEvent | null = null;
  const triggered = new Set<TrackId>();
  while (queue.length > 0 && queue[0].time <= now) {
    latest = queue.shift()!;
    for (const id of latest.triggered) triggered.add(id);
  }
  return latest ? { latest, triggered } : null;
}
