import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_KEYS } from '../src/constants/env.ts';
import { parseEnvKeys } from '../scripts/lib/env.ts';

const PUBLIC_KEYS: readonly string[] = Object.values(ENV_KEYS);
const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');
const values = (content: string): Record<string, string> =>
  Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );

describe.each(['.env.dev', '.env.prod'])('%s (committed placeholders)', (file) => {
  const content = read(file);

  it('holds only the public keys of the env contract', () => {
    for (const key of parseEnvKeys(content)) expect(PUBLIC_KEYS).toContain(key);
  });

  it('names https URLs for the API and the socket server and nothing secret-looking', () => {
    const v = values(content);
    expect(v[ENV_KEYS.apiBaseUrl]).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(v[ENV_KEYS.socketUrl]).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(JSON.stringify(v)).not.toMatch(/secret|password|token/i);
  });
});

describe('.env.example', () => {
  it('lists every public key', () => {
    expect(parseEnvKeys(read('.env.example')).sort()).toEqual([...PUBLIC_KEYS].sort());
  });
});
