import { z } from 'zod';
import {
  DATA_SOURCES,
  DEFAULT_DATA_SOURCE,
  DEV_DEBUG_DATA_SOURCE,
  ENV_KEYS,
  HTTPS_PROTOCOL,
  type DataSource,
} from '../../constants/env.ts';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../../constants/i18n.ts';
import type { BuildVariant } from './variant.ts';

export class ConfigError extends Error {
  /** Names of the offending keys; values are never included. */
  readonly keys: readonly string[];
  constructor(keys: readonly string[]) {
    super(`Invalid configuration: ${keys.join(', ')}`);
    this.name = 'ConfigError';
    this.keys = keys;
  }
}

export interface PublicEnv {
  readonly apiBaseUrl: string;
  readonly socketUrl: string;
  readonly dataSource: DataSource;
  readonly defaultLanguage: Language;
}

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const url = () => z.preprocess(blankToUndefined, z.url().optional());

const rawSchema = z.object({
  [ENV_KEYS.apiBaseUrl]: url(),
  [ENV_KEYS.socketUrl]: url(),
  [ENV_KEYS.dataSource]: z.preprocess(blankToUndefined, z.enum(DATA_SOURCES).optional()),
  [ENV_KEYS.defaultLanguage]: z.preprocess(blankToUndefined, z.enum(LANGUAGES).optional()),
});

/** Keys the schema reads; `npm run check:env` keeps them equal to ENV_KEYS and `.env.example`. */
export const ENV_SCHEMA_KEYS: readonly string[] = Object.keys(rawSchema.shape);

type UrlValues = Readonly<{ apiBaseUrl: string; socketUrl: string }>;

/** Keys that make the chosen data source unusable for this variant (mock in prod, remote without URLs). */
function invalidDataSourceKeys(
  dataSource: DataSource,
  variant: BuildVariant,
  urls: UrlValues,
): string[] {
  if (dataSource === 'mock') return variant.allowMock ? [] : [ENV_KEYS.dataSource];
  return [
    ...(urls.apiBaseUrl ? [] : [ENV_KEYS.apiBaseUrl]),
    ...(urls.socketUrl ? [] : [ENV_KEYS.socketUrl]),
  ];
}

/** Keys whose URL is set but not https (prod only). */
function insecureUrlKeys(urls: UrlValues): string[] {
  const entries = [
    [ENV_KEYS.apiBaseUrl, urls.apiBaseUrl],
    [ENV_KEYS.socketUrl, urls.socketUrl],
  ] as const;
  return entries
    .filter(([, value]) => value && new URL(value).protocol !== HTTPS_PROTOCOL)
    .map(([key]) => key);
}

/** Validates the public (browser-visible) env for a build variant. Throws ConfigError naming keys only. */
export function parsePublicEnv(
  raw: Readonly<Record<string, string | undefined>>,
  variant: BuildVariant,
): PublicEnv {
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
  }
  const v = parsed.data;
  const dataSource =
    v[ENV_KEYS.dataSource] ?? (variant.allowMock ? DEV_DEBUG_DATA_SOURCE : DEFAULT_DATA_SOURCE);
  const apiBaseUrl = v[ENV_KEYS.apiBaseUrl] ?? '';
  const socketUrl = v[ENV_KEYS.socketUrl] ?? '';
  const bad = [
    ...invalidDataSourceKeys(dataSource, variant, { apiBaseUrl, socketUrl }),
    ...(variant.appEnv === 'prod' ? insecureUrlKeys({ apiBaseUrl, socketUrl }) : []),
  ];
  if (bad.length > 0) throw new ConfigError([...new Set(bad)]);

  return {
    apiBaseUrl,
    socketUrl,
    dataSource,
    defaultLanguage: v[ENV_KEYS.defaultLanguage] ?? DEFAULT_LANGUAGE,
  };
}
