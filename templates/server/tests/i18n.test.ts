import { ERROR_CODES, errorMessageKey } from '../src/constants/errorCodes';
import { LANGUAGES } from '../src/constants/i18n';
import { MESSAGES, translate } from '../src/utils/i18n';

const placeholdersOf = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

describe('locales completeness (CLAUDE.md §7)', () => {
  const arKeys = Object.keys(MESSAGES.ar).sort();
  const enKeys = Object.keys(MESSAGES.en).sort();

  it('has identical keys in ar and en', () => {
    expect(arKeys).toEqual(enKeys);
  });

  it.each(LANGUAGES)('has no empty values in %s', (language) => {
    const empty = Object.entries(MESSAGES[language]).filter(([, value]) => value.trim() === '');
    expect(empty).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of enKeys) {
      expect(placeholdersOf(MESSAGES.ar[key] ?? '')).toEqual(
        placeholdersOf(MESSAGES.en[key] ?? ''),
      );
    }
  });

  it('has a message for every error code in both languages', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(MESSAGES.ar[errorMessageKey(code)]).toBeTruthy();
      expect(MESSAGES.en[errorMessageKey(code)]).toBeTruthy();
    }
  });

  it('writes Arabic messages in Arabic script', () => {
    const arabic = /[؀-ۿ]/;
    for (const value of Object.values(MESSAGES.ar)) expect(value).toMatch(arabic);
  });
});

describe('translate', () => {
  const key = errorMessageKey(ERROR_CODES.OTP_INVALID);

  it('returns the requested language', () => {
    expect(translate('en', key)).toBe(MESSAGES.en[key]);
    expect(translate('ar', key)).toBe(MESSAGES.ar[key]);
    expect(translate('ar', key)).not.toBe(translate('en', key));
  });

  it('returns the key itself when no translation exists', () => {
    expect(translate('en', 'errors.DOES_NOT_EXIST')).toBe('errors.DOES_NOT_EXIST');
  });

  it('interpolates params and leaves unknown placeholders untouched', () => {
    const ar = MESSAGES.ar as Record<string, string>;
    ar['test.params'] = 'Max {max} of {unit} {missing}';
    try {
      expect(translate('ar', 'test.params', { max: 5, unit: 'items' })).toBe(
        'Max 5 of items {missing}',
      );
      // English lacks the key, so the default language (Arabic) entry is used
      expect(translate('en', 'test.params', { max: 1, unit: 'x' })).toBe('Max 1 of x {missing}');
    } finally {
      delete ar['test.params'];
    }
  });
});
