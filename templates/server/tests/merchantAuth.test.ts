import request from 'supertest';
import { createApp } from '../src/app';
import { createMerchantAuthService } from '../src/domain/auth/merchantAuth.service';
import { createRefreshTokenService } from '../src/domain/auth/refreshTokens.service';
import { createTeamService } from '../src/domain/team/team.service';
import { requireAuth } from '../src/middlewares/auth';
import { loadMember } from '../src/middlewares/permission';
import {
  MembersRepository,
  RefreshTokensRepository,
} from '../src/repositories/identity.repository';
import { createLogger } from '../src/utils/logger';
import { createFakeModel, type FakeModel } from './helpers/fakeModel';
import { proofFor, testOtp } from './helpers/otp';
import { SECRET, fakeSettings, recordingAccess } from './helpers/rig';

const logger = createLogger({ level: 'silent' });
const OWNER_PHONE = '+991791234567';
const STAFF_PHONE = '+991781234567';

const gate = {
  request: () => Promise.reject(new Error('unused')),
  reportWrongAttempt: () => Promise.reject(new Error('unused')),
  assertNotBlocked: () => Promise.resolve(),
  reset: () => Promise.resolve(),
};

interface Rig {
  auth: ReturnType<typeof createMerchantAuthService>;
  team: ReturnType<typeof createTeamService>;
  members: FakeModel;
  access: ReturnType<typeof recordingAccess>;
  app: ReturnType<typeof createApp>;
}

const setup = (): Rig => {
  const members = createFakeModel();
  const tokens = createFakeModel();
  const repository = new MembersRepository(members.model as never);
  const refreshTokens = createRefreshTokenService({
    repository: new RefreshTokensRepository(tokens.model as never),
    logger,
  });
  const auth = createMerchantAuthService({
    members: repository,
    otp: testOtp,
    otpGate: gate,
    refreshTokens,
    settings: fakeSettings(),
    accessSecret: SECRET,
  });
  const access = recordingAccess();
  const team = createTeamService({ members: repository, refreshTokens, access });
  const app = createApp({
    logger,
    services: {
      merchantAuth: {
        service: auth,
        guard: [requireAuth('merchant', SECRET), loadMember(repository)],
      },
      members: repository,
      team,
    },
  });
  return { auth, team, members, access, app };
};

const register = (rig: Rig): ReturnType<Rig['auth']['register']> =>
  rig.auth.register({
    businessName: 'Acme',
    name: 'Omar',
    phone: OWNER_PHONE,
    otpToken: proofFor(OWNER_PHONE, 'REGISTER'),
    language: 'en',
  });

describe('merchant auth', () => {
  it('register makes the caller the OWNER of a new tenant with every permission', async () => {
    const rig = setup();
    const session = await register(rig);
    expect(session.member).toMatchObject({
      role: 'OWNER',
      tenantId: session.member.id,
      businessName: 'Acme',
      permissions: ['ITEMS_VIEW', 'ITEMS_MANAGE'],
    });
    await expect(register(rig)).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });
    await expect(
      rig.auth.checkPhone({ phone: OWNER_PHONE, purpose: 'REGISTER' }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });
    await expect(
      rig.auth.checkPhone({ phone: STAFF_PHONE, purpose: 'LOGIN' }),
    ).rejects.toMatchObject({ code: 'PHONE_NOT_REGISTERED' });
  });

  it('staff added by the owner can log in; a deactivated member is refused everywhere', async () => {
    const rig = setup();
    const owner = await register(rig);
    const staff = await rig.team.add({
      tenantId: owner.member.tenantId,
      businessName: 'Acme',
      name: 'Sara',
      phone: STAFF_PHONE,
      permissions: ['ITEMS_VIEW'],
      language: 'ar',
    });
    expect(staff).toMatchObject({
      role: 'STAFF',
      permissions: ['ITEMS_VIEW'],
      tenantId: owner.member.tenantId,
    });
    const session = await rig.auth.login({
      phone: STAFF_PHONE,
      otpToken: proofFor(STAFF_PHONE, 'LOGIN'),
      language: 'ar',
    });
    expect(session.member.id).toBe(staff.id);
    await rig.team.update({ tenantId: owner.member.tenantId, memberId: staff.id, active: false });
    expect(rig.access.calls).toContain(`revoked:merchant:${staff.id}`);
    await expect(rig.auth.refresh({ refreshToken: session.refreshToken })).rejects.toMatchObject({
      httpStatus: 401,
    });
    await expect(
      rig.auth.login({
        phone: STAFF_PHONE,
        otpToken: proofFor(STAFF_PHONE, 'LOGIN'),
        language: 'ar',
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_INACTIVE' });
  });

  it('grants are validated: unknown keys 400, owner-only capabilities flagged, changes announced', async () => {
    const rig = setup();
    const owner = await register(rig);
    await expect(
      rig.team.add({
        tenantId: owner.member.tenantId,
        businessName: 'Acme',
        name: 'S',
        phone: STAFF_PHONE,
        permissions: ['TEAM_MANAGE'],
        language: 'en',
      }),
    ).rejects.toMatchObject({
      httpStatus: 400,
      details: [{ code: 'OWNER_REQUIRED' }],
    });
    const staff = await rig.team.add({
      tenantId: owner.member.tenantId,
      businessName: 'Acme',
      name: 'S',
      phone: STAFF_PHONE,
      permissions: ['ITEMS_MANAGE', 'ITEMS_MANAGE'],
      language: 'en',
    });
    expect(staff.permissions).toEqual(['ITEMS_MANAGE']);
    await rig.team.update({
      tenantId: owner.member.tenantId,
      memberId: staff.id,
      permissions: ['ITEMS_VIEW'],
    });
    expect(rig.access.calls).toContain(`permissions:${staff.id}`);
    // Another tenant cannot touch this member; the owner row is never edited through the team.
    await expect(
      rig.team.update({ tenantId: staff.id, memberId: staff.id, active: false }),
    ).rejects.toMatchObject({ httpStatus: 404 });
    await expect(
      rig.team.update({
        tenantId: owner.member.tenantId,
        memberId: owner.member.id,
        active: false,
      }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('HTTP: team routes are owner-only, /me reflects live permissions', async () => {
    const rig = setup();
    const owner = await register(rig);
    const auth = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });
    const created = await request(rig.app)
      .post('/merchant/v1/team')
      .set(auth(owner.accessToken))
      .send({ name: 'Sara', phone: STAFF_PHONE, permissions: ['ITEMS_VIEW'] });
    expect(created.status).toBe(201);
    const staffSession = await rig.auth.login({
      phone: STAFF_PHONE,
      otpToken: proofFor(STAFF_PHONE, 'LOGIN'),
      language: 'en',
    });
    const forbidden = await request(rig.app)
      .get('/merchant/v1/team')
      .set(auth(staffSession.accessToken));
    expect(forbidden.status).toBe(403);
    expect((forbidden.body as { error: { code: string } }).error.code).toBe('OWNER_REQUIRED');
    const me = await request(rig.app).get('/merchant/v1/me').set(auth(staffSession.accessToken));
    expect((me.body as { data: { permissions: string[] } }).data.permissions).toEqual([
      'ITEMS_VIEW',
    ]);
    const list = await request(rig.app).get('/merchant/v1/team').set(auth(owner.accessToken));
    expect((list.body as { data: unknown[] }).data).toHaveLength(2);
  });
});
