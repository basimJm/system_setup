const KEY_LINE = /^\s*([A-Z][A-Z0-9_]*)\s*=/;
const COMMENT_PREFIX = '#';

/** Keys assigned in a dotenv file; comments and blank lines are ignored, values are never read. */
export function parseEnvKeys(content: string): string[] {
  const keys = content
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(COMMENT_PREFIX))
    .map((line) => KEY_LINE.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);
  return [...new Set(keys)];
}

export interface EnvSources {
  /** Keys listed in `.env.example`. */
  example: readonly string[];
  /** Keys declared in `constants/env.ts` (`ENV_KEYS`). */
  constants: readonly string[];
  /** Keys read by the zod schema in `infrastructure/config/envSchema.ts`. */
  schema: readonly string[];
}

const missing = (from: readonly string[], to: readonly string[]) =>
  from.filter((key) => !to.includes(key));

/** Problems (key names only) where the three sources of the env contract disagree. */
export function compareEnvSources({ example, constants, schema }: EnvSources): string[] {
  const sources = [
    ['.env.example', example],
    ['constants/env.ts', constants],
    ['envSchema.ts', schema],
  ] as const;
  return sources.flatMap(([name, keys]) =>
    sources
      .filter(([other]) => other !== name)
      .flatMap(([other, otherKeys]) =>
        missing(otherKeys, keys).map((key) => `${key} is in ${other} but missing from ${name}`),
      ),
  );
}
