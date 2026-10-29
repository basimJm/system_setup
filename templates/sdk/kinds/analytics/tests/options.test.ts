import { MemorySink } from '../src/adapters/memory';
import { resolveConfig, type AnalyticsOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/analytics';
import type { AnalyticsSink } from '../src/types';

const fieldsOf = (options: AnalyticsOptions): string[] => {
  try {
    resolveConfig(options);
  } catch (error) {
    expect((error as { code: string }).code).toBe(ERROR_CODES.CONFIG_INVALID);
    return (error as { details: { fields: string[] } }).details.fields;
  }
  return [];
};

const real: AnalyticsSink = { name: 'warehouse', deliver: () => Promise.resolve() };

describe('resolveConfig', () => {
  it('applies defaults and keeps injected objects', () => {
    const config = resolveConfig({ environment: 'dev', provider: 'memory' });
    expect(config).toMatchObject({
      http: undefined,
      batchSize: 50,
      flushIntervalMs: 5_000,
      maxQueue: 10_000,
      timeoutMs: 10_000,
      retry: { maxAttempts: 3 },
      sink: undefined,
      fetch: undefined,
      timers: undefined,
    });
    expect(config.now()).toBeInstanceOf(Date);
    const timers = { set: () => 1, clear: () => undefined };
    const custom = resolveConfig({
      environment: 'dev',
      provider: 'http',
      http: { endpoint: 'http://localhost:9999/ingest/' },
      batchSize: 2,
      flushIntervalMs: 0,
      maxQueue: 3,
      timeoutMs: 1,
      retry: { maxAttempts: 1 },
      sink: real,
      timers,
    });
    expect(custom).toMatchObject({
      http: { endpoint: 'http://localhost:9999/ingest', apiKey: undefined },
      batchSize: 2,
      flushIntervalMs: 0,
      maxQueue: 3,
      sink: real,
      timers,
    });
  });

  it('names invalid fields only', () => {
    expect(fieldsOf({ environment: 'dev', provider: 'http' })).toEqual(['http']);
    expect(fieldsOf({ environment: 'dev', provider: 'http', sink: real })).toEqual([]);
    expect(fieldsOf({ environment: 'dev', provider: 'memory', batchSize: 501 })).toEqual([
      'batchSize',
    ]);
    expect(fieldsOf({ environment: 'dev', provider: 'memory', flushIntervalMs: -1 })).toEqual([
      'flushIntervalMs',
    ]);
  });

  it('is strict in production', () => {
    const prod: AnalyticsOptions = {
      environment: 'prod',
      provider: 'http',
      http: { endpoint: 'https://ingest.example.test', apiKey: 'k' },
    };
    expect(fieldsOf(prod)).toEqual([]);
    expect(fieldsOf({ ...prod, provider: 'memory' })).toEqual(['provider']);
    expect(fieldsOf({ ...prod, provider: 'memory', sink: real })).toEqual([]);
    expect(fieldsOf({ ...prod, sink: new MemorySink() })).toEqual(['sink']);
    expect(fieldsOf({ ...prod, http: { endpoint: 'https://ingest.example.test' } })).toEqual([
      'http.apiKey',
    ]);
    expect(
      fieldsOf({ ...prod, http: { endpoint: 'http://ingest.example.test', apiKey: 'k' } }),
    ).toEqual(['http.endpoint']);
  });
});
