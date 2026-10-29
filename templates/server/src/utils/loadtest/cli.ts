import { HEALTH_PATHS } from '../../constants/health';
import { ITEM_ROUTES } from '../../constants/items';
import {
  LOADTEST_DEFAULT_CONCURRENCY,
  LOADTEST_DEFAULT_DURATION_SEC,
  LOADTEST_ENV,
  LOADTEST_REQUEST_TIMEOUT_MS,
} from '../../constants/loadtest';
import { API_PREFIXES } from '../../constants/server';
import { MS_PER_SECOND } from '../../constants/time';
import { formatReport, runLoad, type LoadTarget } from './run';

const need = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is required`);
  return value;
};
const number = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const parsed = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
};

/** `LOADTEST_BASE_URL=https://… LOADTEST_CUSTOMER_TOKEN=… node dist/utils/loadtest/cli.js` */
export const buildTargets = (env: { baseUrl: string; token: string }): LoadTarget[] => {
  const call = async (path: string, init: RequestInit = {}): Promise<number> => {
    const response = await fetch(`${env.baseUrl}${path}`, {
      ...init,
      headers: {
        'Accept-Language': 'en',
        Authorization: `Bearer ${env.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(LOADTEST_REQUEST_TIMEOUT_MS),
    });
    await response.arrayBuffer();
    return response.status;
  };
  return [
    { name: 'health', send: () => call(HEALTH_PATHS.live) },
    { name: 'items', send: () => call(`${API_PREFIXES.customer}${ITEM_ROUTES.base}`) },
  ];
};

const main = async (): Promise<void> => {
  const targets = buildTargets({
    baseUrl: need(LOADTEST_ENV.baseUrl).replace(/\/$/, ''),
    token: need(LOADTEST_ENV.customerToken),
  });
  const report = await runLoad({
    targets,
    concurrency: number(LOADTEST_ENV.concurrency, LOADTEST_DEFAULT_CONCURRENCY),
    durationMs: number(LOADTEST_ENV.durationSec, LOADTEST_DEFAULT_DURATION_SEC) * MS_PER_SECOND,
  });
  process.stdout.write(formatReport(report));
  process.exitCode = report.passed ? 0 : 1;
};

if (require.main === module) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'load test failed'}\n`);
    process.exitCode = 1;
  });
}
