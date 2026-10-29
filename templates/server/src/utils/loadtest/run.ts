import { LOADTEST_ERROR_BUDGET, LOADTEST_P95_TARGET_MS } from '../../constants/loadtest';
import { summarize, type Sample, type Summary } from './stats';

export interface LoadTarget {
  readonly name: string;
  /** One request; resolves to the HTTP status (a thrown error counts as a failure). */
  readonly send: () => Promise<number>;
}

export interface LoadOptions {
  readonly targets: readonly LoadTarget[];
  readonly concurrency: number;
  readonly durationMs: number;
  /** Injected for tests. */
  readonly now?: () => number;
}

export interface TargetReport extends Summary {
  readonly name: string;
  readonly passed: boolean;
}

export interface LoadReport {
  readonly targets: TargetReport[];
  readonly passed: boolean;
}

/** Runs the targets round-robin from `concurrency` workers until the time is up. */
export const runLoad = async (options: LoadOptions): Promise<LoadReport> => {
  const { targets, concurrency, durationMs } = options;
  if (targets.length === 0 || concurrency < 1 || durationMs < 1) {
    throw new RangeError('a load run needs targets, concurrency >= 1 and a duration');
  }
  const now = options.now ?? ((): number => performance.now());
  const samples = new Map<string, Sample[]>(targets.map((t) => [t.name, []]));
  const deadline = now() + durationMs;
  let next = 0;

  const worker = async (): Promise<void> => {
    while (now() < deadline) {
      const target = targets[next % targets.length];
      next += 1;
      if (target === undefined) return;
      const started = now();
      let ok = false;
      try {
        const status = await target.send();
        ok = status >= 200 && status < 300;
      } catch {
        ok = false;
      }
      samples.get(target.name)?.push({ ms: now() - started, ok });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  const reports = targets.map((t): TargetReport => {
    const summary = summarize(samples.get(t.name) ?? []);
    return {
      name: t.name,
      ...summary,
      passed:
        summary.requests > 0 &&
        summary.p95 <= LOADTEST_P95_TARGET_MS &&
        summary.errorRate <= LOADTEST_ERROR_BUDGET,
    };
  });
  return { targets: reports, passed: reports.every((r) => r.passed) };
};

export const formatReport = (report: LoadReport): string =>
  [
    'target                requests  errors   p50     p95     p99     max   result',
    ...report.targets.map(
      (r) =>
        `${r.name.padEnd(20)} ${String(r.requests).padStart(9)} ${String(r.errors).padStart(7)} ` +
        `${r.p50.toFixed(0).padStart(6)} ${r.p95.toFixed(0).padStart(7)} ${r.p99.toFixed(0).padStart(7)} ` +
        `${r.max.toFixed(0).padStart(7)}   ${r.passed ? 'PASS' : 'FAIL'}`,
    ),
    '',
  ].join('\n');
