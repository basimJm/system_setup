import { z } from 'zod';
import { ENVIRONMENTS, type Environment } from '../constants/codes';
import { DEFAULT_RETRY, MAX_RETRY_ATTEMPTS } from '../constants/defaults';
import { configError } from '../errors';
import type { RetryPolicy } from '../retry';

export const text = z.string().trim().min(1);
export const positiveInt = z.number().int().positive();
export const environmentSchema = z.enum(ENVIRONMENTS);

export const retrySchema = z
  .object({
    maxAttempts: positiveInt.max(MAX_RETRY_ATTEMPTS),
    baseDelayMs: positiveInt,
    maxDelayMs: positiveInt,
    jitterRatio: z.number().min(0).max(1),
  })
  .partial()
  .strict();

export const resolveRetry = (retry: z.infer<typeof retrySchema> | undefined): RetryPolicy => ({
  maxAttempts: retry?.maxAttempts ?? DEFAULT_RETRY.maxAttempts,
  baseDelayMs: retry?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs,
  maxDelayMs: retry?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs,
  jitterRatio: retry?.jitterRatio ?? DEFAULT_RETRY.jitterRatio,
});

export const isHttps = (url: string): boolean => new URL(url).protocol === 'https:';
export const trimSlash = (url: string): string => url.replace(/\/+$/, '');

export interface ConfigIssue {
  readonly path: string;
  readonly message: string;
}

/** Throws `CONFIG_INVALID` naming the fields (never their values) when `issues` is not empty. */
export const throwIfIssues = (issues: readonly ConfigIssue[], what: string): void => {
  if (issues.length === 0) return;
  const fields = issues.map((issue) => issue.path);
  throw configError(
    `Invalid ${what} options: ${issues.map((i) => `${i.path} (${i.message})`).join(', ')}`,
    { fields },
  );
};

/** Validates plain options against a zod schema; the error names fields only. */
export const parseOptions = <S extends z.ZodType>(
  schema: S,
  plain: unknown,
  what: string,
): z.output<S> => {
  const parsed = schema.safeParse(plain);
  if (parsed.success) return parsed.data;
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].sort();
  throw configError(`Invalid ${what} options: ${fields.join(', ')}`, { fields });
};

/** Drops injected objects (loggers, stores, clocks) so the schema sees plain data only. */
export const plainOptions = (
  options: object,
  injected: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(options).filter(([name]) => !injected.includes(name)));

export interface ProdCheck {
  readonly environment: Environment;
  /** The chosen adapter. */
  readonly provider: string;
  /** Fake and process-local adapters: refused in production. */
  readonly devOnlyProviders: readonly string[];
  /** URLs that must be https in production (`path` = option name for the error). */
  readonly urls?: readonly { readonly path: string; readonly url: string | undefined }[];
  /** Secrets the real adapter needs in production (`present` = the consumer supplied it). */
  readonly secrets?: readonly { readonly path: string; readonly present: boolean }[];
}

/** The production rules every kind applies (Rules.md §2.5): nothing in dev, strict in prod. */
export const prodIssues = (check: ProdCheck): ConfigIssue[] => {
  if (check.environment !== 'prod') return [];
  const issues: ConfigIssue[] = [];
  if (check.devOnlyProviders.includes(check.provider))
    issues.push({ path: 'provider', message: `${check.provider} is refused in prod` });
  for (const { path, url } of check.urls ?? [])
    if (url !== undefined && !isHttps(url)) issues.push({ path, message: 'prod requires https' });
  for (const { path, present } of check.secrets ?? [])
    if (!present) issues.push({ path, message: 'required in prod' });
  return issues;
};
