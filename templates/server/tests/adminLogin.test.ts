import type { Redis } from 'ioredis';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { ADMIN_OTP_KEY_PREFIX } from '../src/constants/adminAuth';
import { SETTING_DEFAULTS } from '../src/constants/settings';
import { createAdminAuthService } from '../src/domain/auth/adminAuth.service';
import type { AdminSession } from '../src/domain/auth/adminAuth.service';
import { createAdminLoginService, type OtpChallenge } from '../src/domain/auth/adminLogin.service';
import { createRefreshTokenService } from '../src/domain/auth/refreshTokens.service';
import { FakeNotifier } from '../src/providers/notifier';
import { AdminsRepository, RefreshTokensRepository } from '../src/repositories/identity.repository';
import { verifyAccessToken } from '../src/utils/auth/accessToken';
import { hashPassword } from '../src/utils/auth/password';
import { ExternalServiceError } from '../src/utils/errors';
import { createLogger } from '../src/utils/logger';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import { redisKey } from '../src/utils/redis/keys';
import { createFakeModel, type FakeModel } from './helpers/fakeModel';
import { startTestRedis, type TestRedis } from './helpers/redis';

const logger = createLogger({ level: 'silent' });
const SECRET = 'a'.repeat(48);
const PASSWORD = 'correct horse battery staple';
const EMAIL = 'admin@example.com';
const IP = '203.0.113.7';
const CODE = '123456';

let testRedis: TestRedis;
let redis: Redis;
beforeAll(async () => {
  testRedis = await startTestRedis();
  redis = await connectRedis({ redis: { url: testRedis.url } }, logger);
});
afterAll(async () => {
  await disconnectRedis(redis);
  await testRedis.stop();
});
beforeEach(async () => {
  await redis.flushdb();
});

interface Rig {
  login: ReturnType<typeof createAdminLoginService>;
  auth: ReturnType<typeof createAdminAuthService>;
  admins: FakeModel;
  tokens: FakeModel;
  notifier: FakeNotifier;
  adminId: string;
  codes: string[];
}

const setup = async (
  options: { alertEmails?: string[]; lastLoginIp?: string } = {},
): Promise<Rig> => {
  const adminId = new Types.ObjectId();
  const admins = createFakeModel([
    {
      _id: adminId,
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD, 4),
      failedLoginCount: 0,
      alertEmails: options.alertEmails ?? [],
      ...(options.lastLoginIp === undefined ? {} : { lastLoginIp: options.lastLoginIp }),
    },
  ]);
  const tokens = createFakeModel();
  const settings = {
    get: (key: string) => Promise.resolve(SETTING_DEFAULTS[key as never]),
  };
  const auth = createAdminAuthService({
    admins: new AdminsRepository(admins.model as never),
    refreshTokens: createRefreshTokenService({
      repository: new RefreshTokensRepository(tokens.model as never),
      logger,
    }),
    settings,
    logger,
    accessSecret: SECRET,
    bcryptCost: 4,
  });
  const notifier = new FakeNotifier();
  const codes: string[] = [];
  const login = createAdminLoginService({
    auth,
    admins: new AdminsRepository(admins.model as never),
    redis,
    notifier,
    settings,
    logger,
    secret: SECRET,
    randomCode: () => {
      const code = codes.shift() ?? CODE;
      return code;
    },
  });
  return { login, auth, admins, tokens, notifier, adminId: adminId.toHexString(), codes };
};

const start = (
  rig: Rig,
  password = PASSWORD,
  language: 'ar' | 'en' = 'en',
): Promise<OtpChallenge> => rig.login.start({ email: EMAIL, password, ip: IP, language });
const verify = (rig: Rig, code = CODE, ip = IP): Promise<AdminSession> =>
  rig.login.verify({ email: EMAIL, code, ip, language: 'en' });
const failure = async (promise: Promise<unknown>): Promise<Record<string, unknown>> =>
  await promise.then(
    () => ({}),
    (error: unknown) => error as Record<string, unknown>,
  );
const codeKey = (rig: Rig): string => redisKey(ADMIN_OTP_KEY_PREFIX.code, rig.adminId);
const resendKey = (rig: Rig): string => redisKey(ADMIN_OTP_KEY_PREFIX.resend, rig.adminId);
const adminDoc = (rig: Rig): Record<string, unknown> => rig.admins.docs[0] ?? {};

describe('admin login: step 1 (password, then email)', () => {
  it('emails a code and opens no session', async () => {
    const rig = await setup();
    const challenge = await start(rig);
    expect(rig.notifier.emails).toHaveLength(1);
    expect(rig.notifier.emails[0]).toMatchObject({ to: [EMAIL] });
    expect(rig.notifier.emails[0]?.text).toContain(CODE);
    expect(rig.tokens.docs).toHaveLength(0);
    expect(challenge.resendAfterSeconds).toBe(60);
    expect(challenge.expiresAt.getTime() - Date.now()).toBeGreaterThan(298_000);
  });

  it('stores only a keyed hash of the code, for five minutes', async () => {
    const rig = await setup();
    await start(rig);
    const stored = await redis.get(codeKey(rig));
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).not.toContain(CODE);
    const ttl = await redis.ttl(codeKey(rig));
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('writes the email in the requested language', async () => {
    const english = await setup();
    await start(english, PASSWORD, 'en');
    expect(english.notifier.emails[0]?.subject).toBe('__SYSTEM_NAME__ admin sign-in code');
    await redis.flushdb();
    const arabic = await setup();
    await start(arabic, PASSWORD, 'ar');
    expect(arabic.notifier.emails[0]?.subject).toMatch(/[؀-ۿ]/);
    expect(arabic.notifier.emails[0]?.text).toContain(CODE);
  });

  it('generates a numeric code of the configured length by default', async () => {
    const adminId = new Types.ObjectId();
    const admins = createFakeModel([
      {
        _id: adminId,
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD, 4),
        failedLoginCount: 0,
      },
    ]);
    const settings = {
      get: (key: string) => Promise.resolve(SETTING_DEFAULTS[key as never]),
    };
    const notifier = new FakeNotifier();
    const repo = new AdminsRepository(admins.model as never);
    const auth = createAdminAuthService({
      admins: repo,
      refreshTokens: createRefreshTokenService({
        repository: new RefreshTokensRepository(createFakeModel().model as never),
        logger,
      }),
      settings,
      logger,
      accessSecret: SECRET,
      bcryptCost: 4,
    });
    const login = createAdminLoginService({
      auth,
      admins: repo,
      redis,
      notifier,
      settings,
      logger,
      secret: SECRET,
    });
    await login.start({ email: EMAIL, password: PASSWORD, ip: IP, language: 'en' });
    expect(notifier.emails[0]?.text).toMatch(/code is \d{6}\./);
  });

  it('a wrong password, an unknown email and a locked account send nothing', async () => {
    const rig = await setup();
    expect(await failure(start(rig, 'nope'))).toMatchObject({ httpStatus: 401 });
    expect(
      await failure(
        rig.login.start({ email: 'x@example.com', password: PASSWORD, ip: IP, language: 'en' }),
      ),
    ).toMatchObject({ httpStatus: 401 });
    Object.assign(adminDoc(rig), { lockedUntil: new Date(Date.now() + 60_000) });
    expect(await failure(start(rig))).toMatchObject({ httpStatus: 429 });
    expect(rig.notifier.emails).toHaveLength(0);
    expect(await redis.get(codeKey(rig))).toBeNull();
  });

  it('does not mail another code inside the resend countdown, and the first one still works', async () => {
    const rig = await setup();
    await start(rig);
    const again = await start(rig);
    expect(rig.notifier.emails).toHaveLength(1);
    expect(again.resendAfterSeconds).toBeGreaterThan(0);
    expect(again.resendAfterSeconds).toBeLessThanOrEqual(60);
    expect(again.expiresAt.getTime() - Date.now()).toBeGreaterThan(290_000);
    await expect(verify(rig)).resolves.toBeDefined();
  });

  it('after the countdown a new code replaces the old one', async () => {
    const rig = await setup();
    rig.codes.push('111111', '222222');
    await start(rig);
    await redis.del(resendKey(rig));
    await start(rig);
    expect(rig.notifier.emails).toHaveLength(2);
    expect(await failure(verify(rig, '111111'))).toMatchObject({ code: 'OTP_INVALID' });
    await expect(verify(rig, '222222')).resolves.toBeDefined();
  });

  it('a failed email leaves no usable code and lets the admin ask again at once', async () => {
    const rig = await setup();
    const send = jest
      .spyOn(rig.notifier, 'sendEmail')
      .mockRejectedValueOnce(new ExternalServiceError({ unavailable: true }));
    expect(await failure(start(rig))).toBeInstanceOf(ExternalServiceError);
    expect(await redis.get(codeKey(rig))).toBeNull();
    expect(await redis.get(resendKey(rig))).toBeNull();
    send.mockRestore();
    await expect(start(rig)).resolves.toBeDefined();
  });
});

describe('admin login: step 2 (the code)', () => {
  it('the right code opens an admin session and works once', async () => {
    const rig = await setup();
    await start(rig);
    const session = await verify(rig);
    expect(verifyAccessToken(SECRET, session.accessToken)).toMatchObject({
      subjectType: 'ADMIN',
      scope: 'admin',
      subjectId: rig.adminId,
    });
    expect(session.admin).toEqual({ id: rig.adminId, email: EMAIL });
    expect(adminDoc(rig)).toMatchObject({ lastLoginIp: IP, failedLoginCount: 0 });
    expect(await failure(verify(rig))).toMatchObject({ code: 'OTP_EXPIRED', httpStatus: 401 });
  });

  it('with no code requested, or after it expired, the answer is OTP_EXPIRED', async () => {
    const rig = await setup();
    expect(await failure(verify(rig))).toMatchObject({ code: 'OTP_EXPIRED' });
    await start(rig);
    await redis.del(codeKey(rig));
    expect(await failure(verify(rig))).toMatchObject({ code: 'OTP_EXPIRED' });
    expect(adminDoc(rig)['failedLoginCount']).toBe(0);
  });

  it('a wrong code is OTP_INVALID and counts toward the lockout; the right one still works before it', async () => {
    const rig = await setup();
    await start(rig);
    expect(await failure(verify(rig, '000000'))).toMatchObject({
      code: 'OTP_INVALID',
      httpStatus: 401,
    });
    expect(adminDoc(rig)['failedLoginCount']).toBe(1);
    await expect(verify(rig)).resolves.toBeDefined();
    expect(adminDoc(rig)['failedLoginCount']).toBe(0);
  });

  it('five wrong codes lock the account, even for the right code and a fresh password step', async () => {
    const rig = await setup();
    await start(rig);
    for (let i = 0; i < 5; i += 1) {
      expect(await failure(verify(rig, '000000'))).toMatchObject({ httpStatus: 401 });
    }
    expect(adminDoc(rig)['lockedUntil']).toBeInstanceOf(Date);
    expect(await failure(verify(rig))).toMatchObject({ httpStatus: 429 });
    expect(await failure(start(rig))).toMatchObject({ httpStatus: 429 });
  });

  it('an unknown email gets 401 and never reaches the code check', async () => {
    const rig = await setup();
    await start(rig);
    expect(
      await failure(
        rig.login.verify({ email: 'x@example.com', code: CODE, ip: IP, language: 'en' }),
      ),
    ).toMatchObject({ httpStatus: 401 });
  });

  it('of two simultaneous requests with the right code only one gets a session', async () => {
    const rig = await setup();
    await start(rig);
    const results = await Promise.allSettled([verify(rig), verify(rig)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rig.tokens.docs).toHaveLength(1);
  });
});

describe('admin login: new-address alert', () => {
  const signIn = async (rig: Rig, ip: string): Promise<void> => {
    await redis.del(resendKey(rig));
    await start(rig);
    await verify(rig, CODE, ip);
  };

  it('stays quiet on the first sign-in and from the usual address', async () => {
    const rig = await setup();
    await signIn(rig, IP);
    await signIn(rig, IP);
    expect(rig.notifier.emails.filter((m) => m.subject.includes('New'))).toHaveLength(0);
  });

  it('emails the alert recipients when the address changes', async () => {
    const rig = await setup({ alertEmails: ['ops@example.com'], lastLoginIp: IP });
    await signIn(rig, '198.51.100.9');
    const alert = rig.notifier.emails.find((m) => m.subject.includes('New'));
    expect(alert?.to).toEqual(['ops@example.com']);
    expect(alert?.text).toContain('198.51.100.9');
  });

  it('falls back to the admin email, and never blocks the sign-in when the alert fails', async () => {
    const rig = await setup({ lastLoginIp: IP });
    const real = rig.notifier.sendEmail.bind(rig.notifier);
    jest.spyOn(rig.notifier, 'sendEmail').mockImplementation((mail) => {
      if (mail.subject.includes('New')) return Promise.reject(new Error('smtp down'));
      return real(mail);
    });
    await redis.del(resendKey(rig));
    await start(rig);
    await expect(verify(rig, CODE, '198.51.100.9')).resolves.toBeDefined();
  });

  it('falls back to the admin email when no alert recipients are set', async () => {
    const rig = await setup({ lastLoginIp: IP });
    await signIn(rig, '198.51.100.9');
    const alert = rig.notifier.emails.find((m) => m.subject.includes('New'));
    expect(alert?.to).toEqual([EMAIL]);
  });
});

describe('admin login: HTTP', () => {
  interface Body {
    success: boolean;
    data: { otpRequired?: boolean; accessToken?: string; refreshToken?: string } | null;
    error: { code: string; details: { field: string }[] };
  }
  const bodyOf = (res: { body: unknown }): Body => res.body as Body;
  const appFor = (rig: Rig): ReturnType<typeof createApp> =>
    createApp({ logger, services: { adminAuth: { service: rig.auth, login: rig.login } } });

  it('login answers "code required" without tokens, verify-otp then returns the session', async () => {
    const rig = await setup();
    const app = appFor(rig);
    const step1 = await request(app)
      .post('/admin/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(step1.status).toBe(200);
    expect(bodyOf(step1).data).toMatchObject({ otpRequired: true });
    expect(bodyOf(step1).data?.accessToken).toBeUndefined();
    expect(bodyOf(step1).data?.refreshToken).toBeUndefined();
    const step2 = await request(app)
      .post('/admin/v1/auth/verify-otp')
      .send({ email: EMAIL, code: CODE });
    expect(step2.status).toBe(200);
    expect(bodyOf(step2).data?.accessToken).toBeDefined();
    const refreshed = await request(app)
      .post('/admin/v1/auth/refresh')
      .send({ refreshToken: bodyOf(step2).data?.refreshToken });
    expect(refreshed.status).toBe(200);
  });

  it('answers the wrong password and the wrong code with their codes', async () => {
    const rig = await setup();
    const app = appFor(rig);
    const bad = await request(app)
      .post('/admin/v1/auth/login')
      .send({ email: EMAIL, password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bodyOf(bad).error.code).toBe('UNAUTHORIZED');
    await request(app).post('/admin/v1/auth/login').send({ email: EMAIL, password: PASSWORD });
    const wrong = await request(app)
      .post('/admin/v1/auth/verify-otp')
      .send({ email: EMAIL, code: '000000' });
    expect(wrong.status).toBe(401);
    expect(bodyOf(wrong).error.code).toBe('OTP_INVALID');
  });

  it.each([
    ['/admin/v1/auth/login', { email: 'nope', password: 'x' }, 'body.email'],
    ['/admin/v1/auth/login', { email: EMAIL, password: '' }, 'body.password'],
    ['/admin/v1/auth/login', { email: EMAIL, password: 'x'.repeat(257) }, 'body.password'],
    ['/admin/v1/auth/verify-otp', { email: EMAIL, code: 'abc123' }, 'body.code'],
    ['/admin/v1/auth/verify-otp', { email: EMAIL, code: '123' }, 'body.code'],
  ])('validates %s %j', async (path, body, field) => {
    const rig = await setup();
    const res = await request(appFor(rig)).post(path).send(body);
    expect(res.status).toBe(400);
    expect(bodyOf(res).error.details.map((d) => d.field)).toContain(field);
  });

  it('answers 503, not 404, when admin auth is not configured', async () => {
    const res = await request(createApp({ logger }))
      .post('/admin/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(503);
  });
});
