import { describe, expect, it } from 'vitest';
import { crc32, zipStore } from '../app/zipStore';

const enc = new TextEncoder();
const dec = new TextDecoder();

interface ReadEntry {
  name: string;
  crc: number;
  data: Uint8Array;
}

/** Minimal store-only reader: end record → central dir → local. */
function readZip(zip: Uint8Array): ReadEntry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: ReadEntry[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    expect(view.getUint16(p + 10, true)).toBe(0); // stored
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    expect(view.getUint32(p + 24, true)).toBe(size);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));

    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint32(local + 14, true)).toBe(crc);
    const lNameLen = view.getUint16(local + 26, true);
    const lExtraLen = view.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    out.push({ name, crc, data: zip.subarray(start, start + size) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });

  it('is 0 for no bytes', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('zipStore', () => {
  it('round-trips names, bytes and CRCs in order', () => {
    const entries = [
      { name: 'kit.json', data: enc.encode('{"a":1}') },
      { name: 'bd.wav', data: new Uint8Array([0, 1, 2, 255]) },
      { name: 'empty.txt', data: new Uint8Array() },
    ];
    const read = readZip(zipStore(entries));
    expect(read.map(e => e.name))
      .toEqual(['kit.json', 'bd.wav', 'empty.txt']);
    read.forEach((e, i) => {
      expect(Array.from(e.data)).toEqual(Array.from(entries[i].data));
      expect(e.crc).toBe(crc32(entries[i].data));
    });
  });

  it('is deterministic', () => {
    const entries = [{ name: 'a', data: enc.encode('x') }];
    expect(zipStore(entries)).toEqual(zipStore(entries));
  });

  it('writes an empty archive', () => {
    expect(readZip(zipStore([]))).toEqual([]);
  });
});
