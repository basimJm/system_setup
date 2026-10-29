import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ERROR_KINDS } from '@/constants/errors';
import { HTTP_STATUS } from '@/constants/http';
import { AppError } from '@/infrastructure/errors/AppError';
import { kindFromResponse, normalizeError } from '@/infrastructure/errors/normalize';

describe('kindFromResponse', () => {
  it.each([
    [400, undefined, 'validation'],
    [401, undefined, 'unauthorized'],
    [403, undefined, 'forbidden'],
    [404, undefined, 'notFound'],
    [409, undefined, 'conflict'],
    [422, undefined, 'conflict'],
    [429, undefined, 'rateLimited'],
    [504, undefined, 'timeout'],
    [500, undefined, 'server'],
    [502, undefined, 'server'],
    [418, undefined, 'unknown'],
  ])('status %s -> %s', (status, code, kind) => {
    expect(kindFromResponse(status, code)).toBe(kind);
  });

  it('a domain code wins over the status', () => {
    expect(kindFromResponse(HTTP_STATUS.badRequest, 'FORBIDDEN')).toBe('forbidden');
    expect(kindFromResponse(HTTP_STATUS.serverError, 'NOT_FOUND')).toBe('notFound');
    expect(kindFromResponse(HTTP_STATUS.badRequest, 'SOME_NEW_CODE')).toBe('validation');
  });
});

describe('normalizeError', () => {
  it('passes AppError through untouched', () => {
    const e = new AppError({ kind: 'forbidden' });
    expect(normalizeError(e)).toBe(e);
  });

  it('maps fetch network failures, timeouts, aborts, zod and junk', () => {
    expect(normalizeError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(normalizeError(new DOMException('t', 'TimeoutError')).kind).toBe('timeout');
    expect(normalizeError(new DOMException('a', 'AbortError')).kind).toBe('unknown');
    const zodError = z.string().safeParse(1).error;
    expect(normalizeError(zodError).kind).toBe('parse');
    expect(normalizeError('boom').kind).toBe('unknown');
    expect(normalizeError(null).kind).toBe('unknown');
  });

  it('keeps the original error as cause', () => {
    const original = new TypeError('x');
    expect(normalizeError(original).cause).toBe(original);
  });
});

describe('AppError', () => {
  it('has a message key per kind and flags retryable kinds', () => {
    for (const kind of ERROR_KINDS)
      expect(new AppError({ kind }).messageKey).toBe(`errors.${kind}`);
    const retryable = ERROR_KINDS.filter((kind) => new AppError({ kind }).retryable);
    expect(retryable).toEqual(['network', 'timeout', 'server']);
  });

  it('prefers the localized server message', () => {
    expect(new AppError({ kind: 'conflict', serverMessage: 'الموعد محجوز' }).message).toBe(
      'الموعد محجوز',
    );
  });
});
