"use client";

/**
 * MOCK ONLY: preset (kit + pattern) chooser variants
 * behind ?mock=A|B|C. Fake data: every pattern becomes
 * a preset with a kit picked from its category, and a
 * few get sample substitutions and FX. Not for main.
 */

import { useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import patternsData from './data/patterns.json';
import kitsData from './data/kits.json';
import type { Kit, Pattern, TrackId } from './types';
import { TRACKS } from './types';
import { useSequencer } from './SequencerContext';
import { basePatternId } from './patternUtils';
import { LcdCaret } from './LcdSelect';
import LcdSelect from './LcdSelect';
import Knob from './Knob';

export interface MockSub { track: TrackId; kit: string }
export interface MockPreset {
  id: string;
  name: string;
  category: string;
  bank: string;
  slot: number;
  kit: string;
  pattern: Pattern;
  subs: MockSub[];
  fx: { delay: number; reverb: number; drive: number };
}

const KIT_BY_CATEGORY: Record<string, string> = {
  House: '808', Techno: '808', Trap: '808', Phonk: '808',
  Drill: '808', 'Boom Bap': '808', Electro: 'electro',
  'New Wave': 'electro', Trance: 'electro', Garage: 'electro',
  Dubstep: 'electro', 'Drum & Bass': 'electro',
  Breakbeat: 'electro', IDM: 'experimental',
  Ambient: 'experimental', 'Lo-Fi': 'experimental',
};

const KITS = kitsData.kits as Kit[];
const kitName = (id: string) =>
  KITS.find(k => k.id === id)?.name ?? id;

const PATTERNS = patternsData.patterns as Pattern[];
// House first, so bank A starts with the default pattern.
const catKey = (p: Pattern) =>
  p.category === 'House' ? '' : (p.category ?? '');
const ORDER = [...PATTERNS].sort((a, b) =>
  catKey(a).localeCompare(catKey(b)));

export const PRESETS: MockPreset[] = ORDER.slice(0, 128).map(
  (p, i) => {
    const kit = KIT_BY_CATEGORY[p.category ?? ''] ?? 'acoustic';
    const subs: MockSub[] = [];
    if (p.id === 'house-1' || i % 3 === 0) {
      subs.push({ track: 'sd', kit: kit === 'electro' ? '808' : 'electro' });
    }
    if (p.id === 'house-1' || i % 4 === 1) {
      subs.push({ track: 'cp', kit: kit === 'acoustic' ? '808' : 'acoustic' });
    }
    const fx = p.id === 'house-1'
      ? { delay: 0.2, reverb: 0.35, drive: 0 }
      : { delay: (i * 7 % 5) / 10, reverb: (i * 3 % 6) / 10, drive: (i % 4 === 2) ? 0.3 : 0 };
    return {
      id: p.id,
      name: p.name,
      category: p.category ?? 'Other',
      bank: 'ABCDEFGH'[Math.floor(i / 16)],
      slot: (i % 16) + 1,
      kit,
      pattern: p,
      subs,
      fx,
    };
  },
);

const CATEGORIES = [...new Set(PRESETS.map(p => p.category))];
const hasFx = (p: MockPreset) =>
  p.fx.delay + p.fx.reverb + p.fx.drive > 0;
const slotCode = (p: MockPreset) =>
  `${p.bank}${String(p.slot).padStart(2, '0')}`;

/** B and C: the chosen preset, apart from the pattern. */
let presetId = 'house-1';
const listeners = new Set<() => void>();
const presetStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  get: () => presetId,
  set: (id: string) => { presetId = id; listeners.forEach(l => l()); },
};

/** B and C: a preset's name puts its kit first. */
export const presetTitle = (p: MockPreset) =>
  `${kitName(p.kit)} ${p.name}`;

/**
 * Picks a preset: loads its kit and its pattern.
 * A: the preset IS the pattern (it links a kit), as on
 * the Analog Rhythm. B, C: the preset is its own thing;
 * picking a pattern alone marks it modified.
 */
function usePresetMock(variant = 'A') {
  const { state, actions } = useSequencer();
  const storedId = useSyncExternalStore(
    presetStore.subscribe, presetStore.get, presetStore.get,
  );
  const patternId = basePatternId(state.selectedPatternId);
  const linked = variant === 'A';
  const current = PRESETS.find(p =>
    p.id === (linked ? patternId : storedId));
  const load = (p: MockPreset) => {
    presetStore.set(p.id);
    const kit = KITS.find(k => k.id === p.kit);
    if (kit && kit.id !== state.currentKit.id) actions.setKit(kit);
    actions.setPattern(p.pattern);
  };
  const kitDiffers = !!current && current.kit !== state.currentKit.id;
  const modified = kitDiffers
    || (!linked && !!current && current.id !== patternId);
  return { current, load, modified, state };
}

// ── Header key ──────────────────────────────────────

export function PresetTrigger({
  variant, open, onToggle,
}: { variant: string; open: boolean; onToggle: () => void }) {
  const { current, modified: isModified } = usePresetMock(variant);
  const name = current
    ? (variant === 'A' ? current.name : presetTitle(current))
    : 'Custom';
  const modified = isModified ? '*' : '';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={variant === 'A' ? 'Pattern' : 'Preset'}
      data-open={open || undefined}
      className="ss-lcd-select h-9 w-full"
    >
      <span className="flex min-w-0 items-center gap-2">
        {variant === 'B' && current && (
          <span className="shrink-0 rounded-[2px] bg-lcd px-1 text-[#1a0f03] font-semibold">
            {slotCode(current)}
          </span>
        )}
        <span className="truncate">{name}{modified}</span>
      </span>
      <LcdCaret open={open} />
    </button>
  );
}

// ── Shared bits ─────────────────────────────────────

function Toggle({ label, on, onClick }: {
  label: string; on: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="ss-key h-7 px-2.5 inline-flex items-center gap-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-ink"
    >
      <span className={'ss-led' + (on ? ' ss-led-on' : '')} />
      {label}
    </button>
  );
}

/** Kit, pattern, substitutions and FX of one preset. */
function PresetFacts({ p, compact }: { p: MockPreset; compact?: boolean }) {
  const cell = 'flex flex-col gap-1 min-w-0';
  const val = 'font-mono text-[12px] uppercase text-lcd truncate';
  return (
    <div className={compact
      ? 'grid grid-cols-2 gap-x-4 gap-y-2'
      : 'grid grid-cols-[auto_auto_1fr_auto] gap-x-7'}>
      <div className={cell}>
        <span className="ss-label">Kit</span>
        <span className={val}>{kitName(p.kit)}</span>
      </div>
      <div className={cell}>
        <span className="ss-label">Pattern</span>
        <span className={val}>{p.name}</span>
      </div>
      <div className={cell}>
        <span className="ss-label">Substitutions</span>
        <span className={val}>
          {p.subs.length
            ? p.subs.map(s => `${s.track}: ${kitName(s.kit)}`).join(' · ')
            : '—'}
        </span>
      </div>
      <div className={cell}>
        <span className="ss-label">FX</span>
        <span className={val}>
          {hasFx(p)
            ? `DLY ${Math.round(p.fx.delay * 100)} REV ${Math.round(p.fx.reverb * 100)} DRV ${Math.round(p.fx.drive * 100)}`
            : '—'}
        </span>
      </div>
    </div>
  );
}

function Drawer({ open, children, tall }: {
  open: boolean; children: ReactNode; tall?: string;
}) {
  return (
    <div
      data-testid="preset-drawer"
      aria-hidden={!open}
      className={'overflow-hidden ' + (open
        ? `${tall} opacity-100 mt-3 lg:mt-4`
        : 'max-h-0 opacity-0')}
    >
      <div className="ss-panel rounded-xl flex flex-col">
        {children}
      </div>
    </div>
  );
}

// ── A: today's chooser, kit tag per row ─────────────

function DrawerA({ open }: { open: boolean }) {
  const { current, load, state } = usePresetMock('A');
  const [cat, setCat] = useState(current?.category ?? 'House');
  const [loadKit, setLoadKit] = useState(true);
  const [loadFx, setLoadFx] = useState(true);
  const list = PRESETS.filter(p => p.category === cat);
  return (
    <Drawer open={open} tall="max-h-[600px] lg:max-h-[300px]">
      <div className="p-3 pb-2.5 flex flex-wrap gap-1.5 max-lg:max-h-[124px] max-lg:overflow-hidden">
        {CATEGORIES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={'ss-key h-8 px-3 text-sm font-medium'
              + (c === cat
                ? ' bg-none bg-accent border-accent-hi text-[#1a0d05]'
                : c === current?.category
                  ? ' border-accent/60 text-accent-hi'
                  : ' border-edge text-ink')}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="border-t border-line" />
      <div className="p-3 bg-well shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px min-h-[96px] content-start">
        {list.map(p => {
          const active = p.id === current?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => load(p)}
              className={'text-left px-2 py-1.5 rounded-[3px] font-mono text-[12px] uppercase flex items-center gap-2'
                + (active
                  ? ' bg-lcd text-[#1a0f03] font-semibold shadow-[0_0_8px_rgb(245_160_58/0.35)]'
                  : ' text-lcd hover:bg-lcd/10')}
            >
              <span className="truncate">{p.name}</span>
              <span className={'ml-auto text-[10px] ' + (active ? 'text-[#1a0f03]/70' : 'text-lcd/50')}>
                {kitName(p.kit)}
                {p.subs.length > 0 && ` +${p.subs.length}`}
                {hasFx(p) && ' FX'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-line rounded-b-[11px]">
        <span className="ss-label mr-1">Load with pattern</span>
        <Toggle label="Kit" on={loadKit} onClick={() => setLoadKit(v => !v)} />
        <Toggle label="FX" on={loadFx} onClick={() => setLoadFx(v => !v)} />
        <span className="ml-auto font-mono text-[11px] uppercase text-faint max-sm:w-full">
          Playing kit: {state.currentKit.name}
        </span>
      </div>
    </Drawer>
  );
}

// ── B: Analog Rhythm style banks and 16 pads ────────

const GROUP_ON = ['bg-step1', 'bg-step2', 'bg-step3', 'bg-step4'];
const GROUP_OFF = ['bg-step1-off', 'bg-step2-off', 'bg-step3-off', 'bg-step4-off'];

function DrawerB({ open }: { open: boolean }) {
  const { current, load } = usePresetMock('B');
  const [bank, setBank] = useState(current?.bank ?? 'A');
  const [hover, setHover] = useState<MockPreset | null>(null);
  const pads = PRESETS.filter(p => p.bank === bank);
  const shown = hover ?? current;
  return (
    <Drawer open={open} tall="max-h-[640px] lg:max-h-[320px]">
      <div className="flex flex-wrap items-center gap-1.5 p-3 pb-2.5">
        <span className="ss-label mr-1 max-sm:w-full">Bank</span>
        {'ABCDEFGH'.split('').map(b => {
          const sel = b === bank;
          const has = b === current?.bank;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBank(b)}
              aria-pressed={sel}
              className={'ss-key h-8 w-9 max-sm:flex-1 font-display text-[15px] font-bold'
                + (sel
                  ? ' bg-none bg-accent border-accent-hi text-[#1a0d05]'
                  : has ? ' border-accent/60 text-accent-hi' : ' border-edge text-ink')}
            >
              {b}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[11px] uppercase text-faint max-sm:hidden">
          {pads[0]?.category} – {pads[pads.length - 1]?.category}
        </span>
      </div>
      <div className="grid grid-cols-4 lg:grid-cols-16 gap-1.5 px-3 pb-3">
        {pads.map((p, i) => {
          const g = Math.floor(i / 4);
          const active = p.id === current?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => load(p)}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${slotCode(p)} ${presetTitle(p)}`}
              className={'relative h-[60px] rounded-[5px] border border-black/40 flex flex-col items-start justify-between p-1.5 text-left'
                + ' shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] '
                + (active ? GROUP_ON[g] + ' text-[#1a0d05]' : GROUP_OFF[g] + ' text-ink/80')}
            >
              <span className="font-mono text-[10px] font-semibold">
                {String(p.slot).padStart(2, '0')}
              </span>
              <span className="w-full line-clamp-2 font-display text-[11px] uppercase leading-[1.05] tracking-[0.03em]">
                {presetTitle(p).replace(/\s0?(\d+)$/, ' $1')}
              </span>
            </button>
          );
        })}
      </div>
      {shown && (
        <div className="bg-well shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] rounded-b-[11px] px-3 py-2.5">
          <div className="hidden lg:block"><PresetFacts p={shown} /></div>
          <div className="lg:hidden"><PresetFacts p={shown} compact /></div>
        </div>
      )}
    </Drawer>
  );
}

// ── C: list + preset sheet (sounds and FX) ──────────

function DrawerC({ open }: { open: boolean }) {
  const { current, load, state } = usePresetMock('C');
  const [cat, setCat] = useState(current?.category ?? 'House');
  const list = PRESETS.filter(p => p.category === cat);
  const p = current ?? PRESETS[0];
  const [fx, setFx] = useState(p.fx);
  const kitOptions = KITS.map(k => ({ value: k.id, label: k.name }));
  return (
    <Drawer open={open} tall="max-h-[900px] lg:max-h-[300px]">
      <div className="grid lg:grid-cols-[230px_1fr] lg:h-[300px]">
        {/* Preset list */}
        <div className="flex flex-col gap-2 p-3 border-line border-b lg:border-b-0 lg:border-r min-h-0">
          <LcdSelect
            aria-label="Category"
            value={cat}
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
            onChange={setCat}
            className="h-8 w-full"
          />
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar bg-well rounded-md p-1.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] max-lg:max-h-[120px]">
            {list.map(x => {
              const active = x.id === current?.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => { load(x); setFx(x.fx); }}
                  className={'w-full text-left px-2 py-1 rounded-[3px] font-mono text-[12px] uppercase flex'
                    + (active ? ' bg-lcd text-[#1a0f03] font-semibold' : ' text-lcd hover:bg-lcd/10')}
                >
                  <span className="truncate">{presetTitle(x)}</span>
                  <span className={'ml-auto text-[10px] ' + (active ? 'text-[#1a0f03]/70' : 'text-lcd/50')}>
                    {x.subs.length > 0 && `+${x.subs.length}`}
                    {hasFx(x) && ' FX'}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="ss-key h-7 flex-1 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">Save as…</button>
            <button type="button" className="ss-key h-7 flex-1 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">Copy preset</button>
          </div>
        </div>
        {/* Preset sheet */}
        <div className="flex flex-col gap-3 p-3 min-w-0">
          <div className="flex items-center gap-3">
            <span className="ss-label">Kit</span>
            <LcdSelect
              aria-label="Preset kit"
              value={state.currentKit.id}
              options={kitOptions}
              onChange={() => {}}
              className="h-8 w-32"
            />
            <span className="font-mono text-[11px] uppercase text-faint max-sm:hidden">
              Pattern: {p.name}
            </span>
          </div>
          <div>
            <div className="ss-label mb-1.5">Sounds</div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1">
              {TRACKS.map(t => {
                const sub = p.subs.find(s => s.track === t.id);
                return (
                  <div
                    key={t.id}
                    className={'rounded-[4px] border px-1.5 py-1 flex flex-col items-start bg-well'
                      + (sub ? ' border-accent/70' : ' border-line')}
                  >
                    <span className="font-display text-[13px] font-bold text-ink leading-none">{t.name}</span>
                    <span className={'font-mono text-[9.5px] uppercase truncate w-full mt-1 '
                      + (sub ? 'text-accent-hi' : 'text-lcd/50')}>
                      {sub ? kitName(sub.kit) : kitName(state.currentKit.id)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="ss-label mb-1.5">FX</div>
              <div className="flex items-center gap-4">
                {(['delay', 'reverb', 'drive'] as const).map(k => (
                  <div key={k} className="flex flex-col items-center gap-1">
                    <Knob
                      value={fx[k]}
                      onChange={v => setFx(f => ({ ...f, [k]: v }))}
                      size={30}
                      ariaPrefix={k}
                      showHoverValue={false}
                    />
                    <span className="font-display text-[10.5px] uppercase tracking-[0.1em] text-muted">
                      {k} {Math.round(fx[k] * 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[12px] text-faint max-w-[260px] max-sm:hidden">
              Click a sound to swap in another kit&apos;s sample.
              Orange = substituted.
            </p>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

export function PresetDrawer({ variant, open }: {
  variant: string; open: boolean;
}) {
  if (variant === 'B') return <DrawerB open={open} />;
  if (variant === 'C') return <DrawerC open={open} />;
  return <DrawerA open={open} />;
}
