import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkEnvText } from '../src/config/checkEnv';

const PLACEHOLDER = 'REPLACE_ME';
const example = (name: string): string =>
  readFileSync(join(__dirname, '..', 'docker', name), 'utf8');

/** Valid, obviously fake values for every key of the hosted templates. */
const VALUES: Readonly<Record<string, string>> = {
  CORS_ALLOWED_ORIGINS: 'https://admin.example.com',
  MONGODB_URI: 'mongodb+srv://cluster.example.com/app',
  REDIS_URL: 'rediss://cache.example.com:6380',
  JWT_ACCESS_SECRET: 'p'.repeat(48),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  OTP_CODE_SECRET: 'c'.repeat(40),
  OTP_PROOF_SECRET: 'f'.repeat(40),
};

const fill = (template: string): string =>
  template
    .split('\n')
    .map((line) => {
      const key = line.split('=')[0] ?? '';
      const value = VALUES[key];
      return value !== undefined && line.endsWith(PLACEHOLDER) ? `${key}=${value}` : line;
    })
    .join('\n');

describe('checkEnvText', () => {
  it('accepts the development template as is', () => {
    expect(checkEnvText(example('env.development.example'))).toMatchObject({
      ok: true,
      invalidKeys: [],
    });
  });

  describe.each(['env.dev.example', 'env.prod.example'])('%s', (template) => {
    it('rejects the untouched template and names keys only', () => {
      const result = checkEnvText(example(template));
      expect(result.ok).toBe(false);
      expect(result.invalidKeys.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toContain(PLACEHOLDER.toLowerCase());
    });

    it('passes once every placeholder is filled with a valid value', () => {
      expect(checkEnvText(fill(example(template)))).toMatchObject({ ok: true, invalidKeys: [] });
    });

    it('explains each problem without the value', () => {
      const result = checkEnvText(example(template));
      for (const problem of result.problems) {
        expect(problem.reason).toMatch(/is not set|is set but empty|has an invalid value/);
        expect(problem.reason).not.toContain(PLACEHOLDER);
      }
    });
  });

  it('rethrows unexpected errors', () => {
    expect(() =>
      checkEnvText(
        'MONGODB_URI=mongodb://x\nREDIS_URL=redis://y\nJWT_ACCESS_SECRET=' + 'a'.repeat(48),
      ),
    ).not.toThrow();
  });
});
