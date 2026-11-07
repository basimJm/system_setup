import { ERROR_CODES, resolveConfig } from '../src';
import { Fake__SDK_TITLE__Port } from '../src/adapters/fake';

const refused = (fn: () => unknown): unknown =>
  expect(fn).toThrow(expect.objectContaining({ code: ERROR_CODES.CONFIG_INVALID }) as Error);

describe('resolveConfig', () => {
  it('accepts the fake provider in dev with defaults', () => {
    const config = resolveConfig({ environment: 'dev', provider: 'fake' });
    expect(config.timeoutMs).toBeGreaterThan(0);
    expect(config.retry.maxAttempts).toBeGreaterThan(0);
    expect(config.port).toBeUndefined();
  });

  it('takes the timeout, the retry policy and the injected port', () => {
    const port = { name: 'x', execute: () => Promise.resolve({ id: '1', status: 'DONE' as const }) };
    const config = resolveConfig({
      environment: 'prod',
      provider: 'custom',
      timeoutMs: 500,
      retry: { maxAttempts: 2 },
      port,
    });
    expect(config.timeoutMs).toBe(500);
    expect(config.retry.maxAttempts).toBe(2);
    expect(config.port).toBe(port);
  });

  it('refuses the fake provider and a fake port in prod, custom without a port, and unknown keys', () => {
    refused(() => resolveConfig({ environment: 'prod', provider: 'fake' }));
    refused(() => resolveConfig({ environment: 'dev', provider: 'custom' }));
    refused(() =>
      resolveConfig({ environment: 'prod', provider: 'custom', port: new Fake__SDK_TITLE__Port() }),
    );
    refused(() => resolveConfig({ environment: 'dev', provider: 'fake', nope: 1 } as never));
    refused(() => resolveConfig({ environment: 'dev', provider: 'other' } as never));
  });
});
