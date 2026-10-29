import { FakeGateway } from '../src/adapters/fake';
import { HttpGateway } from '../src/adapters/http';
import { ERROR_CODES, SDK_NAME, createPayments, requestHash } from '../src';
import { SECRET } from './helpers/fixtures';

describe('createPayments', () => {
  it('picks the adapter from the provider and refuses fake in prod', () => {
    expect(
      createPayments({ environment: 'dev', provider: 'fake', webhookSecret: SECRET }),
    ).toBeInstanceOf(FakeGateway);
    expect(
      createPayments({
        environment: 'dev',
        provider: 'http',
        webhookSecret: SECRET,
        http: { baseUrl: 'http://localhost:1', apiKey: 'k' },
      }),
    ).toBeInstanceOf(HttpGateway);
    expect(() =>
      createPayments({ environment: 'prod', provider: 'fake', webhookSecret: SECRET }),
    ).toThrow(expect.objectContaining({ code: ERROR_CODES.CONFIG_INVALID }) as Error);
    expect(SDK_NAME).toBe('__SYSTEM_SLUG__-__SDK_KIND__');
    expect(ERROR_CODES.WEBHOOK_INVALID).toBe('__SDK_PREFIX___WEBHOOK_INVALID');
  });

  it('hashes requests independent of key order and undefined fields', () => {
    expect(requestHash({ a: 1, b: [{ d: 2, c: 3 }], e: undefined })).toBe(
      requestHash({ b: [{ c: 3, d: 2 }], a: 1 }),
    );
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
  });
});
