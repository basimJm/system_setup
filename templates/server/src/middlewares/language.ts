import type { NextFunction, Request, Response } from 'express';
import {
  ACCEPT_LANGUAGE_HEADER,
  DEFAULT_LANGUAGE,
  DEFAULT_QUALITY,
  LANGUAGES,
  LANGUAGE_LIST_SEPARATOR,
  LANGUAGE_PARAM_SEPARATOR,
  LANGUAGE_SUBTAG_SEPARATOR,
  LANGUAGE_WILDCARD,
  QUALITY_PREFIX,
  type Language,
} from '../constants/i18n';
import { translate } from '../utils/i18n';
import type { MessageParams } from '../utils/errors';

const isSupported = (value: string): value is Language =>
  LANGUAGES.some((language) => language === value);

interface WeightedTag {
  readonly tag: string;
  readonly quality: number;
}

const parseEntry = (entry: string): WeightedTag => {
  const [rawTag = '', ...params] = entry.split(LANGUAGE_PARAM_SEPARATOR);
  const qualityParam = params.map((p) => p.trim()).find((p) => p.startsWith(QUALITY_PREFIX));
  const quality = qualityParam
    ? Number(qualityParam.slice(QUALITY_PREFIX.length))
    : DEFAULT_QUALITY;
  return { tag: rawTag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
};

/** Picks the best supported language from an `Accept-Language` header; default is Arabic. */
export const resolveLanguage = (header: string | undefined): Language => {
  if (header === undefined) return DEFAULT_LANGUAGE;
  const ranked = header
    .split(LANGUAGE_LIST_SEPARATOR)
    .map(parseEntry)
    .filter((entry) => entry.tag !== '' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);
  for (const { tag } of ranked) {
    if (tag === LANGUAGE_WILDCARD) return DEFAULT_LANGUAGE;
    const base = tag.split(LANGUAGE_SUBTAG_SEPARATOR)[0] ?? '';
    if (isSupported(base)) return base;
  }
  return DEFAULT_LANGUAGE;
};

/** Sets `req.language` and a bound translator `req.t` for the request. */
export const language = (req: Request, _res: Response, next: NextFunction): void => {
  req.language = resolveLanguage(req.get(ACCEPT_LANGUAGE_HEADER));
  req.t = (key: string, params?: MessageParams): string => translate(req.language, key, params);
  next();
};
