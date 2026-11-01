import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Mocks are for picking on a branch: the pick ships, the
 * mocks don't (`docs/specs/2026-11-01-mock-switcher-design.md`).
 * This fails while any source file still declares one,
 * so a branch carrying mocks stays red in CI and can't
 * merge by accident.
 */
const SRC = join(__dirname, '..');
const ALLOWED = [
  join('app', 'mocks') + sep,
  '__tests__' + sep,
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return files(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

describe('mocks', () => {
  it('are all removed before merging: nothing calls useMock', () => {
    const left = files(SRC)
      .map(path => relative(SRC, path))
      .filter(path => !ALLOWED.some(dir => path.startsWith(dir)))
      .filter(path => /\buseMock\s*\(/.test(
        readFileSync(join(SRC, path), 'utf8'),
      ));
    expect(left).toEqual([]);
  });
});
