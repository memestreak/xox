import { describe, expect, it, vi } from 'vitest';
import {
  KIT_SLOTS, buildKitZip, defaultExportName, exportPlan,
  isValidKitId, slugify,
} from '../app/kitExport';
import type { Kit } from '../app/types';

const kit: Kit = { id: 'electro', name: 'Electro', folder: 'electro' };

function wav(name: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name, { type: 'audio/wav' });
}

/** Names and bytes of a stored zip, via its local headers. */
function entries(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out = new Map<string, Uint8Array>();
  let p = 0;
  while (view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const name = new TextDecoder().decode(
      zip.subarray(p + 30, p + 30 + nameLen)
    );
    const start = p + 30 + nameLen;
    out.set(name, zip.subarray(start, start + size));
    p = start + size;
  }
  return out;
}

describe('slugify', () => {
  it.each([
    ['Electro custom', 'electro-custom'],
    ['  Boom  Bap!! 2 ', 'boom-bap-2'],
    ['808', '808'],
    ['---', ''],
    ['Café Kit', 'caf-kit'],
  ])('%s -> %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});

describe('isValidKitId', () => {
  it.each(['electro-custom', '808', 'a1-b2'])('accepts %s', id => {
    expect(isValidKitId(id)).toBe(true);
  });
  it.each(['', 'Electro', 'a--b', '-a', 'a-', 'a b', 'a_b'])(
    'refuses %s', id => {
      expect(isValidKitId(id)).toBe(false);
    }
  );
});

describe('defaultExportName', () => {
  it('appends custom to the kit name', () => {
    expect(defaultExportName(kit)).toBe('Electro custom');
  });
});

describe('exportPlan', () => {
  it('covers the 11 kit slots without accent', () => {
    const plan = exportPlan({}, {});
    expect(plan.map(s => s.slot)).toEqual([...KIT_SLOTS]);
    expect(plan).toHaveLength(11);
    expect(plan.every(s => s.file === undefined)).toBe(true);
  });

  it('uses custom files that are on only', () => {
    const cp = wav('clap.wav', [1]);
    const sd = wav('snare.wav', [2]);
    const plan = exportPlan({ cp, sd }, { sd: true });
    expect(plan.find(s => s.slot === 'cp')?.file).toBe(cp);
    expect(plan.find(s => s.slot === 'sd')?.file).toBeUndefined();
  });
});

describe('buildKitZip', () => {
  it('writes kit.json and every slot', async () => {
    const cp = wav('cl_03-smack_1.wav', [9, 9]);
    const fetchSample = vi.fn(
      async (_k: Kit, slot: string) => new TextEncoder().encode(slot)
    );
    const zip = await buildKitZip({
      kit,
      id: 'electro-custom',
      name: 'Electro custom',
      plan: exportPlan({ cp }, {}),
      fetchSample,
    });
    const files = entries(zip);
    expect([...files.keys()]).toEqual([
      'kit.json', ...KIT_SLOTS.map(s => `${s}.wav`),
    ]);
    expect(JSON.parse(new TextDecoder().decode(files.get('kit.json'))))
      .toEqual({
        format: 1,
        id: 'electro-custom',
        name: 'Electro custom',
        base: 'electro',
        sources: { cp: 'cl_03-smack_1.wav' },
      });
    expect(Array.from(files.get('cp.wav')!)).toEqual([9, 9]);
    expect(new TextDecoder().decode(files.get('bd.wav'))).toBe('bd');
    expect(fetchSample).toHaveBeenCalledTimes(10);
    expect(fetchSample).not.toHaveBeenCalledWith(kit, 'cp');
  });

  it('exports a plain copy with no custom slots', async () => {
    const zip = await buildKitZip({
      kit,
      id: 'copy',
      name: 'Copy',
      plan: exportPlan({}, {}),
      fetchSample: async () => new Uint8Array([1]),
    });
    const meta = JSON.parse(
      new TextDecoder().decode(entries(zip).get('kit.json'))
    );
    expect(meta.sources).toEqual({});
  });

  it('names the slot that failed to fetch', async () => {
    await expect(buildKitZip({
      kit,
      id: 'x',
      name: 'X',
      plan: exportPlan({}, {}),
      fetchSample: async (_k, slot) => {
        if (slot === 'oh') throw new Error('HTTP 404');
        return new Uint8Array();
      },
    })).rejects.toThrow("Couldn't read the Electro oh sample (HTTP 404).");
  });
});
