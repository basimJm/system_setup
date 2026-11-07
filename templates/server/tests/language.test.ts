import type { NextFunction, Request, Response } from 'express';
import { ACCEPT_LANGUAGE_HEADER } from '../src/constants/i18n';
import { language, resolveLanguage } from '../src/middlewares/language';
import { MESSAGES } from '../src/utils/i18n';

describe('resolveLanguage', () => {
  it.each([
    [undefined, 'ar'],
    ['', 'ar'],
    ['ar', 'ar'],
    ['en', 'en'],
    ['EN', 'en'],
    ['en-US', 'en'],
    ['ar-EG', 'ar'],
    ['en-US,en;q=0.9,ar;q=0.8', 'en'],
    ['ar;q=0.5,en;q=0.9', 'en'],
    ['fr,en;q=0.5', 'en'],
    ['fr-FR,de', 'ar'],
    ['*', 'ar'],
    ['en;q=0,ar;q=0.1', 'ar'],
    ['en;q=abc', 'ar'],
  ])('resolves %p to %p', (header, expected) => {
    expect(resolveLanguage(header)).toBe(expected);
  });
});

describe('language middleware', () => {
  const run = (header?: string): { req: Request; next: jest.Mock } => {
    const req = {
      get: (name: string): string | undefined =>
        name.toLowerCase() === ACCEPT_LANGUAGE_HEADER ? header : undefined,
    } as unknown as Request;
    const next = jest.fn();
    language(req, {} as Response, next as NextFunction);
    return { req, next };
  };

  it('defaults to Arabic and installs a translator', () => {
    const { req, next } = run();
    expect(req.language).toBe('ar');
    expect(req.t('errors.NOT_FOUND')).toBe(MESSAGES.ar['errors.NOT_FOUND']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('translates to English when requested', () => {
    const { req } = run('en');
    expect(req.language).toBe('en');
    expect(req.t('errors.NOT_FOUND')).toBe(MESSAGES.en['errors.NOT_FOUND']);
  });
});
