import { FakeOtpChannel } from '../src/adapters/fake-channel';
import { MemoryCodeStore } from '../src/adapters/memory-store';
import { ERROR_CODES } from '../src/constants/otp';
import { createOtp, type Otp } from '../src/otp';
import { OtpService, randomDigits } from '../src/service';
import { resolveConfig } from '../src/config/options';
import { SdkError, type CodeStore, type Logger } from '../src';

const PHONE = '+962791234567';
const OTHER = '+962790000000';
const login = { phone: PHONE, purpose: 'LOGIN', language: 'ar' };

interface Harness {
  otp: Otp;
  channel: FakeOtpChannel;
  store: MemoryCodeStore;
  tick: (ms: number) => void;
  logs: unknown[][];
}

const harness = (overrides: Record<string, unknown> = {}): Harness => {
  let now = 1_700_000_000_000;
  const logs: unknown[][] = [];
  const logger: Logger = {
    debug: (...a) => logs.push(['debug', ...a]),
    info: (...a) => logs.push(['info', ...a]),
    warn: (...a) => logs.push(['warn', ...a]),
    error: (...a) => logs.push(['error', ...a]),
  };
  const store = new MemoryCodeStore(() => new Date(now));
  const channel = new FakeOtpChannel();
  const otp = createOtp({
    environment: 'dev',
    provider: 'fake',
    store,
    channel,
    logger,
    now: () => new Date(now),
    limits: { requests: 3, windowSec: 60, wrongCodes: 2, blockSec: 120 },
    ...overrides,
  });
  return {
    otp,
    channel,
    store,
    logs,
    tick: (ms) => {
      now += ms;
    },
  };
};

const codeOf = (h: Harness): string => h.channel.lastCode(PHONE) ?? 'missing';

describe('OtpService happy path', () => {
  it('requests, verifies and consumes once', async () => {
    const h = harness();
    const sent = await h.otp.request(login);
    expect(sent).toEqual({
      outcome: 'SENT',
      otpLength: 6,
      resendAfterSeconds: 60,
      expiresInSeconds: 300,
      deliveryId: 'fake-1',
    });
    expect(h.channel.sent[0]).toMatchObject({
      to: PHONE,
      language: 'ar',
      purpose: 'LOGIN',
      ttlSec: 300,
    });
    const code = codeOf(h);
    expect(code).toMatch(/^\d{6}$/);
    const verified = await h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code });
    expect(verified).toMatchObject({ outcome: 'VERIFIED', expiresInSeconds: 600 });
    if (verified.outcome !== 'VERIFIED') throw new Error('unreachable');
    expect(verified.otpToken).toMatch(/^[0-9a-f]{64}$/);
    // the code is spent
    await expect(h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code })).resolves.toEqual({
      outcome: 'EXPIRED',
    });
    const consume = { otpToken: verified.otpToken, phone: PHONE, purpose: 'LOGIN' };
    await expect(h.otp.consumeToken({ ...consume, purpose: 'REGISTER' })).resolves.toEqual({
      valid: false,
      reason: 'MISMATCH',
    });
    await expect(h.otp.consumeToken(consume)).resolves.toEqual({
      valid: false,
      reason: 'UNKNOWN_TOKEN',
    });
    expect(h.otp.getConfig()).toEqual({ otpLength: 6, resendAfterSeconds: 60 });
    await h.otp.close();
  });

  it('consumes a valid token exactly once and refuses expired ones', async () => {
    const h = harness({ resendAfterSec: 0 });
    await h.otp.request(login);
    const verified = await h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: codeOf(h) });
    if (verified.outcome !== 'VERIFIED') throw new Error('unreachable');
    const consume = { otpToken: verified.otpToken, phone: PHONE, purpose: 'LOGIN' };
    const [a, b] = await Promise.all([h.otp.consumeToken(consume), h.otp.consumeToken(consume)]);
    expect([a, b].filter((r) => r.valid)).toHaveLength(1);
    await h.otp.request(login);
    const again = await h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: codeOf(h) });
    if (again.outcome !== 'VERIFIED') throw new Error('unreachable');
    h.tick(600_001);
    await expect(h.otp.consumeToken({ ...consume, otpToken: again.otpToken })).resolves.toEqual({
      valid: false,
      reason: 'UNKNOWN_TOKEN',
    });
  });

  it('uses the fixed code and a deterministic generator when given', async () => {
    const h = harness({ fixedCode: '1234' });
    await h.otp.request(login);
    expect(codeOf(h)).toBe('1234');
    const service = new OtpService(resolveConfig({ environment: 'dev', provider: 'fake' }), {
      store: h.store,
      channel: h.channel,
      secret: 'x',
      generateCode: (length) => '9'.repeat(length),
    });
    await service.request({ ...login, phone: OTHER });
    expect(h.channel.lastCode(OTHER)).toBe('999999');
    expect(randomDigits(8)).toMatch(/^\d{8}$/);
  });
});

describe('OtpService limits', () => {
  it('enforces the resend cooldown with the remaining time', async () => {
    const h = harness();
    await h.otp.request(login);
    h.tick(10_000);
    await expect(h.otp.request(login)).resolves.toEqual({
      outcome: 'RATE_LIMITED',
      retryAfterSeconds: 50,
    });
    h.tick(50_000);
    await expect(h.otp.request(login)).resolves.toMatchObject({ outcome: 'SENT' });
    // another purpose has its own cooldown
    await expect(h.otp.request({ ...login, purpose: 'REGISTER' })).resolves.toMatchObject({
      outcome: 'SENT',
    });
  });

  it('blocks after too many requests in the window and unblocks after blockSec or an admin reset', async () => {
    const h = harness({ resendAfterSec: 0 });
    for (let i = 0; i < 3; i += 1)
      await expect(h.otp.request(login)).resolves.toMatchObject({ outcome: 'SENT' });
    await expect(h.otp.request(login)).resolves.toEqual({
      outcome: 'BLOCKED',
      retryAfterSeconds: 120,
    });
    expect(h.logs).toContainEqual([
      'warn',
      'phone blocked',
      { phone: '+9627******67', purpose: 'LOGIN' },
    ]);
    await expect(h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: '000000' })).resolves.toEqual(
      {
        outcome: 'BLOCKED',
        retryAfterSeconds: 120,
      },
    );
    h.tick(30_000);
    await expect(h.otp.request(login)).resolves.toEqual({
      outcome: 'BLOCKED',
      retryAfterSeconds: 90,
    });
    await h.otp.resetLimits(PHONE);
    await expect(h.otp.request(login)).resolves.toMatchObject({ outcome: 'SENT' });
    h.tick(120_001);
    await expect(h.otp.request(login)).resolves.toMatchObject({ outcome: 'SENT' });
  });

  it('counts wrong codes, blocks at the limit and deletes the pending code', async () => {
    const h = harness({ resendAfterSec: 0 });
    await h.otp.request(login);
    const wrong = { phone: PHONE, purpose: 'LOGIN', code: '000000' };
    await expect(h.otp.verify(wrong)).resolves.toEqual({
      outcome: 'WRONG_CODE',
      attemptsRemaining: 1,
    });
    await expect(h.otp.verify(wrong)).resolves.toEqual({
      outcome: 'BLOCKED',
      retryAfterSeconds: 120,
    });
    h.tick(120_001);
    await expect(h.otp.verify({ ...wrong, code: codeOf(h) })).resolves.toEqual({
      outcome: 'EXPIRED',
    });
  });

  it('expires codes and resets the wrong-code counter on success', async () => {
    const h = harness({ resendAfterSec: 0 });
    await h.otp.request(login);
    h.tick(300_001);
    await expect(
      h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: codeOf(h) }),
    ).resolves.toEqual({
      outcome: 'EXPIRED',
    });
    await h.otp.request(login);
    await h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: '000000' });
    await expect(
      h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: codeOf(h) }),
    ).resolves.toMatchObject({
      outcome: 'VERIFIED',
    });
    await h.otp.request(login);
    await expect(h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: '000000' })).resolves.toEqual(
      {
        outcome: 'WRONG_CODE',
        attemptsRemaining: 1,
      },
    );
  });

  it('lets only one concurrent verify win', async () => {
    const h = harness({ resendAfterSec: 0 });
    await h.otp.request(login);
    const code = codeOf(h);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code })),
    );
    expect(results.filter((r) => r.outcome === 'VERIFIED')).toHaveLength(1);
    expect(results.filter((r) => r.outcome === 'EXPIRED')).toHaveLength(4);
  });
});

describe('OtpService failures', () => {
  it('maps delivery failures, removes the code and lifts the cooldown', async () => {
    const h = harness();
    h.channel.failWith = new Error('vendor down');
    await expect(h.otp.request(login)).rejects.toMatchObject({
      code: ERROR_CODES.DELIVERY_FAILED,
      retryable: true,
      details: { channel: 'fake' },
    });
    expect(h.logs).toContainEqual([
      'error',
      'code delivery failed',
      { channel: 'fake', phone: '+9627******67' },
    ]);
    h.channel.failWith = undefined;
    await expect(h.otp.request(login)).resolves.toMatchObject({ outcome: 'SENT' });
    expect(h.store.prune()).toBe(3); // code, cooldown, request counter
  });

  it('keeps SDK errors thrown by a channel as they are', async () => {
    const h = harness();
    h.channel.failWith = new SdkError('X_CUSTOM', 'custom');
    await expect(h.otp.request(login)).rejects.toMatchObject({ code: 'X_CUSTOM' });
  });

  it('wraps store failures as retryable STORE_FAILED', async () => {
    const broken: CodeStore = {
      scope: 'local',
      set: () => Promise.reject(new Error('redis gone')),
      get: () => Promise.reject(new Error('redis gone')),
      delete: () => Promise.reject(new Error('redis gone')),
      setIfAbsent: () => Promise.reject(new Error('redis gone')),
      increment: () => Promise.reject(new Error('redis gone')),
      ttlMs: () => Promise.reject(new SdkError('X_STORE', 'typed')),
    };
    const otp = createOtp({ environment: 'dev', provider: 'fake', store: broken });
    await expect(otp.request(login)).rejects.toMatchObject({ code: 'X_STORE' });
    await expect(otp.resetLimits(PHONE)).rejects.toMatchObject({
      code: ERROR_CODES.STORE_FAILED,
      retryable: true,
    });
    await expect(
      otp.consumeToken({ otpToken: 'a'.repeat(64), phone: PHONE, purpose: 'LOGIN' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.STORE_FAILED,
    });
    await otp.close();
  });

  it('validates every input', async () => {
    const h = harness();
    await expect(h.otp.request({ ...login, phone: '079' })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(
      h.otp.verify({ phone: PHONE, purpose: 'LOGIN', code: '12' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(
      h.otp.consumeToken({ otpToken: 'nope', phone: PHONE, purpose: 'LOGIN' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(h.otp.resetLimits('x')).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });
});
