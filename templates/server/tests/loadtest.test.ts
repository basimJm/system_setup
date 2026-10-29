import { buildTargets } from '../src/utils/loadtest/cli';
import { formatReport, runLoad, type LoadTarget } from '../src/utils/loadtest/run';
import { percentile, summarize } from '../src/utils/loadtest/stats';

describe('percentile / summarize', () => {
  it('uses the nearest-rank rule and counts errors', () => {
    const list = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(list, 95)).toBe(95);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBe(0);
    expect(
      summarize([
        { ms: 30, ok: true },
        { ms: 10, ok: true },
        { ms: 500, ok: false },
        { ms: 20, ok: true },
      ]),
    ).toMatchObject({ requests: 4, errors: 1, errorRate: 0.25, p50: 20, max: 500 });
  });
});

describe('runLoad', () => {
  const run = (
    timings: Record<string, { ms: number; status?: number; throws?: boolean }>,
  ): ReturnType<typeof runLoad> => {
    let clock = 0;
    const targets: LoadTarget[] = Object.entries(timings).map(([name, t]) => ({
      name,
      send: () => {
        clock += t.ms;
        return t.throws === true
          ? Promise.reject(new Error('network'))
          : Promise.resolve(t.status ?? 200);
      },
    }));
    return runLoad({ targets, concurrency: 1, durationMs: 1_000, now: () => clock });
  };

  it('passes fast healthy targets and fails slow or failing ones', async () => {
    const ok = await run({ a: { ms: 10 } });
    expect(ok.passed).toBe(true);
    const slow = await run({ a: { ms: 400 } });
    expect(slow.passed).toBe(false);
    const failing = await run({ a: { ms: 5, throws: true } });
    expect(failing.targets[0]?.errors).toBeGreaterThan(0);
    expect(formatReport(failing)).toContain('FAIL');
    await expect(runLoad({ targets: [], concurrency: 1, durationMs: 1 })).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it('builds the read targets of the running server', () => {
    const names = buildTargets({ baseUrl: 'http://localhost:3000', token: 't' }).map((t) => t.name);
    expect(names).toEqual(['health', 'items']);
  });
});
