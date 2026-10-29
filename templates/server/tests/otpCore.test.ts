import { ExternalServiceError } from '../src/utils/errors';
import {
  FakeOtpChannel,
  FakeOtpProvider,
  MemoryCodeStore,
  OtpDeliveryError,
  createCodeOtp,
  createProofs,
} from '../src/providers/otp';

const PHONE = '+962791234567';
const RULES = { codeLength: 6, codeTtlSec: 300, proofTtlSec: 600 };
const SECRET_A = 'a'.repeat(40);
const SECRET_B = 'b'.repeat(40);
let clock = new Date('2026-10-12T10:00:00.000Z');
const now = (): Date => clock;

const build = (
  fixedCode?: string,
): { flow: ReturnType<typeof createCodeOtp>; channel: FakeOtpChannel; store: MemoryCodeStore } => {
  const channel = new FakeOtpChannel();
  const store = new MemoryCodeStore(() => clock.getTime());
  const flow = createCodeOtp({
    isProduction: false,
    channel,
    store,
    codeSecret: SECRET_A,
    proofSecret: SECRET_B,
    now,
    ...(fixedCode === undefined ? {} : { fixedCode }),
  });
  return { flow, channel, store };
};

beforeEach(() => {
  clock = new Date('2026-10-12T10:00:00.000Z');
});

describe('code flow', () => {
  it('sends a code of the configured length, stores only its hash, verifies it once and issues a proof', async () => {
    const { flow, channel, store } = build();
    const sent = await flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'en' }, RULES);
    expect(sent.expiresInSeconds).toBe(300);
    const code = channel.lastCode(PHONE) ?? '';
    expect(code).toMatch(/^\d{6}$/);
    expect(await store.get(`otp:code:LOGIN:${PHONE}`)).not.toContain(code);
    const wrong = await flow.verifyCode(
      { phone: PHONE, purpose: 'LOGIN', code: '000000' === code ? '111111' : '000000' },
      RULES,
    );
    expect(wrong).toEqual({ outcome: 'INVALID_CODE' });
    const right = await flow.verifyCode({ phone: PHONE, purpose: 'LOGIN', code }, RULES);
    expect(right.outcome).toBe('VERIFIED');
    if (right.outcome !== 'VERIFIED') throw new Error('expected a proof');
    expect(right.expiresInSeconds).toBe(600);
    expect(await flow.verifyCode({ phone: PHONE, purpose: 'LOGIN', code }, RULES)).toEqual({
      outcome: 'EXPIRED',
    });
    await expect(
      flow.verify({ proof: right.otpToken, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'VERIFIED', phone: PHONE });
    await expect(
      flow.verify({ proof: right.otpToken, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'INVALID_PROOF' });
  });

  it('expires codes after their TTL and a resend replaces the earlier code', async () => {
    const { flow, channel } = build();
    await flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'ar' }, RULES);
    const first = channel.lastCode(PHONE) ?? '';
    await flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'ar' }, RULES);
    const second = channel.lastCode(PHONE) ?? '';
    expect(await flow.verifyCode({ phone: PHONE, purpose: 'LOGIN', code: first }, RULES)).toEqual(
      first === second
        ? { outcome: 'VERIFIED', otpToken: expect.any(String) as string, expiresInSeconds: 600 }
        : { outcome: 'INVALID_CODE' },
    );
    await flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'ar' }, RULES);
    clock = new Date(clock.getTime() + 301_000);
    expect(
      await flow.verifyCode(
        { phone: PHONE, purpose: 'LOGIN', code: channel.lastCode(PHONE) ?? '' },
        RULES,
      ),
    ).toEqual({ outcome: 'EXPIRED' });
  });

  it('uses the fixed code in development, padded to the configured length', async () => {
    const { flow, channel } = build('1234');
    await flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'en' }, RULES);
    expect(channel.lastCode(PHONE)).toBe('001234');
  });

  it('maps a refused recipient to 422 OTP_DELIVERY_FAILED and an outage to a 503, dropping the stored code', async () => {
    const { flow, channel, store } = build();
    channel.failWith = new OtpDeliveryError();
    await expect(
      flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'en' }, RULES),
    ).rejects.toMatchObject({ code: 'OTP_DELIVERY_FAILED', httpStatus: 422 });
    channel.failWith = new Error('vendor down');
    await expect(
      flow.sendCode({ phone: PHONE, purpose: 'LOGIN', language: 'en' }, RULES),
    ).rejects.toBeInstanceOf(ExternalServiceError);
    expect(store.size()).toBe(0);
  });

  it('refuses weak or equal secrets, and fakes or local stores in production', () => {
    const channel = new FakeOtpChannel();
    const store = new MemoryCodeStore();
    expect(() =>
      createCodeOtp({
        isProduction: false,
        channel,
        store,
        codeSecret: 'short',
        proofSecret: SECRET_B,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCodeOtp({
        isProduction: false,
        channel,
        store,
        codeSecret: SECRET_A,
        proofSecret: SECRET_A,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCodeOtp({
        isProduction: true,
        channel,
        store,
        codeSecret: SECRET_A,
        proofSecret: SECRET_B,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCodeOtp({
        isProduction: false,
        channel,
        store,
        codeSecret: SECRET_A,
        proofSecret: SECRET_B,
        fixedCode: 'abc',
      }),
    ).toThrow(RangeError);
  });
});

describe('proofs', () => {
  const store = new MemoryCodeStore(() => clock.getTime());
  const proofs = createProofs({ secret: SECRET_B, store, ttlSec: 600, now });

  it('checks phone, purpose, expiry, signature and single use', async () => {
    const { otpToken } = proofs.issue({ phone: PHONE, purpose: 'REGISTER' });
    await expect(
      proofs.verify({ proof: otpToken, expectedPhone: '+962781234567', purpose: 'REGISTER' }),
    ).resolves.toEqual({ outcome: 'PHONE_MISMATCH' });
    await expect(
      proofs.verify({ proof: otpToken, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'PURPOSE_MISMATCH' });
    await expect(
      proofs.verify({ proof: `${otpToken}x`, expectedPhone: PHONE, purpose: 'REGISTER' }),
    ).resolves.toEqual({ outcome: 'INVALID_PROOF' });
    await expect(
      proofs.verify({ proof: '', expectedPhone: PHONE, purpose: 'REGISTER' }),
    ).resolves.toEqual({ outcome: 'INVALID_PROOF' });
    const other = createProofs({ secret: SECRET_A, store, ttlSec: 600, now });
    await expect(
      other.verify({ proof: otpToken, expectedPhone: PHONE, purpose: 'REGISTER' }),
    ).resolves.toEqual({ outcome: 'INVALID_PROOF' });
    clock = new Date(clock.getTime() + 601_000);
    await expect(
      proofs.verify({ proof: otpToken, expectedPhone: PHONE, purpose: 'REGISTER' }),
    ).resolves.toEqual({ outcome: 'EXPIRED' });
  });

  it('FakeOtpProvider issues test tokens that verify, including back-dated ones', async () => {
    const fake = new FakeOtpProvider();
    const token = fake.issueToken(PHONE, 'LOGIN');
    await expect(
      fake.verify({ proof: token, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'VERIFIED', phone: PHONE });
    const old = fake.issueToken(PHONE, 'LOGIN', { issuedAt: new Date('2020-01-01T00:00:00Z') });
    await expect(
      fake.verify({ proof: old, expectedPhone: PHONE, purpose: 'LOGIN' }),
    ).resolves.toEqual({ outcome: 'EXPIRED' });
  });
});
