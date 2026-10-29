import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles, ROOT } from './helpers/files';

const PATH_IN_BACKTICKS = /`((?:src|scripts|tests|docs|contract|e2e)\/[^`\s<>*{}]+?)`/g;
const IGNORED_PREFIXES = ['reports/'];

const docs = [
  join(ROOT, 'docs/ADMIN_ARCHITECTURE.md'),
  join(ROOT, 'docs/HOW_TO_ADD_A_MODULE.md'),
  ...listFiles(join(ROOT, 'docs/adr'), /\.md$/),
];

describe('architecture docs', () => {
  it.each(docs)('%s only points at files that exist', (file) => {
    const text = readFileSync(file, 'utf8');
    const missing = [...text.matchAll(PATH_IN_BACKTICKS)]
      .map((m) => (m[1] ?? '').replace(/[.,:;]$/, ''))
      .filter((p) => !IGNORED_PREFIXES.some((prefix) => p.startsWith(prefix)))
      .filter((p) => !existsSync(join(ROOT, p)));
    expect(missing).toEqual([]);
  });

  it('every ADR is listed in the ADR index', () => {
    const index = readFileSync(join(ROOT, 'docs/adr/README.md'), 'utf8');
    const adrs = listFiles(join(ROOT, 'docs/adr'), /\/\d{4}-.*\.md$/);
    for (const adr of adrs) expect(index).toContain(adr.split('/').pop());
  });
});
