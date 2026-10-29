import ar from '../../locales/ar.json';
import en from '../../locales/en.json';
import { DEFAULT_LANGUAGE, type Language } from '../../constants/i18n';
import type { MessageParams } from '../errors';

export type Messages = Readonly<Record<string, string>>;

export const MESSAGES: Readonly<Record<Language, Messages>> = { ar, en };

const PLACEHOLDER = /\{(\w+)\}/g;

const interpolate = (template: string, params?: MessageParams): string =>
  params === undefined
    ? template
    : template.replace(PLACEHOLDER, (match, name: string) => {
        const value = params[name];
        return value === undefined ? match : String(value);
      });

/**
 * Looks up `key` in the requested language, then in the default language, then returns the key
 * itself so a missing translation is visible but never crashes a request.
 */
export const translate = (language: Language, key: string, params?: MessageParams): string => {
  const template = MESSAGES[language][key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key;
  return interpolate(template, params);
};
