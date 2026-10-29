/**
 * Loop test (Rules.md §13): many request → verify → consume flows, concurrently, with wrong codes
 * and delivery failures injected; every token is spent exactly once and the store ends empty.
 */
import { createOtp } from '../../src/otp';
import { MemoryCodeStore } from '../../src/adapters/memory-store';
import { FakeOtpChannel } from '../../src/adapters/fake-channel';
import { ERROR_CODES } from '../../src/constants/otp';
import { isSdkError } from '../../src/errors';

const ITERATIONS = 200;
const CONCURRENCY = 25;
const WRONG_RATIO = 0.2;
const FAIL_RATIO = 0.1;
const HEAP_BUDGET_BYTES = 50 * 1024 * 1024;

const prng = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

const phoneOf = (index: number): string => `+96279${String(index).padStart(7, '0')}`;

describe('otp loop', () => {
  it(`runs ${String(ITERATIONS)} flows, ${String(CONCURRENCY)} at a time, spending every token once`, async () => {
    let now = 1_700_000_000_000;
    const random = prng(20_261_028);
    const store = new MemoryCodeStore(() => new Date(now));
    const channel = new FakeOtpChannel();
    const otp = createOtp({
      environment: 'dev',
      provider: 'fake',
      store,
      channel,
      now: () => new Date(now),
      resendAfterSec: 0,
      limits: { requests: 10, windowSec: 60, wrongCodes: 3, blockSec: 60 },
    });
    const outcomes = new Map<string, number>();
    const count = (name: string): void => {
      outcomes.set(name, (outcomes.get(name) ?? 0) + 1);
    };
    const heapBefore = process.memoryUsage().heapUsed;

    const flow = async (index: number): Promise<void> => {
      const phone = phoneOf(index);
      const input = { phone, purpose: 'LOGIN', language: index % 2 ? 'ar' : 'en' };
      if (random() < FAIL_RATIO) {
        const failing = new FakeOtpChannel();
        failing.failWith = new Error('down');
        const broken = createOtp({
          environment: 'dev',
          provider: 'fake',
          store,
          channel: failing,
          resendAfterSec: 0,
        });
        try {
          await broken.request(input);
        } catch (error) {
          if (!isSdkError(error) || error.code !== ERROR_CODES.DELIVERY_FAILED) throw error;
          count('DELIVERY_FAILED');
        }
      }
      const sent = await otp.request(input);
      if (sent.outcome !== 'SENT') throw new Error(`unexpected ${sent.outcome}`);
      const code = channel.lastCode(phone) ?? '';
      if (random() < WRONG_RATIO) {
        const wrong = await otp.verify({
          phone,
          purpose: 'LOGIN',
          code: code === '000000' ? '111111' : '000000',
        });
        if (wrong.outcome !== 'WRONG_CODE') throw new Error(`unexpected ${wrong.outcome}`);
        count('WRONG_CODE');
      }
      const verified = await otp.verify({ phone, purpose: 'LOGIN', code });
      if (verified.outcome !== 'VERIFIED') throw new Error(`unexpected ${verified.outcome}`);
      const consume = { otpToken: verified.otpToken, phone, purpose: 'LOGIN' };
      const results = await Promise.all([otp.consumeToken(consume), otp.consumeToken(consume)]);
      if (results.filter((r) => r.valid).length !== 1)
        throw new Error('token spent twice or never');
      count('VERIFIED');
    };

    const jobs = Array.from({ length: ITERATIONS }, (_, index) => () => flow(index));
    for (let start = 0; start < jobs.length; start += CONCURRENCY)
      await Promise.all(jobs.slice(start, start + CONCURRENCY).map((job) => job()));

    expect(outcomes.get('VERIFIED')).toBe(ITERATIONS);
    expect(outcomes.get('WRONG_CODE')).toBeGreaterThan(0);
    expect(outcomes.get('DELIVERY_FAILED')).toBeGreaterThan(0);
    now += 120_000; // past every window and block
    expect(store.prune()).toBe(0);
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(HEAP_BUDGET_BYTES);
    await otp.close();
  });
});
