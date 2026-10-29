import { HttpSink } from './adapters/http';
import { FakeSink, MemorySink } from './adapters/memory';
import {
  resolveConfig,
  type AnalyticsOptions,
  type FetchLike,
  type ResolvedConfig,
} from './config/options';
import { configError } from './errors';
import { Tracker } from './tracker';
import type { AnalyticsSink } from './types';

/** A tracker plus the sink it delivers to (memory / fake sinks expose the events). */
export interface Analytics extends Tracker {
  readonly sink: AnalyticsSink;
}

const buildSink = (config: ResolvedConfig): AnalyticsSink => {
  if (config.sink) return config.sink;
  switch (config.provider) {
    case 'fake':
      return new FakeSink();
    case 'memory':
      return new MemorySink();
    case 'http': {
      /* istanbul ignore next -- resolveConfig already guarantees it; kept for the type checker */
      if (!config.http) throw configError('http options are required', { fields: ['http'] });
      const fetchImpl: FetchLike = config.fetch ?? globalThis.fetch;
      return new HttpSink({ ...config.http, timeoutMs: config.timeoutMs, fetch: fetchImpl });
    }
  }
};

/** The factory: the sink comes from `options.sink` or from `options.provider` (prod refuses fake/memory). */
export const createAnalytics = (options: AnalyticsOptions): Analytics => {
  const config = resolveConfig(options);
  const sink = buildSink(config);
  return Object.assign(new Tracker(config, { sink }), { sink });
};
