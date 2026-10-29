import { describe, expect, it } from 'vitest';
import { GENERATED_DIR } from '../scripts/lib/contractFiles.ts';
import { listFiles, read, rel, ROOT, SRC } from './helpers/files';

const MAX_LINES = 300;
const LAYER_RULES: Record<string, string[]> = {
  domain: ['data', 'presentation', 'infrastructure', 'app', 'design'],
  infrastructure: ['data', 'presentation', 'app', 'design'],
  data: ['presentation', 'app', 'design'],
  design: ['data', 'presentation', 'app', 'domain'],
  presentation: ['data'],
};
const importsOf = (code: string) =>
  [...code.matchAll(/from\s+'(@\/[^']+)'/g)].map((m) => m[1] as string);

describe('architecture', () => {
  it('no source, style, test or script file exceeds 300 lines', () => {
    const files = [
      ...listFiles(SRC, /\.(ts|tsx|css|json)$/),
      ...listFiles(`${ROOT}/tests`, /\.(ts|tsx)$/),
      ...listFiles(`${ROOT}/scripts`, /\.ts$/),
    ];
    const tooLong = files
      .filter((f) => !rel(f).startsWith(GENERATED_DIR))
      .filter((f) => read(f).split('\n').length > MAX_LINES + 1)
      .map(rel);
    expect(tooLong).toEqual([]);
  });

  it.each(Object.entries(LAYER_RULES))(
    'layer "%s" does not import forbidden layers',
    (layer, forbidden) => {
      const bad = listFiles(`${SRC}/${layer}`, /\.(ts|tsx)$/).flatMap((file) =>
        importsOf(read(file))
          .filter((imp) => forbidden.some((f) => imp === `@/${f}` || imp.startsWith(`@/${f}/`)))
          .map((imp) => `${rel(file)} -> ${imp}`),
      );
      expect(bad).toEqual([]);
    },
  );

  it('console is used only by the logger sink; no explicit any', () => {
    const offenders = listFiles(SRC, /\.(ts|tsx)$/)
      .filter((f) => !f.endsWith('logger/logger.ts'))
      .filter((f) => /\bconsole\.\w+/.test(read(f)) || /:\s*any\b|<any>|as any\b/.test(read(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('raw fetch is used only inside the http client / data-source default', () => {
    const offenders = listFiles(SRC, /\.(ts|tsx)$/).filter(
      (f) => /[^.\w]fetch\(/.test(read(f)) && !f.endsWith('HttpClient.ts'),
    );
    expect(offenders.map(rel)).toEqual([]);
  });
});
