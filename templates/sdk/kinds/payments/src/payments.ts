import { FakeGateway } from './adapters/fake';
import { HttpGateway } from './adapters/http';
import {
  resolveConfig,
  type FetchLike,
  type PaymentsOptions,
  type ResolvedConfig,
} from './config/options';
import { configError } from './errors';
import type { PaymentGateway } from './types';

const buildHttp = (config: ResolvedConfig): HttpGateway => {
  /* istanbul ignore next -- resolveConfig already guarantees it; kept for the type checker */
  if (!config.http) throw configError('http options are required', { fields: ['http'] });
  const fetchImpl: FetchLike = config.fetch ?? globalThis.fetch;
  return new HttpGateway({ ...config, http: config.http }, { fetch: fetchImpl });
};

/** The factory: picks the adapter from `options.provider` (prod refuses `fake`). */
export const createPayments = (options: PaymentsOptions): PaymentGateway => {
  const config = resolveConfig(options);
  switch (config.provider) {
    case 'fake':
      return new FakeGateway(config);
    case 'http':
      return buildHttp(config);
  }
};
