export interface Sample {
  readonly ms: number;
  readonly ok: boolean;
}

export interface Summary {
  readonly requests: number;
  readonly errors: number;
  readonly errorRate: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

/** Nearest-rank percentile of an ascending list (0 for an empty list). */
export const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
};

export const summarize = (samples: readonly Sample[]): Summary => {
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => !s.ok).length;
  return {
    requests: samples.length,
    errors,
    errorRate: samples.length === 0 ? 0 : errors / samples.length,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    max: times.at(-1) ?? 0,
  };
};
