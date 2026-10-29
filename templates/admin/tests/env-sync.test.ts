import { describe, expect, it } from 'vitest';
import { ENV_EXAMPLE_FILE, ENV_KEYS } from '@/constants/env';
import { ENV_SCHEMA_KEYS } from '@/infrastructure/config/envSchema';
import { compareEnvSources, parseEnvKeys } from '../scripts/lib/env.ts';
import { join } from 'node:path';
import { read, ROOT } from './helpers/files';

describe('parseEnvKeys', () => {
  it('reads assigned keys only, never values', () => {
    const content = 'A_KEY=\nB_KEY=secret-value\n  C_KEY = spaced\n';
    expect(parseEnvKeys(content)).toEqual(['A_KEY', 'B_KEY', 'C_KEY']);
    expect(parseEnvKeys(content).join()).not.toContain('secret-value');
  });

  it('ignores comments, blank lines, lower-case names and duplicates; handles CRLF', () => {
    const content = '# VITE_COMMENTED=1\n\r\nlower=1\nX=1\r\nX=2\n#X=3\n';
    expect(parseEnvKeys(content)).toEqual(['X']);
    expect(parseEnvKeys('')).toEqual([]);
  });
});

describe('compareEnvSources', () => {
  const same = { example: ['A', 'B'], constants: ['A', 'B'], schema: ['A', 'B'] };

  it('reports nothing when all three sources agree (order does not matter)', () => {
    expect(compareEnvSources(same)).toEqual([]);
    expect(compareEnvSources({ ...same, schema: ['B', 'A'] })).toEqual([]);
  });

  it('names a key missing from .env.example', () => {
    const problems = compareEnvSources({ ...same, example: ['A'] });
    expect(problems).toEqual([
      'B is in constants/env.ts but missing from .env.example',
      'B is in envSchema.ts but missing from .env.example',
    ]);
  });

  it('names a key that .env.example has but the code does not know', () => {
    const problems = compareEnvSources({ ...same, example: ['A', 'B', 'C'] });
    expect(problems.join('\n')).toContain('C is in .env.example but missing from constants/env.ts');
    expect(problems.join('\n')).toContain('C is in .env.example but missing from envSchema.ts');
  });

  it('names a key missing from the schema', () => {
    expect(compareEnvSources({ ...same, schema: ['A'] }).join('\n')).toContain(
      'B is in .env.example but missing from envSchema.ts',
    );
  });
});

describe('the real env contract', () => {
  it('.env.example, ENV_KEYS and the zod schema list exactly the same keys', () => {
    const example = parseEnvKeys(read(join(ROOT, ENV_EXAMPLE_FILE)));
    expect(
      compareEnvSources({ example, constants: Object.values(ENV_KEYS), schema: ENV_SCHEMA_KEYS }),
    ).toEqual([]);
    expect([...example].sort()).toEqual([...Object.values(ENV_KEYS)].sort());
  });

  it('.env.example holds no values (nothing secret can be committed by copying it)', () => {
    const assigned = read(join(ROOT, ENV_EXAMPLE_FILE))
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line));
    expect(assigned.length).toBeGreaterThan(0);
    for (const line of assigned) expect(line.split('=')[1]).toBe('');
  });

  it('every key is documented with a comment line above it', () => {
    const lines = read(join(ROOT, ENV_EXAMPLE_FILE)).split('\n');
    lines.forEach((line, i) => {
      if (/^[A-Z_]+=/.test(line)) expect(lines[i - 1]?.startsWith('#')).toBe(true);
    });
  });
});
