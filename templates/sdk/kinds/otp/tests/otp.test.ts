import { FakeOtpChannel } from '../src/adapters/fake-channel';
import { MemoryCodeStore } from '../src/adapters/memory-store';
import { ERROR_CODES, SDK_NAME, createOtp } from '../src';
import { SharedStore } from './helpers/sharedStore';

describe('createOtp', () => {
  it('builds the fake provider with its own store and channel', () => {
    const otp = createOtp({ environment: 'dev', provider: 'fake' });
    expect(otp.store).toBeInstanceOf(MemoryCodeStore);
    expect(otp.channel).toBeInstanceOf(FakeOtpChannel);
  });

  it('builds the code provider on the injected store and channel', () => {
    const store = new SharedStore();
    const channel = { name: 'wa', send: () => Promise.resolve({ id: '1' }) };
    const otp = createOtp({
      environment: 'dev',
      provider: 'code',
      store,
      channel,
      secret: 'k'.repeat(32),
    });
    expect(otp.store).toBe(store);
    expect(otp.channel).toBe(channel);
  });

  it('refuses the fake provider in production and exposes the surface', () => {
    expect(() => createOtp({ environment: 'prod', provider: 'fake' })).toThrow(
      expect.objectContaining({ code: ERROR_CODES.CONFIG_INVALID }) as Error,
    );
    expect(SDK_NAME).toBe('__SYSTEM_SLUG__-__SDK_KIND__');
    expect(ERROR_CODES.DELIVERY_FAILED).toBe('__SDK_PREFIX___DELIVERY_FAILED');
  });
});
