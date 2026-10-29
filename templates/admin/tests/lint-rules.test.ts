import { describe, expect, it } from 'vitest';
import { read, ROOT } from './helpers/files';

const configText = read(`${ROOT}/eslint.config.js`);

describe('quality-gate lint rules', () => {
  it.each([
    'complexity',
    'max-params',
    'max-depth',
    'max-lines',
    '@typescript-eslint/no-deprecated',
    '@typescript-eslint/no-explicit-any',
  ])('%s is configured as an error, never a warning', (rule) => {
    const pattern = new RegExp(`'?${rule}'?:\\s*(\\[\\s*)?'error'`);
    expect(configText).toMatch(pattern);
  });

  it('keeps the thresholds in named constants', () => {
    expect(configText).toMatch(/const MAX_COMPLEXITY = \d+;/);
    expect(configText).toMatch(/const MAX_PARAMS = \d+;/);
  });
});
