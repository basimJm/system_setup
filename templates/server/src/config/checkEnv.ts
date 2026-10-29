import { parseEnv } from 'node:util';
import { ConfigError, loadConfig, type ConfigProblem } from './index';

/** Outcome of validating an env file against the server's own schema; never carries values. */
export interface EnvCheckResult {
  readonly ok: boolean;
  readonly invalidKeys: readonly string[];
  /** Why each key is invalid (missing, empty or invalid and what a valid value looks like). */
  readonly problems: readonly ConfigProblem[];
}

/**
 * Validates the text of an env file exactly as the server would at startup (same schema, same
 * production rules), so a deployment is checked before it boots. Reports key names only.
 */
export const checkEnvText = (text: string): EnvCheckResult => {
  try {
    loadConfig(parseEnv(text));
    return { ok: true, invalidKeys: [], problems: [] };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { ok: false, invalidKeys: error.invalidKeys, problems: error.problems };
    }
    throw error;
  }
};
