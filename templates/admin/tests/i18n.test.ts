import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_KINDS } from '@/constants/errors';
import { LANGUAGES } from '@/constants/i18n';
import { NAV_ITEMS } from '@/constants/nav';
import { createI18n, directionOf } from '@/infrastructure/i18n/i18n';
import ar from '@/locales/ar';
import en from '@/locales/en';
import { LAZY_AREA_FILES, LAZY_AREAS } from '@/locales/lazyAreas';
import { listFiles, read, SRC } from './helpers/files';

type Tree = { [key: string]: string | Tree };
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'string' ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});

// Lazy areas (loaded with their screens, not the entry) count as defined strings too.
const lazy = Object.values(LAZY_AREAS);
const arFlat = flatten(Object.assign({}, ar, ...lazy.map((a) => a.ar)) as Tree);
const enFlat = flatten(Object.assign({}, en, ...lazy.map((a) => a.en)) as Tree);
const LAZY_FILES = new Set(Object.values(LAZY_AREA_FILES).flat());
const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort().join();
const ARABIC = /[؀-ۿ]/;
/** Values that name the OTHER language on purpose (design top bar: the Arabic UI shows "EN"). */
// File-type chips (XLS / CSV / PDF) and the em-dash "no value" mark read the same in both languages.
const LATIN_BY_DESIGN = new Set([
  'topbar.otherLanguageShort',
  // The product name stays Latin when the owner gave no Arabic name (web apps use it as the title).
  'app.name',
  'export.chip.XLSX',
  'export.chip.CSV',
  'export.chip.PDF',
  'common.none',
  'common.currency', // an ISO 4217 code, filled from the business answer
]);

describe('locale area files', () => {
  const areas = (lang: string) =>
    readdirSync(join(SRC, 'locales', lang))
      .filter((f) => f.endsWith('.json'))
      .sort();

  it('exist under the same names in both languages', () => {
    expect(areas('ar')).toEqual(areas('en'));
    expect(areas('en').length).toBeGreaterThan(0);
  });

  it('are all merged into the language module or a lazy area (nothing is left unloaded)', () => {
    for (const [lang, merged] of [
      ['ar', ar],
      ['en', en],
    ] as const) {
      const fromDisk = areas(lang)
        .filter((file) => !LAZY_FILES.has(file))
        .flatMap((file) =>
          Object.keys(JSON.parse(read(join(SRC, 'locales', lang, file))) as object),
        );
      expect(Object.keys(merged).sort()).toEqual(fromDisk.sort());
    }
  });

  it('use each top-level key once (no area overwrites another)', () => {
    const keys = areas('en').flatMap((file) =>
      Object.keys(JSON.parse(read(join(SRC, 'locales', 'en', file))) as object),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('locale files', () => {
  it('have exactly the same keys', () => {
    expect(Object.keys(arFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it('have no empty values and the same placeholders', () => {
    for (const [key, value] of Object.entries(enFlat)) {
      expect(value.trim(), key).not.toBe('');
      expect(arFlat[key]?.trim(), key).not.toBe('');
      expect(placeholders(arFlat[key] ?? ''), key).toBe(placeholders(value));
    }
  });

  it('Arabic values are Arabic (except currency-free technical text)', () => {
    const missing = Object.entries(arFlat)
      .filter(([k, v]) => !ARABIC.test(v) && !LATIN_BY_DESIGN.has(k))
      .map(([k]) => k);
    expect(missing).toEqual([]);
  });

  it('define every error kind, every nav label and every static t("…") key used in src', () => {
    const used = new Set<string>([
      ...ERROR_KINDS.map((k) => `errors.${k}`),
      ...NAV_ITEMS.map((n) => n.labelKey),
    ]);
    for (const file of listFiles(SRC, /\.(ts|tsx)$/)) {
      for (const m of read(file).matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1] as string);
    }
    const missing = [...used].filter((k) => !(k in enFlat) || !(k in arFlat));
    expect(missing).toEqual([]);
  });
});

describe('i18n instance', () => {
  it('translates in both languages and interpolates', () => {
    expect(createI18n('en').t('table.range', { from: 1, to: 10, total: 42 })).toBe('1–10 of 42');
    expect(createI18n('ar').t('common.retry')).toBe(ar.common.retry);
  });

  it('Arabic is RTL and English LTR', () => {
    expect(LANGUAGES.map(directionOf)).toEqual(['rtl', 'ltr']);
  });
});
