import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_CODE_KIND, isErrorCode } from '@/constants/errorCatalog';
import { ERROR_KINDS } from '@/constants/errors';
import { AppError } from '@/infrastructure/errors/AppError';
import { fieldErrorsFrom } from '@/infrastructure/errors/fieldErrors';
import { kindFromResponse } from '@/infrastructure/errors/normalize';
import ar from '@/locales/ar';
import en from '@/locales/en';
import { components } from '@/data/contract/generated/dto';
import { ROOT } from './helpers/files';

const ARABIC = /[؀-ۿ]/;
const PLACEHOLDER = /\{\{\s*\w+\s*\}\}/g;

/** The server's domain document, when the server project sits next to this one (monorepo layout). */
const DOMAIN_DOC = `${ROOT}/../BUSINESS_DOMAIN.md`;

/** The code list of BUSINESS_DOMAIN.md §11, read from the document itself. */
function domainCodes(): string[] {
  const doc = readFileSync(DOMAIN_DOC, 'utf8');
  const section = doc.slice(doc.indexOf('## 11. Error Codes'), doc.indexOf('## 12.'));
  const block = section.split('```')[1] ?? '';
  return block.match(/\b[A-Z][A-Z_]{3,}\b/g) ?? [];
}

describe('error catalog', () => {
  it.skipIf(!existsSync(DOMAIN_DOC))('lists exactly the codes of BUSINESS_DOMAIN.md §11', () => {
    expect([...ERROR_CODES].sort()).toEqual(domainCodes().sort());
  });

  it('matches the OpenAPI ErrorResponse code enum', () => {
    const shape = components.ErrorResponse().shape.error.shape.code.options;
    expect([...shape].sort()).toEqual([...ERROR_CODES].sort());
  });

  it('maps every code to a known error kind', () => {
    for (const code of ERROR_CODES) expect(ERROR_KINDS).toContain(ERROR_CODE_KIND[code]);
  });

  it('has a non-empty message in both languages, Arabic in Arabic script, same placeholders', () => {
    for (const code of ERROR_CODES) {
      const a = ar.errors.codes[code];
      const e = en.errors.codes[code];
      expect(a, code).toMatch(ARABIC);
      expect(e.trim(), code).not.toBe('');
      expect(a.match(PLACEHOLDER) ?? [], code).toEqual(e.match(PLACEHOLDER) ?? []);
    }
    expect(Object.keys(ar.errors.codes).sort()).toEqual([...ERROR_CODES].sort());
    expect(Object.keys(en.errors.codes).sort()).toEqual([...ERROR_CODES].sort());
  });

  it('recognises codes and rejects look-alikes', () => {
    expect(isErrorCode('ITEM_ARCHIVED')).toBe(true);
    expect(isErrorCode('toString')).toBe(false);
    expect(isErrorCode('item_archived')).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
  });
});

describe('error handling by code', () => {
  it('a domain code decides the kind before the HTTP status', () => {
    expect(kindFromResponse(422, 'ITEM_ARCHIVED')).toBe('conflict');
    expect(kindFromResponse(400, 'OTP_INVALID')).toBe('validation');
    expect(kindFromResponse(503, 'INTERNAL')).toBe('server');
    expect(kindFromResponse(409, 'NOT_A_CODE')).toBe('conflict');
    expect(kindFromResponse(500)).toBe('server');
    expect(kindFromResponse(418)).toBe('unknown');
  });

  it('AppError points at the specific message for a known code, the generic one otherwise', () => {
    expect(new AppError({ kind: 'conflict', code: 'ITEM_ARCHIVED' }).messageKey).toBe(
      'errors.codes.ITEM_ARCHIVED',
    );
    expect(new AppError({ kind: 'conflict', code: 'WHO_KNOWS' }).messageKey).toBe(
      'errors.conflict',
    );
    expect(new AppError({ kind: 'network' }).messageKey).toBe('errors.network');
  });
});

describe('fieldErrorsFrom', () => {
  it('maps details to fields, first issue wins, blank fields are skipped', () => {
    const map = fieldErrorsFrom([
      { field: 'name.ar', code: 'too_small', message: 'Required' },
      { field: 'name.ar', message: 'second' },
      { field: '', message: 'ignored' },
      { field: 'reason' },
    ]);
    expect([...map.keys()]).toEqual(['name.ar', 'reason']);
    expect(map.get('name.ar')).toEqual({ message: 'Required', code: 'too_small' });
    expect(map.get('reason')).toEqual({ message: undefined, code: undefined });
  });

  it('reads the details of an AppError and handles none', () => {
    const error = new AppError({
      kind: 'validation',
      details: [{ field: 'email', message: 'bad' }],
    });
    expect(fieldErrorsFrom(error).get('email')?.message).toBe('bad');
    expect(fieldErrorsFrom(new AppError({ kind: 'validation' })).size).toBe(0);
  });
});
