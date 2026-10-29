import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers/files';

const DEPCRUISE = join(ROOT, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const CONFIG = join(ROOT, '.dependency-cruiser.cjs');
const TSCONFIG = JSON.stringify({
  compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' },
});

/** Builds a throwaway `src/` tree and returns the depcruise exit status (0 = clean). */
function cruise(files: Record<string, string>): number {
  const dir = mkdtempSync(join(tmpdir(), 'app-layers-'));
  writeFileSync(join(dir, 'tsconfig.json'), TSCONFIG);
  for (const [path, code] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), code);
  }
  try {
    execFileSync('node', [DEPCRUISE, 'src', '--config', CONFIG], { cwd: dir, stdio: 'pipe' });
    return 0;
  } catch (error) {
    return (error as { status?: number }).status ?? -1;
  }
}

describe('dependency-cruiser layer rules', () => {
  it('accepts imports that point inward', () => {
    expect(
      cruise({
        'src/domain/a.ts': 'export const a = 1;',
        'src/data/b.ts': "import { a } from '../domain/a'; export const b = a;",
      }),
    ).toBe(0);
  });

  it('rejects a layer importing a forbidden layer', () => {
    expect(
      cruise({
        'src/data/b.ts': 'export const b = 1;',
        'src/domain/a.ts': "import { b } from '../data/b'; export const a = b;",
      }),
    ).not.toBe(0);
  });

  it('rejects circular imports', () => {
    expect(
      cruise({
        'src/app/a.ts': "import { b } from './b'; export const a = b;",
        'src/app/b.ts': "import { a } from './a'; export const b = a;",
      }),
    ).not.toBe(0);
  });

  it('the real source tree is clean', () => {
    expect(() =>
      execFileSync('node', [DEPCRUISE, 'src', '--config', CONFIG], { cwd: ROOT, stdio: 'pipe' }),
    ).not.toThrow();
  });
});

describe('feature slices', () => {
  const ok = 'export const x = 1;';

  it('lets a feature use its own slice and the shared directories', () => {
    expect(
      cruise({
        'src/domain/shared/money.ts': ok,
        'src/domain/items/item.ts': ok,
        'src/domain/items/rules.ts':
          "import { x } from './item'; import { x as y } from '../shared/money'; export const z = x + y;",
        'src/data/mock/fixtures.ts': ok,
        'src/data/items/repo.ts':
          "import { x } from '../../domain/items/item'; import { x as m } from '../mock/fixtures'; export const r = x + m;",
        'src/presentation/components/Button.ts': ok,
        'src/presentation/items/Page.ts':
          "import { x } from '../components/Button'; export const p = x;",
      }),
    ).toBe(0);
  });

  it.each([
    [
      'domain',
      'src/domain/items/a.ts',
      "import { x } from '../bookings/b'; export const a = x;",
      'src/domain/bookings/b.ts',
    ],
    [
      'data',
      'src/data/items/a.ts',
      "import { x } from '../bookings/b'; export const a = x;",
      'src/data/bookings/b.ts',
    ],
    [
      'presentation',
      'src/presentation/items/a.ts',
      "import { x } from '../bookings/b'; export const a = x;",
      'src/presentation/bookings/b.ts',
    ],
  ])('rejects one %s feature importing another', (_layer, from, code, to) => {
    expect(cruise({ [from]: code, [to]: ok })).not.toBe(0);
  });
});
