import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { unavailable } from '../src/modules/services';
import type { AdminLoginService } from '../src/domain/auth/adminLogin.service';
import { SETTING_DEFAULTS } from '../src/constants/settings';
import { createAdminAuthService } from '../src/domain/auth/adminAuth.service';
import { createRefreshTokenService } from '../src/domain/auth/refreshTokens.service';
import { AdminsRepository, RefreshTokensRepository } from '../src/repositories/identity.repository';
import { verifyAccessToken } from '../src/utils/auth/accessToken';
import * as password from '../src/utils/auth/password';
import { createLogger } from '../src/utils/logger';
import { createFakeModel, type FakeModel } from './helpers/fakeModel';

const logger = createLogger({ level: 'silent' });
const SECRET = 'a'.repeat(48);
const START = new Date('2026-10-12T10:00:00.000Z');
const PASSWORD = 'correct horse battery staple';
const COST = 4;
const IP = '203.0.113.7';

interface Rig {
  service: ReturnType<typeof createAdminAuthService>;
  admins: FakeModel;
  tokens: FakeModel;
  clock: { now: Date };
  adminId: string;
  settings: Record<string, number>;
}

const setup = async (): Promise<Rig> => {
  const clock = { now: START };
  const adminId = new Types.ObjectId();
  const admins = createFakeModel([
    {
      _id: adminId,
      email: 'admin@example.com',
      passwordHash: await password.hashPassword(PASSWORD, COST),
      failedLoginCount: 0,
      alertEmails: [],
    },
  ]);
  const tokens = createFakeModel();
  const overrides: Record<string, number> = {};
  const settings = {
    get: (key: string) =>
      Promise.resolve((overrides[key] ?? SETTING_DEFAULTS[key as never]) as never),
  };
  const refreshTokens = createRefreshTokenService({
    repository: new RefreshTokensRepository(tokens.model as never),
    logger,
    now: () => clock.now,
  });
  const service = createAdminAuthService({
    admins: new AdminsRepository(admins.model as never),
    refreshTokens,
    settings,
    logger,
    accessSecret: SECRET,
    now: () => clock.now,
    bcryptCost: COST,
  });
  return { service, admins, tokens, clock, adminId: adminId.toHexString(), settings: overrides };
};

/** Admin idle timeout default (owner 2026-10-26: 2 days). */
const IDLE_SEC = SETTING_DEFAULTS['admin.sessionIdleSec'];

const after = (rig: Rig, seconds: number): void => {
  rig.clock.now = new Date(rig.clock.now.getTime() + seconds * 1000);
};
const failure = async (promise: Promise<unknown>): Promise<Record<string, unknown>> =>
  await promise.then(
    () => ({}),
    (error: unknown) => error as Record<string, unknown>,
  );
const attempt = (rig: Rig, pass: string, email = 'admin@example.com'): Promise<unknown> =>
  rig.service.verifyCredentials({ email, password: pass, ip: IP });
const adminDoc = (rig: Rig): Record<string, unknown> => rig.admins.docs[0] ?? {};

describe('admin auth: password check', () => {
  it('accepts the right password, ignoring email case and spaces', async () => {
    const rig = await setup();
    await expect(attempt(rig, PASSWORD, '  Admin@Example.COM ')).resolves.toEqual({
      id: rig.adminId,
      email: 'admin@example.com',
    });
  });

  it('a wrong password and an unknown email give the same 401', async () => {
    const rig = await setup();
    const wrong = await failure(attempt(rig, 'nope'));
    const unknown = await failure(attempt(rig, PASSWORD, 'nobody@example.com'));
    expect(wrong).toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401 });
    expect(unknown).toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401 });
  });

  it('an unknown email still pays for a bcrypt comparison', async () => {
    const rig = await setup();
    const spy = jest.spyOn(password, 'verifyPassword');
    await failure(attempt(rig, PASSWORD, 'nobody@example.com'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('counts wrong passwords and a right one does not reset the count (the second factor does)', async () => {
    const rig = await setup();
    await failure(attempt(rig, 'nope'));
    await failure(attempt(rig, 'nope'));
    expect(adminDoc(rig)['failedLoginCount']).toBe(2);
    await attempt(rig, PASSWORD);
    expect(adminDoc(rig)['failedLoginCount']).toBe(2);
  });
});

describe('admin auth: lockout', () => {
  it('locks for 15 minutes after the 5th wrong password and refuses even the right one', async () => {
    const rig = await setup();
    for (let i = 0; i < 4; i += 1) {
      expect(await failure(attempt(rig, 'nope'))).toMatchObject({ httpStatus: 401 });
    }
    expect(adminDoc(rig)['lockedUntil']).toBeUndefined();
    expect(await failure(attempt(rig, 'nope'))).toMatchObject({ httpStatus: 401 });
    expect(adminDoc(rig)['lockedUntil']).toEqual(new Date(START.getTime() + 900_000));
    expect(adminDoc(rig)['failedLoginCount']).toBe(0);
    expect(await failure(attempt(rig, PASSWORD))).toMatchObject({
      code: 'RATE_LIMITED',
      httpStatus: 429,
    });
  });

  it('does not look at the password while locked', async () => {
    const rig = await setup();
    rig.settings['admin.maxFailedLogins'] = 1;
    await failure(attempt(rig, 'nope'));
    const spy = jest.spyOn(password, 'verifyPassword');
    await failure(attempt(rig, PASSWORD));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('opens again exactly when the lock ends and counts from zero', async () => {
    const rig = await setup();
    rig.settings['admin.maxFailedLogins'] = 1;
    await failure(attempt(rig, 'nope'));
    after(rig, 899);
    expect(await failure(attempt(rig, PASSWORD))).toMatchObject({ httpStatus: 429 });
    after(rig, 1);
    await expect(attempt(rig, PASSWORD)).resolves.toMatchObject({ id: rig.adminId });
    rig.settings['admin.maxFailedLogins'] = 5;
    await failure(attempt(rig, 'nope'));
    expect(adminDoc(rig)['failedLoginCount']).toBe(1);
  });

  it('reads the limit and the lock time from the settings', async () => {
    const rig = await setup();
    rig.settings['admin.maxFailedLogins'] = 2;
    rig.settings['admin.lockSec'] = 60;
    await failure(attempt(rig, 'nope'));
    await failure(attempt(rig, 'nope'));
    expect(adminDoc(rig)['lockedUntil']).toEqual(new Date(START.getTime() + 60_000));
  });
});

describe('admin auth: session', () => {
  it('opens an admin-scope session, records the login and clears failures and the lock', async () => {
    const rig = await setup();
    await failure(attempt(rig, 'nope'));
    Object.assign(adminDoc(rig), { lockedUntil: new Date(START.getTime() - 1) });
    const session = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    expect(verifyAccessToken(SECRET, session.accessToken, START)).toMatchObject({
      subjectType: 'ADMIN',
      scope: 'admin',
      subjectId: rig.adminId,
    });
    expect(session.admin).toEqual({ id: rig.adminId, email: 'admin@example.com' });
    expect(session.accessTokenExpiresAt.getTime()).toBe(START.getTime() + 900_000);
    expect(adminDoc(rig)).toMatchObject({
      failedLoginCount: 0,
      lastLoginIp: IP,
      lastLoginAt: START,
    });
    expect(adminDoc(rig)['lockedUntil']).toBeUndefined();
    expect(JSON.stringify(rig.tokens.docs)).not.toContain(session.refreshToken);
  });

  it('the refresh token lives for the idle timeout (2 days by default), not the app 90 days', async () => {
    expect(IDLE_SEC).toBe(2 * 24 * 60 * 60);
    const rig = await setup();
    const session = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    expect(session.refreshTokenExpiresAt.getTime()).toBe(START.getTime() + IDLE_SEC * 1000);
  });

  it('an unknown admin id cannot open a session', async () => {
    const rig = await setup();
    expect(
      await failure(
        rig.service.openSession({ adminId: new Types.ObjectId().toHexString(), ip: IP }),
      ),
    ).toMatchObject({ httpStatus: 401 });
    expect(rig.tokens.docs).toHaveLength(0);
  });

  it('stays alive while used: every refresh restarts the idle window', async () => {
    const rig = await setup();
    let { refreshToken } = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    for (let i = 0; i < 3; i += 1) {
      after(rig, IDLE_SEC - 60);
      const next = await rig.service.refresh({ refreshToken });
      expect(next.refreshTokenExpiresAt.getTime()).toBe(rig.clock.now.getTime() + IDLE_SEC * 1000);
      refreshToken = next.refreshToken;
    }
  });

  it('ends after the idle timeout: valid one second before, 401 at the limit', async () => {
    const rig = await setup();
    const { refreshToken } = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    after(rig, IDLE_SEC);
    expect(await failure(rig.service.refresh({ refreshToken }))).toMatchObject({ httpStatus: 401 });
    const rig2 = await setup();
    const second = await rig2.service.openSession({ adminId: rig2.adminId, ip: IP });
    after(rig2, IDLE_SEC - 1);
    await expect(
      rig2.service.refresh({ refreshToken: second.refreshToken }),
    ).resolves.toBeDefined();
  });

  it('reads the idle timeout from the settings', async () => {
    const rig = await setup();
    rig.settings['admin.sessionIdleSec'] = 60;
    const session = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    expect(session.refreshTokenExpiresAt.getTime()).toBe(START.getTime() + 60_000);
  });

  it('reusing an old refresh token ends the session; a deleted admin loses every session', async () => {
    const rig = await setup();
    const first = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    const second = await rig.service.refresh({ refreshToken: first.refreshToken });
    expect(await failure(rig.service.refresh({ refreshToken: first.refreshToken }))).toMatchObject({
      httpStatus: 401,
    });
    expect(await failure(rig.service.refresh({ refreshToken: second.refreshToken }))).toMatchObject(
      {
        httpStatus: 401,
      },
    );
    const rig2 = await setup();
    const session = await rig2.service.openSession({ adminId: rig2.adminId, ip: IP });
    rig2.admins.docs.length = 0;
    expect(
      await failure(rig2.service.refresh({ refreshToken: session.refreshToken })),
    ).toMatchObject({
      httpStatus: 401,
    });
    expect(rig2.tokens.docs.every((doc) => doc['revokedAt'] !== undefined)).toBe(true);
  });

  it('logout revokes the token and repeating it is harmless', async () => {
    const rig = await setup();
    const { refreshToken } = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    await rig.service.logout({ refreshToken });
    await rig.service.logout({ refreshToken });
    expect(await failure(rig.service.refresh({ refreshToken }))).toMatchObject({ httpStatus: 401 });
  });
});

describe('admin auth: HTTP', () => {
  interface Body {
    success: boolean;
    data: { refreshToken: string; admin: { email: string } } | null;
    error: { code: string };
  }
  const bodyOf = (res: { body: unknown }): Body => res.body as Body;

  it('refreshes and logs out through the API', async () => {
    const rig = await setup();
    const app = createApp({
      logger,
      services: { adminAuth: { service: rig.service, login: unavailable<AdminLoginService>() } },
    });
    const session = await rig.service.openSession({ adminId: rig.adminId, ip: IP });
    const refreshed = await request(app)
      .post('/admin/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(bodyOf(refreshed).data?.admin.email).toBe('admin@example.com');
    const out = await request(app)
      .post('/admin/v1/auth/logout')
      .send({ refreshToken: bodyOf(refreshed).data?.refreshToken });
    expect(out.status).toBe(200);
    expect(bodyOf(out).data).toBeNull();
  });

  it('validates the body', async () => {
    const rig = await setup();
    const res = await request(
      createApp({
        logger,
        services: { adminAuth: { service: rig.service, login: unavailable<AdminLoginService>() } },
      }),
    )
      .post('/admin/v1/auth/refresh')
      .send({ refreshToken: 'short' });
    expect(res.status).toBe(400);
    expect(bodyOf(res).error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 503, not 404, when admin auth is not configured', async () => {
    const res = await request(createApp({ logger }))
      .post('/admin/v1/auth/refresh')
      .send({ refreshToken: 'A'.repeat(43) });
    expect(res.status).toBe(503);
  });
});
