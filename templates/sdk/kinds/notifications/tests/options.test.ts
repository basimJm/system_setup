import { FakeEmailSender, FakePushSender } from '../src/adapters/fake';
import { MemoryIdempotencyStore } from '../src/adapters/memory-idempotency';
import { resolveConfig, type NotificationsOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/notifications';
import type { EmailSender, PushSender } from '../src/types';
import { SharedIdempotencyStore } from './helpers/shared';

const fieldsOf = (options: NotificationsOptions): string[] => {
  try {
    resolveConfig(options);
  } catch (error) {
    expect((error as { code: string }).code).toBe(ERROR_CODES.CONFIG_INVALID);
    return (error as { details: { fields: string[] } }).details.fields;
  }
  return [];
};

const push: PushSender = { name: 'fcm', send: () => Promise.resolve([]) };
const email: EmailSender = {
  name: 'smtp',
  send: () => Promise.resolve({ id: '1', status: 'SENT' }),
};

describe('resolveConfig', () => {
  it('applies defaults and keeps injected objects', () => {
    const store = new MemoryIdempotencyStore();
    const config = resolveConfig({
      environment: 'dev',
      push: { provider: 'fake' },
      idempotencyStore: store,
    });
    expect(config).toMatchObject({
      push: 'fake',
      email: undefined,
      maxTokensPerSend: 500,
      idempotencyTtlSec: 86_400,
      timeoutMs: 10_000,
      retry: { maxAttempts: 3 },
      pushSender: undefined,
      idempotencyStore: store,
    });
    expect(config.now()).toBeInstanceOf(Date);
    expect(() => {
      config.logger.info('x');
    }).not.toThrow();
    const custom = resolveConfig({
      environment: 'dev',
      email: { provider: 'custom' },
      emailSender: email,
      maxTokensPerSend: 10,
      idempotencyTtlSec: 5,
      timeoutMs: 1,
      retry: { maxAttempts: 1 },
    });
    expect(custom).toMatchObject({
      email: 'custom',
      emailSender: email,
      maxTokensPerSend: 10,
      timeoutMs: 1,
    });
  });

  it('names invalid fields only', () => {
    expect(fieldsOf({ environment: 'dev' })).toEqual(['push']);
    expect(fieldsOf({ environment: 'dev', push: { provider: 'custom' } })).toEqual(['pushSender']);
    expect(fieldsOf({ environment: 'dev', email: { provider: 'custom' } })).toEqual([
      'emailSender',
    ]);
    expect(fieldsOf({ environment: 'dev', push: { provider: 'apns' as 'fake' } })).toEqual([
      'push.provider',
    ]);
    expect(
      fieldsOf({ environment: 'dev', push: { provider: 'fake' }, maxTokensPerSend: 501 }),
    ).toEqual(['maxTokensPerSend']);
  });

  it('is strict in production', () => {
    const prod: NotificationsOptions = {
      environment: 'prod',
      push: { provider: 'custom' },
      email: { provider: 'custom' },
      pushSender: push,
      emailSender: email,
      idempotencyStore: new SharedIdempotencyStore(),
    };
    expect(fieldsOf(prod)).toEqual([]);
    expect(fieldsOf({ ...prod, push: { provider: 'fake' } })).toEqual(['push.provider']);
    expect(fieldsOf({ ...prod, pushSender: new FakePushSender() })).toEqual(['pushSender']);
    expect(fieldsOf({ ...prod, emailSender: new FakeEmailSender() })).toEqual(['emailSender']);
    expect(fieldsOf({ ...prod, idempotencyStore: new MemoryIdempotencyStore() })).toEqual([
      'idempotencyStore',
    ]);
  });
});
