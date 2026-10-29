import { FakeOtpChannel } from '../src/adapters/fake-channel';
import { MemoryCodeStore } from '../src/adapters/memory-store';
import { resolveConfig, type OtpOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/otp';
import type { CodeStore, OtpChannel } from '../src/types';
import { SharedStore } from './helpers/sharedStore';

const fieldsOf = (options: OtpOptions): string[] => {
  try {
    resolveConfig(options);
  } catch (error) {
    expect((error as { code: string }).code).toBe(ERROR_CODES.CONFIG_INVALID);
    return (error as { details: { fields: string[] } }).details.fields;
  }
  return [];
};

const shared: CodeStore = new SharedStore();
const real: OtpChannel = { name: 'real', send: () => Promise.resolve({ id: '1' }) };
const secret = 's'.repeat(32);

describe('resolveConfig', () => {
  it('applies defaults for the fake provider', () => {
    const config = resolveConfig({ environment: 'dev', provider: 'fake' });
    expect(config).toMatchObject({
      codeLength: 6,
      codeTtlSec: 300,
      resendAfterSec: 60,
      tokenTtlSec: 600,
      limits: { requests: 5, windowSec: 300, wrongCodes: 5, blockSec: 900 },
      secret: undefined,
      fixedCode: undefined,
      store: undefined,
      channel: undefined,
    });
    expect(config.now()).toBeInstanceOf(Date);
    expect(() => {
      config.logger.debug('x');
    }).not.toThrow();
  });

  it('derives the code length from a fixed code and keeps injected objects', () => {
    const store = new MemoryCodeStore();
    const channel = new FakeOtpChannel();
    const now = (): Date => new Date(0);
    const config = resolveConfig({
      environment: 'dev',
      provider: 'fake',
      fixedCode: '1234',
      limits: { requests: 2 },
      resendAfterSec: 0,
      store,
      channel,
      now,
    });
    expect(config.codeLength).toBe(4);
    expect(config.limits).toEqual({ requests: 2, windowSec: 300, wrongCodes: 5, blockSec: 900 });
    expect(config.store).toBe(store);
    expect(config.channel).toBe(channel);
    expect(config.now).toBe(now);
    expect(config.resendAfterSec).toBe(0);
  });

  it('names invalid fields only', () => {
    expect(fieldsOf({ environment: 'dev', provider: 'fake', codeLength: 3 })).toEqual([
      'codeLength',
    ]);
    expect(fieldsOf({ environment: 'dev', provider: 'fake', fixedCode: 'abc' })).toEqual([
      'fixedCode',
    ]);
    expect(
      fieldsOf({ environment: 'dev', provider: 'fake', fixedCode: '12345', codeLength: 6 }),
    ).toEqual(['fixedCode']);
    expect(fieldsOf({ environment: 'dev', provider: 'code' })).toEqual([
      'store',
      'channel',
      'secret',
    ]);
    expect(
      fieldsOf({
        environment: 'dev',
        provider: 'code',
        store: shared,
        channel: real,
        secret,
        fixedCode: '1',
      }),
    ).toEqual(['fixedCode']);
  });

  it('is strict in production', () => {
    const prod: OtpOptions = {
      environment: 'prod',
      provider: 'code',
      store: shared,
      channel: real,
      secret,
    };
    expect(fieldsOf(prod)).toEqual([]);
    expect(fieldsOf({ ...prod, provider: 'fake' })).toEqual(['provider']);
    expect(fieldsOf({ ...prod, store: new MemoryCodeStore() })).toEqual(['store']);
    expect(fieldsOf({ ...prod, channel: new FakeOtpChannel() })).toEqual(['channel']);
    expect(fieldsOf({ ...prod, secret: 'short' })).toEqual(['secret']);
    expect(fieldsOf({ ...prod, fixedCode: '123456' })).toEqual(['fixedCode', 'fixedCode']);
  });
});
