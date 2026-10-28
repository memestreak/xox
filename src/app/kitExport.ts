import { TRACK_IDS } from './types';
import type { Kit, TrackId } from './types';
import type {
  CustomSamples, DisabledSamples,
} from './hooks/useCustomSamples';
import { zipStore } from './zipStore';

/** Same rule as the kit builder (`build_kit.SLUG_RE`). */
export const KIT_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Slots a kit has a sample for (all tracks but accent). */
export const KIT_SLOTS: readonly TrackId[] =
  TRACK_IDS.filter(id => id !== 'ac');

/** Lowercase words joined by single hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isValidKitId(id: string): boolean {
  return KIT_ID_RE.test(id);
}

export function defaultExportName(kit: Kit): string {
  return `${kit.name} custom`;
}

export interface SlotSource {
  slot: TrackId;
  /** The loaded file, when the slot exports it. */
  file?: File;
}

/**
 * What each slot exports: its loaded file when the custom
 * sample is on, otherwise the kit's sample.
 */
export function exportPlan(
  custom: CustomSamples, disabled: DisabledSamples
): SlotSource[] {
  return KIT_SLOTS.map(slot => {
    const file = custom[slot];
    return file && !disabled[slot] ? { slot, file } : { slot };
  });
}

export type FetchKitSample = (
  kit: Kit, slot: TrackId
) => Promise<Uint8Array>;

/** Fetches a kit's sample from `public/kits/`. */
export const fetchKitSample: FetchKitSample = async (kit, slot) => {
  const res = await fetch(`/kits/${kit.folder}/${slot}.wav`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
};

export interface BuildKitZipOptions {
  /** The kit the other slots come from (`base`). */
  kit: Kit;
  id: string;
  name: string;
  plan: SlotSource[];
  fetchSample?: FetchKitSample;
}

async function fileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Zip for `import_kit.py`: `kit.json` then `<slot>.wav`
 * for every slot. Rejects naming the slot that failed.
 */
export async function buildKitZip({
  kit, id, name, plan, fetchSample = fetchKitSample,
}: BuildKitZipOptions): Promise<Uint8Array> {
  const sources: Partial<Record<TrackId, string>> = {};
  const audio = await Promise.all(plan.map(async ({ slot, file }) => {
    try {
      if (file) {
        sources[slot] = file.name;
        return await fileBytes(file);
      }
      return await fetchSample(kit, slot);
    } catch (e) {
      const what = file ? file.name : `the ${kit.name} ${slot} sample`;
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(`Couldn't read ${what} (${why}).`);
    }
  }));

  const meta = {
    format: 1,
    id,
    name,
    base: kit.id,
    sources: Object.fromEntries(
      plan.filter(s => s.slot in sources)
        .map(s => [s.slot, sources[s.slot]])
    ),
  };
  return zipStore([
    {
      name: 'kit.json',
      data: new TextEncoder().encode(
        JSON.stringify(meta, null, 2) + '\n'
      ),
    },
    ...plan.map((s, i) => ({ name: `${s.slot}.wav`, data: audio[i] })),
  ]);
}
