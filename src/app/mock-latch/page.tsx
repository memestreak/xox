"use client";

// MOCK ONLY: every variant x state on one sheet.
import LatchKey from '../LatchKey';
import type { BodyState } from '../mockLatch';

type Row = { name: string; body: BodyState; latched: boolean; disabled?: boolean };

const FILL: Row[] = [
  { name: 'Off', body: 'off', latched: false },
  { name: 'Held (momentary)', body: 'held', latched: false },
  { name: 'Latched', body: 'active', latched: true },
];
const TEMP: Row[] = [
  { name: 'Stopped', body: 'off', latched: false, disabled: true },
  { name: 'Stopped, latched', body: 'armed', latched: true, disabled: true },
  { name: 'Off', body: 'off', latched: false },
  { name: 'Armed once', body: 'armed', latched: false },
  { name: 'Temp playing', body: 'active', latched: false },
  { name: 'Latched, waiting', body: 'armed', latched: true },
  { name: 'Latched, playing', body: 'active', latched: true },
];

const VARIANTS = [
  { v: 'A' as const, title: 'A · Split key (your idea)' },
  { v: 'B' as const, title: 'B · Twin keys' },
  { v: 'C' as const, title: 'C · Corner LED, double-tap' },
];

export default function MockLatchPage() {
  return (
    <main className="p-4 lg:p-8 space-y-6 bg-ground min-h-screen">
      {VARIANTS.map(({ v, title }) => (
        <section key={v} id={'v' + v} className="ss-panel rounded-xl p-4 space-y-4 w-fit">
          <h2 className="ss-label text-ink">{title}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-4 items-end">
            {FILL.map(r => (
              <div key={r.name} className="flex flex-col items-start gap-2">
                <span className="ss-label text-[10px]">Fill · {r.name}</span>
                <LatchKey variant={v} label="FILL" size="header" body={r.body} latched={r.latched} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-4 items-end">
            {TEMP.map(r => (
              <div key={r.name} className="flex flex-col items-start gap-2">
                <span className="ss-label text-[10px]">Temp · {r.name}</span>
                <LatchKey variant={v} label="TEMP" size="strip" body={r.body} latched={r.latched} disabled={r.disabled && v === 'C' ? true : r.disabled} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
