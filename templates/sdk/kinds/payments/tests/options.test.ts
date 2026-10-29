import { resolveConfig, type PaymentsOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/payments';
import { SECRET } from './helpers/fixtures';

const fieldsOf = (options: PaymentsOptions): string[] => {
  try {
    resolveConfig(options);
  } catch (error) {
    expect((error as { code: string }).code).toBe(ERROR_CODES.CONFIG_INVALID);
    return (error as { details: { fields: string[] } }).details.fields;
  }
  return [];
};

const http = {
  baseUrl: 'http://localhost:4242/',
  apiKey: 'k',
  checkoutUrl: 'http://localhost:4242/pay/',
};

describe('resolveConfig', () => {
  it('applies defaults and trims URLs', () => {
    const config = resolveConfig({ environment: 'dev', provider: 'fake', webhookSecret: 's' });
    expect(config).toMatchObject({
      currencies: [],
      sessionTtlSec: 1_800,
      webhookToleranceSec: 300,
      http: undefined,
      timeoutMs: 10_000,
      retry: { maxAttempts: 3 },
      fetch: undefined,
    });
    expect(config.now()).toBeInstanceOf(Date);
    const withHttp = resolveConfig({
      environment: 'dev',
      provider: 'http',
      webhookSecret: 's',
      http,
      currencies: ['JOD'],
      sessionTtlSec: 60,
      webhookToleranceSec: 10,
      timeoutMs: 5,
      retry: { maxAttempts: 1 },
      fetch: () => Promise.reject(new Error('x')),
    });
    expect(withHttp.http).toEqual({
      baseUrl: 'http://localhost:4242',
      apiKey: 'k',
      checkoutUrl: 'http://localhost:4242/pay',
    });
    expect(withHttp).toMatchObject({
      currencies: ['JOD'],
      sessionTtlSec: 60,
      webhookToleranceSec: 10,
      timeoutMs: 5,
    });
    expect(
      resolveConfig({
        environment: 'dev',
        provider: 'http',
        webhookSecret: 's',
        http: { baseUrl: 'http://h', apiKey: 'k' },
      }).http?.checkoutUrl,
    ).toBeUndefined();
  });

  it('names invalid fields only', () => {
    expect(fieldsOf({ environment: 'dev', provider: 'http', webhookSecret: 's' })).toEqual([
      'http',
    ]);
    expect(
      fieldsOf({ environment: 'dev', provider: 'fake', webhookSecret: 's', currencies: ['jod'] }),
    ).toEqual(['currencies.0']);
    expect(fieldsOf({ environment: 'dev', provider: 'fake', webhookSecret: '' })).toEqual([
      'webhookSecret',
    ]);
  });

  it('is strict in production', () => {
    const prod: PaymentsOptions = {
      environment: 'prod',
      provider: 'http',
      webhookSecret: SECRET,
      http: {
        baseUrl: 'https://gw.example.test',
        apiKey: 'k',
        checkoutUrl: 'https://pay.example.test',
      },
    };
    expect(fieldsOf(prod)).toEqual([]);
    expect(fieldsOf({ ...prod, provider: 'fake' })).toEqual(['provider']);
    expect(fieldsOf({ ...prod, webhookSecret: 'short' })).toEqual(['webhookSecret']);
    expect(fieldsOf({ ...prod, http: { ...http } })).toEqual(['http.baseUrl', 'http.checkoutUrl']);
  });
});
