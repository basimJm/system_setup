import request from 'supertest';
import { createApp } from '../src/app';
import { createCustomerAuthService } from '../src/domain/auth/customerAuth.service';
import { createRefreshTokenService } from '../src/domain/auth/refreshTokens.service';
import type { OtpGate } from '../src/domain/otp/otpGate.service';
import { requireAuth } from '../src/middlewares/auth';
import {
  CustomersRepository,
  RefreshTokensRepository,
} from '../src/repositories/identity.repository';
import { verifyAccessToken } from '../src/utils/auth/accessToken';
import { RateLimitError } from '../src/utils/errors';
import { createLogger } from '../src/utils/logger';
import { createFakeModel, type FakeModel } from './helpers/fakeModel';
import { proofFor, testOtp } from './helpers/otp';
import { SECRET, fakeSettings } from './helpers/rig';

const logger = createLogger({ level: 'silent' });
const PHONE = '+991791234567';
const OTHER = '+991781234567';

interface Rig {
  service: ReturnType<typeof createCustomerAuthService>;
  customers: FakeModel;
  tokens: FakeModel;
  gate: { blocked: boolean; resets: string[] } & OtpGate;
  registered: string[];
}

const setup = (): Rig => {
  const customers = createFakeModel();
  const tokens = createFakeModel();
  const registered: string[] = [];
  const gate = {
    blocked: false,
    resets: [] as string[],
    request: () => Promise.reject(new Error('unused')),
    reportWrongAttempt: () => Promise.reject(new Error('unused')),
    assertNotBlocked(): Promise<void> {
      return this.blocked
        ? Promise.reject(new RateLimitError({ code: 'OTP_BLOCKED' }))
        : Promise.resolve();
    },
    reset(e164: string): Promise<void> {
      this.resets.push(e164);
      return Promise.resolve();
    },
  };
  const service = createCustomerAuthService({
    customers: new CustomersRepository(customers.model as never),
    otp: testOtp,
    otpGate: gate,
    refreshTokens: createRefreshTokenService({
      repository: new RefreshTokensRepository(tokens.model as never),
      logger,
    }),
    settings: fakeSettings(),
    accessSecret: SECRET,
    onRegistered: (customer) => registered.push(customer.id),
  });
  return { service, customers, tokens, gate, registered };
};

const registration = (
  phone = PHONE,
  kind: 'valid' | 'expired' | 'invalid' = 'valid',
): { name: string; phone: string; otpToken: string; language: 'en' } => ({
  name: 'Lina',
  phone,
  otpToken: proofFor(phone, 'REGISTER', kind),
  language: 'en' as const,
});

describe('customer auth: register', () => {
  it('creates the account, opens a session, resets the OTP counters and fires onRegistered', async () => {
    const rig = setup();
    const session = await rig.service.register({ ...registration(), pushToken: 'push-1' });
    expect(session.customer).toMatchObject({ name: 'Lina', phone: PHONE, language: 'en' });
    expect(verifyAccessToken(SECRET, session.accessToken).subjectId).toBe(session.customer.id);
    expect(rig.customers.docs[0]).toMatchObject({ status: 'ACTIVE', pushToken: 'push-1' });
    expect(rig.gate.resets).toEqual([PHONE]);
    expect(rig.registered).toEqual([session.customer.id]);
  });

  it.each(['expired', 'invalid'] as const)('refuses a %s otpToken with 401', async (kind) => {
    await expect(setup().service.register(registration(PHONE, kind))).rejects.toMatchObject({
      httpStatus: 401,
    });
  });

  it('refuses a token for another phone, a blocked phone and a taken phone', async () => {
    const rig = setup();
    await expect(
      rig.service.register({ ...registration(), otpToken: proofFor(OTHER, 'REGISTER') }),
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await rig.service.register(registration());
    await expect(rig.service.register(registration())).rejects.toMatchObject({
      code: 'PHONE_ALREADY_REGISTERED',
    });
    rig.gate.blocked = true;
    await expect(rig.service.register(registration(OTHER))).rejects.toMatchObject({
      code: 'OTP_BLOCKED',
    });
  });
});

describe('customer auth: login, refresh, logout, change phone', () => {
  it('checkPhone answers per purpose', async () => {
    const rig = setup();
    await expect(rig.service.checkPhone({ phone: PHONE, purpose: 'LOGIN' })).rejects.toMatchObject({
      code: 'PHONE_NOT_REGISTERED',
    });
    await expect(
      rig.service.checkPhone({ phone: PHONE, purpose: 'REGISTER' }),
    ).resolves.toBeUndefined();
    await rig.service.register(registration());
    await expect(
      rig.service.checkPhone({ phone: PHONE, purpose: 'REGISTER' }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });
    Object.assign(rig.customers.docs[0] ?? {}, { status: 'BLOCKED' });
    await expect(rig.service.checkPhone({ phone: PHONE, purpose: 'LOGIN' })).rejects.toMatchObject({
      code: 'ACCOUNT_BLOCKED',
    });
  });

  it('logs in, rotates refresh tokens, revokes everything on reuse and clears the push token on logout', async () => {
    const rig = setup();
    await rig.service.register(registration());
    const session = await rig.service.login({
      phone: PHONE,
      otpToken: proofFor(PHONE, 'LOGIN'),
      language: 'ar',
      pushToken: 'p2',
    });
    expect(rig.customers.docs[0]).toMatchObject({ pushToken: 'p2', language: 'ar' });
    const next = await rig.service.refresh({ refreshToken: session.refreshToken });
    expect(next.refreshToken).not.toBe(session.refreshToken);
    await expect(rig.service.refresh({ refreshToken: session.refreshToken })).rejects.toMatchObject(
      { httpStatus: 401 },
    );
    await expect(rig.service.refresh({ refreshToken: next.refreshToken })).rejects.toMatchObject({
      httpStatus: 401,
    });
    const again = await rig.service.login({
      phone: PHONE,
      otpToken: proofFor(PHONE, 'LOGIN'),
      language: 'ar',
    });
    await rig.service.logout({ refreshToken: again.refreshToken });
    expect(rig.customers.docs[0]?.['pushToken']).toBeUndefined();
    await expect(rig.service.refresh({ refreshToken: again.refreshToken })).rejects.toMatchObject({
      httpStatus: 401,
    });
  });

  it('a blocked account cannot log in or refresh; an unknown number is 404', async () => {
    const rig = setup();
    await expect(
      rig.service.login({ phone: PHONE, otpToken: proofFor(PHONE, 'LOGIN'), language: 'en' }),
    ).rejects.toMatchObject({ code: 'PHONE_NOT_REGISTERED' });
    const session = await rig.service.register(registration());
    Object.assign(rig.customers.docs[0] ?? {}, { status: 'BLOCKED' });
    await expect(
      rig.service.login({ phone: PHONE, otpToken: proofFor(PHONE, 'LOGIN'), language: 'en' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    await expect(rig.service.refresh({ refreshToken: session.refreshToken })).rejects.toMatchObject(
      { code: 'ACCOUNT_BLOCKED' },
    );
  });

  it('changes the phone with a proof of the NEW number and refuses a taken one', async () => {
    const rig = setup();
    const session = await rig.service.register(registration());
    await rig.service.register(registration(OTHER));
    await expect(
      rig.service.changePhone({
        customerId: session.customer.id,
        phone: OTHER,
        otpToken: proofFor(OTHER, 'CHANGE_PHONE'),
      }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });
    const third = '+991771234567';
    const updated = await rig.service.changePhone({
      customerId: session.customer.id,
      phone: third,
      otpToken: proofFor(third, 'CHANGE_PHONE'),
    });
    expect(updated.phone).toBe(third);
  });
});

describe('customer auth over HTTP', () => {
  it('serves register → login → me → change-phone with the base envelope and validation', async () => {
    const rig = setup();
    const app = createApp({
      logger,
      services: {
        customerAuth: { service: rig.service, authenticate: requireAuth('customer', SECRET) },
        customers: new CustomersRepository(rig.customers.model as never),
      },
    });
    const bad = await request(app)
      .post('/customer/v1/auth/register')
      .send({ name: 'x', phone: '0791', otpToken: 't' });
    expect(bad.status).toBe(400);
    expect((bad.body as { error: { details: { field: string }[] } }).error.details[0]?.field).toBe(
      'body.phone',
    );
    const created = await request(app)
      .post('/customer/v1/auth/register')
      .set('Accept-Language', 'en')
      .send(registration());
    expect(created.status).toBe(201);
    const { accessToken } = (created.body as { data: { accessToken: string } }).data;
    const me = await request(app)
      .get('/customer/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect((me.body as { data: { phone: string } }).data.phone).toBe(PHONE);
    const noToken = await request(app)
      .post('/customer/v1/auth/change-phone')
      .send({ phone: OTHER, otpToken: proofFor(OTHER, 'CHANGE_PHONE') });
    expect(noToken.status).toBe(401);
    const changed = await request(app)
      .post('/customer/v1/auth/change-phone')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: OTHER, otpToken: proofFor(OTHER, 'CHANGE_PHONE') });
    expect(changed.status).toBe(200);
    expect((changed.body as { data: { customer: { phone: string } } }).data.customer.phone).toBe(
      OTHER,
    );
  });
});
