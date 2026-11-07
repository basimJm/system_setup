import type { Redis } from 'ioredis';
import { OTP_KEY_PREFIX } from '../src/constants/otp';
import { SETTING_DEFAULTS } from '../src/constants/settings';
import { createOtpGate, type OtpGate } from '../src/domain/otp/otpGate.service';
import { RateLimitError } from '../src/utils/errors';
import { createLogger } from '../src/utils/logger';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import { redisKey } from '../src/utils/redis/keys';
import { startTestRedis, type TestRedis } from './helpers/redis';

const logger = createLogger({ level: 'silent' });
const PHONE = '+991791234567';
const OTHER_PHONE = '+991781234567';
const NOW = new Date('2026-10-12T10:00:00.000Z');

let testRedis: TestRedis;
let redis: Redis;
let values: Record<string, number>;

const settings = {
  get: (key: string): Promise<never> =>
    Promise.resolve((values[key] ?? SETTING_DEFAULTS[key as never]) as never),
};
const makeGate = (): OtpGate =>
  createOtpGate({ redis, settings: settings as never, now: () => NOW });
/** Skips the resend countdown so tests can count requests against the 5-per-window limit. */
const endCooldown = async (phone = PHONE): Promise<void> => {
  await redis.del(redisKey(OTP_KEY_PREFIX.resend, phone));
};

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

describe('otp gate: request', () => {
  it('allows the first request and returns otpLength and resend timing from settings', async () => {
    await expect(makeGate().request(PHONE)).resolves.toEqual({
      allowed: true,
      otpLength: 6,
      resendAfterSeconds: 60,
    });
  });

  it('denies a request during the resend countdown without counting it', async () => {
    const gate = makeGate();
    await gate.request(PHONE);
    const second = await gate.request(PHONE);
    expect(second.allowed).toBe(false);
    expect(second.resendAfterSeconds).toBeGreaterThan(0);
    expect(second.resendAfterSeconds).toBeLessThanOrEqual(60);
    expect(second.blockedUntil).toBeUndefined();
    expect(await redis.get(redisKey(OTP_KEY_PREFIX.requests, PHONE))).toBe('1');
  });

  it('blocks for 15 minutes after the 5th request: the 5th is allowed, the 6th denied', async () => {
    const gate = makeGate();
    for (let i = 0; i < 5; i += 1) {
      await endCooldown();
      expect((await gate.request(PHONE)).allowed).toBe(true);
    }
    await endCooldown();
    const sixth = await gate.request(PHONE);
    expect(sixth).toMatchObject({ allowed: false, resendAfterSeconds: 0, otpLength: 6 });
    expect(sixth.blockedUntil?.getTime()).toBeGreaterThan(NOW.getTime() + 899_000);
    expect(sixth.blockedUntil?.getTime()).toBeLessThanOrEqual(NOW.getTime() + 900_000);
  });

  it('keeps phones independent', async () => {
    const gate = makeGate();
    await gate.request(PHONE);
    expect((await gate.request(OTHER_PHONE)).allowed).toBe(true);
  });

  it('reads limits from settings on every call', async () => {
    const gate = makeGate();
    values = { 'otp.length': 8, 'otp.maxRequests': 2, 'otp.resendAfterSec': 30 };
    const first = await gate.request(PHONE);
    expect(first).toMatchObject({ allowed: true, otpLength: 8, resendAfterSeconds: 30 });
    await endCooldown();
    expect((await gate.request(PHONE)).allowed).toBe(true);
    await endCooldown();
    expect((await gate.request(PHONE)).blockedUntil).toBeDefined();
  });

  it('lets exactly one of many simultaneous requests through', async () => {
    const gate = makeGate();
    const results = await Promise.all(Array.from({ length: 10 }, () => gate.request(PHONE)));
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  });
});

describe('otp gate: wrong attempts', () => {
  it('counts down the attempts and blocks on the 5th wrong code', async () => {
    const gate = makeGate();
    const remaining: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result = await gate.reportWrongAttempt(PHONE);
      expect(result.blocked).toBe(false);
      remaining.push(result.attemptsRemaining);
    }
    expect(remaining).toEqual([4, 3, 2, 1]);
    const fifth = await gate.reportWrongAttempt(PHONE);
    expect(fifth).toMatchObject({ blocked: true, attemptsRemaining: 0 });
    expect(fifth.blockedUntil?.getTime()).toBe(NOW.getTime() + 900_000);
  });

  it('shares the block with requests', async () => {
    const gate = makeGate();
    for (let i = 0; i < 5; i += 1) await gate.reportWrongAttempt(PHONE);
    const decision = await gate.request(PHONE);
    expect(decision.allowed).toBe(false);
    expect(decision.blockedUntil).toBeDefined();
  });

  it('keeps reporting blocked, not a fresh count, while blocked', async () => {
    const gate = makeGate();
    for (let i = 0; i < 5; i += 1) await gate.reportWrongAttempt(PHONE);
    expect(await gate.reportWrongAttempt(PHONE)).toMatchObject({ blocked: true });
  });
});

describe('otp gate: assertNotBlocked and reset', () => {
  it('passes when not blocked and throws OTP_BLOCKED (429) when blocked', async () => {
    const gate = makeGate();
    await expect(gate.assertNotBlocked(PHONE)).resolves.toBeUndefined();
    for (let i = 0; i < 5; i += 1) await gate.reportWrongAttempt(PHONE);
    const failure = await gate.assertNotBlocked(PHONE).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(RateLimitError);
    expect(failure).toMatchObject({ code: 'OTP_BLOCKED', httpStatus: 429 });
    await expect(gate.assertNotBlocked(OTHER_PHONE)).resolves.toBeUndefined();
  });

  it('reset clears counters, block and resend countdown', async () => {
    const gate = makeGate();
    for (let i = 0; i < 5; i += 1) await gate.reportWrongAttempt(PHONE);
    await gate.reset(PHONE);
    await expect(gate.assertNotBlocked(PHONE)).resolves.toBeUndefined();
    expect((await gate.request(PHONE)).allowed).toBe(true);
    await gate.reset(PHONE);
    expect((await gate.request(PHONE)).allowed).toBe(true);
    expect((await gate.reportWrongAttempt(PHONE)).attemptsRemaining).toBe(4);
  });
});
