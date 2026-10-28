/**
 * Minimal zip writer for kit export: stored (uncompressed)
 * entries only, so it needs no dependency. Audio barely
 * compresses anyway.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE), as zip stores it. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// 1980-01-01 00:00, the earliest DOS date, so the same
// entries always give the same bytes.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
// Bit 11: names are UTF-8.
const FLAGS = 0x0800;

/** Builds a zip of `entries`, in order, all stored. */
export function zipStore(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const names = entries.map(e => enc.encode(e.name));
  const crcs = entries.map(e => crc32(e.data));

  let localSize = 0;
  let centralSize = 0;
  entries.forEach((e, i) => {
    localSize += 30 + names[i].length + e.data.length;
    centralSize += 46 + names[i].length;
  });
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];

  let p = 0;
  entries.forEach((e, i) => {
    offsets.push(p);
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true); // version needed
    view.setUint16(p + 6, FLAGS, true);
    view.setUint16(p + 8, 0, true); // stored
    view.setUint16(p + 10, DOS_TIME, true);
    view.setUint16(p + 12, DOS_DATE, true);
    view.setUint32(p + 14, crcs[i], true);
    view.setUint32(p + 18, e.data.length, true);
    view.setUint32(p + 22, e.data.length, true);
    view.setUint16(p + 26, names[i].length, true);
    view.setUint16(p + 28, 0, true);
    out.set(names[i], p + 30);
    out.set(e.data, p + 30 + names[i].length);
    p += 30 + names[i].length + e.data.length;
  });

  const centralStart = p;
  entries.forEach((e, i) => {
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true); // version made by
    view.setUint16(p + 6, 20, true); // version needed
    view.setUint16(p + 8, FLAGS, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, DOS_TIME, true);
    view.setUint16(p + 14, DOS_DATE, true);
    view.setUint32(p + 16, crcs[i], true);
    view.setUint32(p + 20, e.data.length, true);
    view.setUint32(p + 24, e.data.length, true);
    view.setUint16(p + 28, names[i].length, true);
    // extra, comment, disk, internal/external attrs: 0
    view.setUint32(p + 42, offsets[i], true);
    out.set(names[i], p + 46);
    p += 46 + names[i].length;
  });

  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 8, entries.length, true);
  view.setUint16(p + 10, entries.length, true);
  view.setUint32(p + 12, p - centralStart, true);
  view.setUint32(p + 16, centralStart, true);
  return out;
}
