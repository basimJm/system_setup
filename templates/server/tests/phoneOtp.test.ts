import { OtpDeliveryError, RedisCodeStore } from '../src/providers/otp';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { createApp } from '../src/app';
import { OTP_KEY_PREFIX, OTP_ROUTE_RATE_LIMIT } from '../src/constants/otp';
import { SETTING_DEFAULTS } from '../src/constants/settings';
import { createOtpGate, type OtpGate } from '../src/domain/otp/otpGate.service';
import { createPhoneOtpService } from '../src/domain/otp/phoneOtp.service';
import { FakeOtpProvider } from '../src/providers/otp';
import { createLogger } from '../src/utils/logger';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import { redisKey } from '../src/utils/redis/keys';
import { startTestRedis, type TestRedis } from './helpers/redis';

/** Phone OTP request + verify (docs/BUSINESS_DOMAIN.md §3.1a steps 2, 3 and 5). */
interface Body {
  success: boolean;
  message: string;
  data: {
    allowed?: boolean;
    otpLength?: number;
    resendAfterSeconds?: number;
    expiresInSeconds?: number;
    blockedUntil?: string;
    otpToken?: string;
  };
  error: { code: string; details: { field: string; code: string; message: string }[] };
}
const bodyOf = (res: { body: unknown }): Body => res.body as Body;

type App = ReturnType<typeof createApp>;

const logger = createLogger({ level: 'silent' });
const PHONE = '+991791234567';
const OTHER_PHONE = '+991781234567';
const NOW = new Date('2026-10-12T10:00:00.000Z');
const CODE_KEY = (purpose: string, phone = PHONE): string => `otp:code:${purpose}:${phone}`;

let testRedis: TestRedis;
let redis: Redis;
let values: Record<string, number>;
let provider: FakeOtpProvider;

const settings = {
  get: (key: string): Promise<never> =>
    Promise.resolve((values[key] ?? SETTING_DEFAULTS[key as never]) as never),
};
const makeGate = (): OtpGate =>
  createOtpGate({ redis, settings: settings as never, now: () => NOW });
const makeApp = (): App => {
  provider = new FakeOtpProvider({ store: new RedisCodeStore(redis) });
  const phoneOtp = createPhoneOtpService({
    gate: makeGate(),
    otp: provider,
    settings: settings as never,
  });
  return createApp({ logger, services: { phoneOtp } });
};
const post = (
  app: App,
  path: 'request' | 'verify',
  body: Record<string, unknown>,
  options: { namespace?: string; language?: string } = {},
): request.Test =>
  request(app)
    .post(`/${options.namespace ?? 'customer'}/v1/auth/otp/${path}`)
    .set('Accept-Language', options.language ?? 'ar')
    .send(body);
const sentCode = (phone = PHONE): string => provider.channel.lastCode(phone) ?? '';
const wrongFor = (code: string): string =>
  code.startsWith('0') ? `1${code.slice(1)}` : `0${code.slice(1)}`;

beforeAll(async () => {
  testRedis = await startTestRedis();
  redis = await connectRedis({ redis: { url: testRedis.url } }, logger);
});
afterAll(async () => {
  await disconnectRedis(redis);
  await testRedis.stop();
});
beforeEach(async () => {
  values = {};
  await redis.flushdb();
});

describe('POST /auth/otp/request', () => {
  it('sends a code in the request language and answers the decision', async () => {
    const app = makeApp();
    const res = await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' }, { language: 'en' });
    expect(res.status).toBe(200);
    expect(bodyOf(res)).toMatchObject({
      success: true,
      data: { allowed: true, otpLength: 6, resendAfterSeconds: 60, expiresInSeconds: 300 },
    });
    expect(bodyOf(res).data.blockedUntil).toBeUndefined();
    expect(bodyOf(res).data.otpToken).toBeUndefined();
    expect(provider.channel.sent).toHaveLength(1);
    expect(provider.channel.sent[0]).toMatchObject({ to: PHONE, language: 'en', purpose: 'LOGIN' });
    expect(sentCode()).toMatch(/^\d{6}$/);
    // Only the HMAC of the code is stored, under the domain key.
    const stored = await redis.get(CODE_KEY('LOGIN'));
    expect(stored).not.toBeNull();
    expect(stored).not.toContain(sentCode());
    expect(JSON.stringify(bodyOf(res))).not.toContain(sentCode());
  });

  it('hands the client IP (trust-proxy aware) to the provider, which decides whether to forward it', async () => {
    makeApp();
    const seen: unknown[] = [];
    const recording = {
      sendCode: (input: unknown, rules: never) => {
        seen.push(input);
        return provider.sendCode(input as never, rules);
      },
      verifyCode: provider.verifyCode,
      verify: provider.verify,
    } as unknown as FakeOtpProvider;
    const phoneOtp = createPhoneOtpService({
      gate: makeGate(),
      otp: recording,
      settings: settings as never,
    });
    const app = createApp({ logger, services: { phoneOtp }, trustProxyHops: 1 });
    await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' }).set(
      'X-Forwarded-For',
      '203.0.113.9',
    );
    expect(seen[0]).toMatchObject({ phone: PHONE, purpose: 'LOGIN', ip: '203.0.113.9' });
    // The channel decides whether to use it (vendors with per-IP limits).
    expect(provider.channel.sent[0]).toHaveProperty('ip', '203.0.113.9');
  });

  it('sends Arabic by default and reads otp.length / otp.codeTtlSec from settings', async () => {
    values['otp.length'] = 4;
    values['otp.codeTtlSec'] = 120;
    const app = makeApp();
    const res = await request(app)
      .post('/merchant/v1/auth/otp/request')
      .send({ phone: PHONE, purpose: 'REGISTER' });
    expect(bodyOf(res).data).toMatchObject({ otpLength: 4, expiresInSeconds: 120 });
    expect(provider.channel.sent[0]).toMatchObject({ language: 'ar', ttlSec: 120 });
    expect(sentCode()).toMatch(/^\d{4}$/);
    expect(await redis.pttl(CODE_KEY('REGISTER'))).toBeLessThanOrEqual(120_000);
  });

  it('sends nothing during the resend countdown (allowed false, expiresInSeconds 0)', async () => {
    const app = makeApp();
    await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
    const second = await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
    expect(second.status).toBe(200);
    expect(bodyOf(second).data).toMatchObject({ allowed: false, expiresInSeconds: 0 });
    expect(provider.channel.sent).toHaveLength(1);
  });

  it('shows the block as ISO time and sends nothing while blocked', async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i += 1) await makeGate().reportWrongAttempt(PHONE);
    const res = await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
    expect(res.status).toBe(200);
    expect(bodyOf(res).data.allowed).toBe(false);
    const until = Date.parse(bodyOf(res).data.blockedUntil as string);
    expect(until).toBeGreaterThan(NOW.getTime() + 899_000);
    expect(until).toBeLessThanOrEqual(NOW.getTime() + 900_000);
    expect(provider.channel.sent).toHaveLength(0);
  });

  it.each([
    ['ar', 'تعذر إرسال الرمز'],
    ['en', 'We could not deliver the code'],
  ])(
    'answers 422 OTP_DELIVERY_FAILED (%s) when the channel refuses the number; the request still counts',
    async (language, text) => {
      const app = makeApp();
      provider.channel.failWith = new OtpDeliveryError('not reachable');
      const res = await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' }, { language });
      expect(res.status).toBe(422);
      expect(bodyOf(res).error.code).toBe('OTP_DELIVERY_FAILED');
      expect(bodyOf(res).message).toContain(text);
      expect(await redis.get(redisKey(OTP_KEY_PREFIX.requests, PHONE))).toBe('1');
      expect(await redis.get(CODE_KEY('LOGIN'))).toBeNull();
    },
  );

  it.each(['ETIMEDOUT', 'vendor 500', 'auth failed'])(
    'answers 503 without vendor text when the channel fails (%s)',
    async (reason) => {
      const app = makeApp();
      provider.channel.failWith = Object.assign(new Error('provider says no'), { reason });
      const res = await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
      expect(res.status).toBe(503);
      expect(bodyOf(res).error.code).toBe('INTERNAL');
      expect(JSON.stringify(bodyOf(res))).not.toContain('provider says no');
    },
  );

  it.each([
    ['customer', 'CHANGE_PHONE', 200],
    ['merchant', 'CHANGE_PHONE', 400],
    ['merchant', 'REGISTER', 200],
    ['customer', 'BANK_DETAILS', 400],
  ])('%s purpose %s answers %i', async (namespace, purpose, status) => {
    const res = await post(makeApp(), 'request', { phone: PHONE, purpose }, { namespace });
    expect(res.status).toBe(status);
  });

  it.each([
    [{ phone: '0791234567', purpose: 'LOGIN' }, 'body.phone'],
    [{ phone: '+991791234567' }, 'body.purpose'],
    [{ phone: 'phone:key', purpose: 'LOGIN' }, 'body.phone'],
    [{ phone: PHONE, purpose: 'LOGIN', extra: 1 }, null],
  ])('validates %j', async (body, field) => {
    const res = await post(makeApp(), 'request', body);
    if (field === null) {
      expect(res.status).toBe(200);
      return;
    }
    expect(res.status).toBe(400);
    expect(bodyOf(res).error.code).toBe('VALIDATION_ERROR');
    expect(bodyOf(res).error.details.map((d) => d.field)).toContain(field);
  });
});

describe('POST /auth/otp/verify', () => {
  const tokenFor = async (app: App, purpose: string, namespace = 'customer'): Promise<string> => {
    await post(app, 'request', { phone: PHONE, purpose }, { namespace });
    const res = await post(
      app,
      'verify',
      { phone: PHONE, purpose, code: sentCode() },
      { namespace },
    );
    expect(res.status).toBe(200);
    return bodyOf(res).data.otpToken ?? '';
  };

  it('exchanges the right code for a single-use otpToken and resets the limits', async () => {
    const app = makeApp();
    await post(app, 'request', { phone: PHONE, purpose: 'REGISTER' });
    const res = await post(app, 'verify', { phone: PHONE, purpose: 'REGISTER', code: sentCode() });
    expect(res.status).toBe(200);
    expect(bodyOf(res).data.expiresInSeconds).toBe(600);
    const token = bodyOf(res).data.otpToken ?? '';
    expect(token.length).toBeGreaterThan(0);
    expect(await redis.get(CODE_KEY('REGISTER'))).toBeNull();
    expect(await redis.exists(redisKey(OTP_KEY_PREFIX.resend, PHONE))).toBe(0);
    expect(await redis.exists(redisKey(OTP_KEY_PREFIX.requests, PHONE))).toBe(0);
    const proof = { proof: token, expectedPhone: PHONE, purpose: 'REGISTER' } as const;
    await expect(provider.verify(proof)).resolves.toEqual({ outcome: 'VERIFIED', phone: PHONE });
    // Single use: `otp:used:{jti}` is set with the proof's remaining lifetime.
    await expect(provider.verify(proof)).resolves.toEqual({ outcome: 'INVALID_PROOF' });
    expect(await redis.keys('otp:used:*')).toHaveLength(1);
    // The code itself is gone too.
    const again = await post(app, 'verify', {
      phone: PHONE,
      purpose: 'REGISTER',
      code: sentCode(),
    });
    expect(again.status).toBe(401);
    expect(bodyOf(again).error.code).toBe('OTP_EXPIRED');
  });

  it('reads otp.proofTtlSec from settings', async () => {
    values['otp.proofTtlSec'] = 90;
    const app = makeApp();
    await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
    const res = await post(app, 'verify', { phone: PHONE, purpose: 'LOGIN', code: sentCode() });
    expect(bodyOf(res).data.expiresInSeconds).toBe(90);
  });

  it('a token is bound to its phone and purpose (mismatch does not use it up)', async () => {
    const app = makeApp();
    const token = await tokenFor(app, 'LOGIN');
    await expect(
      provider.verify({ proof: token, expectedPhone: OTHER_PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'PHONE_MISMATCH' });
    await expect(
      provider.verify({ proof: token, expectedPhone: PHONE, purpose: 'CHANGE_PHONE' }),
    ).resolves.toEqual({ outcome: 'PURPOSE_MISMATCH' });
    await expect(
      provider.verify({ proof: token, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'VERIFIED', phone: PHONE });
  });

  it('a token from another secret or a tampered token is invalid', async () => {
    const app = makeApp();
    const token = await tokenFor(app, 'LOGIN');
    const stranger = new FakeOtpProvider({ store: new RedisCodeStore(redis) });
    await expect(
      stranger.verify({ proof: token, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'INVALID_PROOF' });
    await expect(
      provider.verify({ proof: `${token}x`, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'INVALID_PROOF' });
  });

  it('a wrong code is OTP_INVALID with the attempts left; the 5th blocks (429)', async () => {
    const app = makeApp();
    await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
    const wrong = { phone: PHONE, purpose: 'LOGIN', code: wrongFor(sentCode()) };
    const first = await post(app, 'verify', wrong, { language: 'en' });
    expect(first.status).toBe(401);
    expect(bodyOf(first).error.code).toBe('OTP_INVALID');
    expect(bodyOf(first).error.details[0]).toEqual({
      field: 'body.code',
      code: 'OTP_INVALID',
      message: 'The verification code is incorrect. Attempts left: 4.',
    });
    const arabic = await post(app, 'verify', wrong);
    expect(bodyOf(arabic).error.details[0]?.message).toBe(
      'رمز التحقق غير صحيح. المحاولات المتبقية: 3.',
    );
    for (let i = 0; i < 2; i += 1) {
      expect((await post(app, 'verify', wrong)).status).toBe(401);
    }
    const fifth = await post(app, 'verify', wrong);
    expect(fifth.status).toBe(429);
    expect(bodyOf(fifth).error.code).toBe('OTP_BLOCKED');
    // Blocked: even the right code is refused before it is checked, and stays unused.
    const right = await post(app, 'verify', { ...wrong, code: sentCode() });
    expect(right.status).toBe(429);
    expect(bodyOf(right).error.code).toBe('OTP_BLOCKED');
    expect(await redis.get(CODE_KEY('LOGIN'))).not.toBeNull();
  });

  it('no code, another purpose, another phone or an expired code is OTP_EXPIRED', async () => {
    const app = makeApp();
    const none = await post(app, 'verify', { phone: PHONE, purpose: 'LOGIN', code: '123456' });
    expect(none.status).toBe(401);
    expect(bodyOf(none).error.code).toBe('OTP_EXPIRED');
    await post(app, 'request', { phone: PHONE, purpose: 'LOGIN' });
    const otherPurpose = await post(app, 'verify', {
      phone: PHONE,
      purpose: 'REGISTER',
      code: sentCode(),
    });
    expect(bodyOf(otherPurpose).error.code).toBe('OTP_EXPIRED');
    const otherPhone = await post(app, 'verify', {
      phone: OTHER_PHONE,
      purpose: 'LOGIN',
      code: sentCode(),
    });
    expect(bodyOf(otherPhone).error.code).toBe('OTP_EXPIRED');
    await redis.del(CODE_KEY('LOGIN'));
    const expired = await post(app, 'verify', { phone: PHONE, purpose: 'LOGIN', code: sentCode() });
    expect(bodyOf(expired).error.code).toBe('OTP_EXPIRED');
    // Missing or expired codes are not wrong attempts.
    expect(await redis.get(redisKey(OTP_KEY_PREFIX.wrong, PHONE))).toBeNull();
  });

  it('a merchant REGISTER code verifies for that purpose only', async () => {
    const app = makeApp();
    const token = await tokenFor(app, 'REGISTER', 'merchant');
    await expect(
      provider.verify({ proof: token, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'PURPOSE_MISMATCH' });
    await expect(
      provider.verify({ proof: token, expectedPhone: PHONE, purpose: 'REGISTER' }),
    ).resolves.toMatchObject({ outcome: 'VERIFIED' });
  });

  it.each([
    [{ phone: PHONE, purpose: 'LOGIN' }, 'body.code'],
    [{ phone: PHONE, purpose: 'LOGIN', code: '12a456' }, 'body.code'],
    [{ phone: PHONE, purpose: 'LOGIN', code: '123' }, 'body.code'],
    [{ phone: PHONE, purpose: 'LOGIN', code: '12345678901' }, 'body.code'],
    [{ phone: PHONE, purpose: 'LOGIN', code: 123456 }, 'body.code'],
    [{ phone: PHONE, purpose: 'UNKNOWN_PURPOSE', code: '123456' }, 'body.purpose'],
    [{ phone: '0791234567', purpose: 'LOGIN', code: '123456' }, 'body.phone'],
  ])('validates %j', async (body, field) => {
    const res = await post(makeApp(), 'verify', body);
    expect(res.status).toBe(400);
    expect(bodyOf(res).error.details.map((d) => d.field)).toContain(field);
  });

  it('has no wrong-attempt route any more (the server counts wrong codes itself)', async () => {
    for (const namespace of ['customer', 'merchant']) {
      const res = await request(makeApp())
        .post(`/${namespace}/v1/auth/otp/wrong-attempt`)
        .send({ phone: PHONE });
      expect(res.status).toBe(404);
    }
  });

  it('limits each IP and answers RATE_LIMITED in the requested language', async () => {
    const app = makeApp();
    for (let i = 0; i < OTP_ROUTE_RATE_LIMIT.max; i += 1) {
      const res = await post(app, 'verify', {
        phone: `+9917912${String(10000 + i)}`,
        purpose: 'LOGIN',
        code: '123456',
      });
      expect(res.status).toBe(401);
    }
    const limited = await post(
      app,
      'verify',
      { phone: PHONE, purpose: 'LOGIN', code: '123456' },
      { language: 'en' },
    );
    expect(limited.status).toBe(429);
    expect(bodyOf(limited).error.code).toBe('RATE_LIMITED');
  });

  it('answers 503, not 404, when no Redis-backed OTP service is configured', async () => {
    for (const path of ['request', 'verify'] as const) {
      const res = await post(createApp({ logger }), path, {
        phone: PHONE,
        purpose: 'LOGIN',
        code: '123456',
      });
      expect(res.status).toBe(503);
      expect(bodyOf(res).success).toBe(false);
    }
  });
});
