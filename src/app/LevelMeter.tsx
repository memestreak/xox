"use client";

import { memo, useEffect, useRef } from 'react';
import { audioEngine } from './AudioEngine';
import {
  METER_DECAY_DB_PER_S,
  METER_FLOOR_DB,
  METER_SEGMENTS,
} from './constants';

const SEGMENT_BASE = 'flex-1 h-[3px] rounded-[1px] ';

/**
 * Segment colors by position: amber for most of the
 * range, orange near the top, red for the last segment
 * (the 808 step colors).
 */
function zone(index: number): { on: string; off: string } {
  const frac = (index + 1) / METER_SEGMENTS;
  if (frac > 0.95) return { on: 'bg-step1', off: 'bg-step1-off' };
  if (frac > 0.75) return { on: 'bg-step2', off: 'bg-step2-off' };
  return { on: 'bg-lcd', off: 'bg-step3-off' };
}

const ZONES = Array.from({ length: METER_SEGMENTS }, (_, i) => zone(i));

/**
 * Number of lit segments for a level in dBFS: none at
 * or below the floor, all at 0 dBFS or above.
 */
export function litSegments(db: number): number {
  if (!(db > METER_FLOOR_DB)) return 0;
  const frac = (db - METER_FLOOR_DB) / -METER_FLOOR_DB;
  return Math.min(METER_SEGMENTS, Math.ceil(frac * METER_SEGMENTS));
}

function toDb(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
}

/**
 * Stereo LED level meter of the master output. Reads
 * the engine's peaks every animation frame and updates
 * the segments directly, so it never re-renders React.
 * Decorative: the fader beside it carries the value
 * for assistive tech.
 */
function LevelMeterInner() {
  const rootRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<HTMLSpanElement[][]>([[], []]);

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();
    const shownDb = [METER_FLOOR_DB, METER_FLOOR_DB];
    const shownLit = [0, 0];

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      // Skip the work while hidden (the other layout's
      // copy of the control is the visible one).
      if (!rootRef.current || rootRef.current.offsetParent === null) {
        return;
      }
      const peaks = audioEngine.getOutputPeaks();
      for (let ch = 0; ch < 2; ch++) {
        shownDb[ch] = Math.max(
          toDb(peaks[ch]),
          shownDb[ch] - METER_DECAY_DB_PER_S * dt
        );
        const lit = litSegments(shownDb[ch]);
        if (lit === shownLit[ch]) continue;
        shownLit[ch] = lit;
        segmentRefs.current[ch].forEach((el, i) => {
          el.className = SEGMENT_BASE
            + (i < lit ? ZONES[i].on : ZONES[i].off);
        });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-testid="level-meter"
      className="flex flex-col gap-px"
    >
      {[0, 1].map(ch => (
        <div key={ch} className="flex gap-px">
          {ZONES.map((z, i) => (
            <span
              key={i}
              ref={el => {
                if (el) segmentRefs.current[ch][i] = el;
              }}
              className={SEGMENT_BASE + z.off}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const LevelMeter = memo(LevelMeterInner);
export default LevelMeter;
